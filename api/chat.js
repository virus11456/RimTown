// 小鎮伺服器 AI 代理:金鑰保管在伺服器端,前端免填任何金鑰即可與村民對話。
// v5.64.0 主渠道改為付費 AI 中繼(env LLM_*),保留 Groq(GROQ_API_KEY)為備援。
// v5.66.0 智慧分流搬到伺服器(規則同 v5.39.0 前端版):
//   lane=chat(玩家與村民對話、劇情名場面)→ 優先 Groq 免費額度,Groq 限流/故障 → 退回付費中繼,5 分鐘後再試 Groq
//   lane=background(行程/反思/背景對話)→ 付費中繼,失敗 → 退回 Groq,並對中繼累進冷卻(60s×次數,最多 5 分鐘),恢復即切回
//   冷卻狀態存在 lambda 記憶體(每個實例各自判斷),兩邊都失敗才回 502。
// 每日額度:訪客(依 IP)/ 登入玩家,記錄在 quota/<日期>/<key>.json(走儲存抽象層)。
const crypto = require('crypto');
const L = require('./_lib');

const GUEST_DAILY = parseInt(process.env.AI_GUEST_DAILY, 10) || 10;
const USER_DAILY = parseInt(process.env.AI_USER_DAILY, 10) || 100;

// 主渠道(付費中繼):相容 Anthropic(CC 類)與 OpenAI 兩種格式
const RELAY_BASE = process.env.LLM_BASE_URL || '';
const RELAY_KEY = process.env.LLM_API_KEY || '';
const RELAY_MODEL = process.env.LLM_MODEL || 'claude-haiku-4-5-20251001';
const RELAY_FORMAT = (process.env.LLM_FORMAT || 'anthropic').toLowerCase() === 'openai' ? 'openai' : 'anthropic';

// base URL 正規化:去尾端 /,若以 /v1 結尾也去掉,再接對應 endpoint
function relayUrl(base, format) {
    let b = String(base || '').trim().replace(/\/+$/, '');
    if (/\/v1$/i.test(b)) b = b.slice(0, -3).replace(/\/+$/, '');
    return b + (format === 'openai' ? '/v1/chat/completions' : '/v1/messages');
}

// 20 秒逾時的 fetch
async function fetchTimeout(url, opts, ms = 20000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
    finally { clearTimeout(timer); }
}

// 呼叫付費中繼;非 2xx / 逾時 / 例外都會 throw(由上層決定是否退回 Groq)
// v5.66.5 整個請求共用一個時間預算(見 handler 的 deadline):每個上游呼叫只能用剩下的時間,
// 兩條渠道加起來不會超過函式 30 秒上限,最壞情況也是「退回另一邊」而不是 504
function budget(deadline, cap) { return Math.max(1000, Math.min(cap, deadline - Date.now())); }

async function callRelay(prompt, maxTokens, temperature, deadline = Date.now() + 15000) {
    const url = relayUrl(RELAY_BASE, RELAY_FORMAT);
    let headers, body;
    if (RELAY_FORMAT === 'openai') {
        headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RELAY_KEY}` };
        body = { model: RELAY_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature };
    } else {
        // 各家 CC 類渠道吃的認證 header 不同,x-api-key 與 Authorization 都送
        headers = { 'Content-Type': 'application/json', 'x-api-key': RELAY_KEY, 'Authorization': `Bearer ${RELAY_KEY}`, 'anthropic-version': '2023-06-01' };
        body = { model: RELAY_MODEL, max_tokens: maxTokens, temperature, messages: [{ role: 'user', content: prompt }] };
    }
    const r = await fetchTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) }, budget(deadline, 15000));
    if (!r.ok) { const e = new Error('relay_http_' + r.status); e.status = r.status; throw e; }
    const data = await r.json();
    if (RELAY_FORMAT === 'openai') return data.choices?.[0]?.message?.content || '';
    return (Array.isArray(data.content) ? data.content.filter(c => c && c.type === 'text').map(c => c.text).join('') : '') || '';
}

// ---- Groq 備援(原本的小鎮伺服器 AI)----
// v5.33.3 模型動態解析:Groq 汰換模型頻繁,寫死名稱遲早 404;查可用清單挑一個並快取於 lambda 內存
// v5.66.1 非推理模型優先(推理模型在小 max_tokens 下會把額度花在思考、content 回空)
const MODEL_PREFER = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'moonshotai/kimi-k2-instruct-0905', 'moonshotai/kimi-k2-instruct', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b']; // v5.66.3 120b 上線實測每次首發失敗,退回已驗證的 20b 優先
let _lastGroqModel = '';
let _modelCache = null;
async function resolveModel(apiKey, force = false, deadline = Date.now() + 8000) {
    if (_modelCache && !force) return _modelCache;
    try {
        const r = await fetchTimeout('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` } }, budget(deadline, 8000));
        if (r.ok) {
            const ids = ((await r.json()).data || []).map(m => m.id);
            let pick = MODEL_PREFER.find(p => ids.includes(p));
            if (!pick) pick = ids.find(id => !/whisper|tts|guard|embed|vision|scout|maverick/i.test(id));
            if (pick) { _modelCache = pick; return pick; }
        }
    } catch (e) {}
    return _modelCache || MODEL_PREFER[0];
}

// 呼叫 Groq;非 2xx / 例外 / 空回覆都會 throw(錯誤物件帶 status),讓分流退回另一條渠道
async function callGroq(apiKey, prompt, maxTokens, temperature, deadline = Date.now() + 12000) {
    const call = (model) => {
        _lastGroqModel = model;
        const body = { model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature };
        // v5.66.1 推理模型:壓低思考量,不要把小額度全花在推理上;qwen 系列把思考段藏起來
        // v5.66.4 推理模型的思考段會吃掉 max_tokens,小額度(如 20)必回空;Groq 免費不計成本,給最低 160 的餘裕
        if (/gpt-oss|qwen|deepseek/i.test(model)) body.max_tokens = Math.max(maxTokens, 160);
        if (/gpt-oss/i.test(model)) body.reasoning_effort = 'low';
        if (/qwen|deepseek/i.test(model)) body.reasoning_format = 'hidden';
        return fetchTimeout('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }, budget(deadline, 12000));
    };
    let r = await call(await resolveModel(apiKey, false, deadline));
    if (r.status === 404 && deadline - Date.now() > 3000) r = await call(await resolveModel(apiKey, true, deadline)); // 快取模型被下架 → 時間夠才重查重試
    _readGroqHeaders(r);
    if (!r.ok) {
        const e = new Error('groq_http_' + r.status); e.status = r.status;
        if (r.status === 429) { const ra = r.headers && r.headers.get ? _parseDuration(r.headers.get('retry-after')) : 0; if (ra) e.retryAfterMs = ra; }
        throw e;
    }
    const data = await r.json();
    let text = String(data.choices?.[0]?.message?.content || '');
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*/gi, '').trim();
    if (!text) { const e = new Error('groq_empty'); e.status = 502; throw e; } // 空回覆視同失敗 → 退回主渠道
    return text;
}

// 分流冷卻狀態(lambda 實例內存)
const _lane = { groqCooldownUntil: 0, relayCooldownUntil: 0, relayFailCount: 0 };

// v5.67.0 Groq 免費額度感知(免費層:30 RPM / 1K RPD / 8K TPM / 200K TPD,整個組織共用,不分玩家)
// 每次 Groq 回應都讀 x-ratelimit-* 標頭記下剩餘額度與重置時間;下一次請求先估算需要的 token,
// 不夠就直接走付費主渠道,不去撞 429;真的撞到 429 就照 retry-after 精準冷卻。
const _groqQuota = { remainingTokens: null, remainingRequests: null, tokensResetAt: 0, requestsResetAt: 0, at: 0 };
function _parseDuration(s) { // "2m59.56s" / "1h2m3s" / "500ms" / "7.5s" → 毫秒
    if (!s) return 0;
    let ms = 0; const str = String(s).trim();
    const re = /(\d+(?:\.\d+)?)(ms|h|m|s)/g; let m;
    while ((m = re.exec(str))) { const v = parseFloat(m[1]); ms += m[2] === 'h' ? v * 3600000 : m[2] === 'm' ? v * 60000 : m[2] === 's' ? v * 1000 : v; }
    if (!ms && /^\d+(\.\d+)?$/.test(str)) ms = parseFloat(str) * 1000; // 純數字視為秒
    return ms;
}
function _readGroqHeaders(r) {
    const h = r && r.headers && typeof r.headers.get === 'function' ? r.headers : null;
    if (!h) return;
    const rt = parseInt(h.get('x-ratelimit-remaining-tokens'), 10), rr = parseInt(h.get('x-ratelimit-remaining-requests'), 10);
    const now = Date.now();
    if (Number.isFinite(rt)) { _groqQuota.remainingTokens = rt; _groqQuota.tokensResetAt = now + _parseDuration(h.get('x-ratelimit-reset-tokens')); }
    if (Number.isFinite(rr)) { _groqQuota.remainingRequests = rr; _groqQuota.requestsResetAt = now + _parseDuration(h.get('x-ratelimit-reset-requests')); }
    _groqQuota.at = now;
}
// 粗估 token:中文約 1 字 1 token,英文約 4 字元 1 token;取偏保守的估法
function _estTokens(text) { const s = String(text || ''); const cjk = (s.match(/[\u3000-\u9fff\uf900-\ufaff]/g) || []).length; return Math.ceil(cjk + (s.length - cjk) / 4); }
// 這次請求 Groq 的額度夠不夠?回 null = 夠(或不知道),否則回原因字串
function _groqBudgetBlock(prompt, maxTokens) {
    const now = Date.now();
    const need = _estTokens(prompt) + Math.max(maxTokens, 160) + 50;
    if (_groqQuota.remainingRequests !== null && now < _groqQuota.requestsResetAt && _groqQuota.remainingRequests < 1) return 'groq_rpm_exhausted';
    if (_groqQuota.remainingTokens !== null && now < _groqQuota.tokensResetAt && _groqQuota.remainingTokens < need) return 'groq_tpm_low:' + _groqQuota.remainingTokens + '<' + need;
    return null;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return L.err(res, 405, 'method_not_allowed', 'POST only');
    const groqKey = process.env.GROQ_API_KEY || '';
    if (!RELAY_KEY && !groqKey) return L.err(res, 503, 'no_server_key', '伺服器 AI 未設定');

    const b = req.body || {};
    const prompt = String(b.prompt || '').slice(0, 6000);
    if (!prompt) return L.err(res, 400, 'missing_prompt', 'Missing prompt');
    const maxTokens = Math.min(600, Math.max(1, parseInt(b.max_tokens, 10) || 300));
    const temperature = Math.min(1.5, Math.max(0, parseFloat(b.temperature) || 0.9));

    // 額度身分:登入用帳號,訪客用 IP 雜湊
    const payload = L.authUser(req);
    if (payload && await L.isBanned(payload.u)) return L.err(res, 403, 'banned', '此帳號已被停用'); // v5.63.0
    const limit = payload ? USER_DAILY : GUEST_DAILY;
    const who = payload
        ? 'u_' + payload.u.toLowerCase()
        : 'g_' + crypto.createHash('sha1').update(L.clientIp(req)).digest('hex').slice(0, 16);
    const day = new Date().toISOString().slice(0, 10);
    const quotaPath = `quota/${day}/${who}.json`;

    const q = (await L.readJson(quotaPath)) || { count: 0 };
    if (q.count >= limit) {
        return L.err(res, 429, 'quota_exceeded',
            payload ? '今日 AI 對話額度已用完,明天再來吧!' : '訪客今日 AI 額度已用完,註冊登入可獲得更高額度!');
    }

    // v5.66.0 智慧分流:決定嘗試順序,逐一嘗試,失敗就記冷卻換下一個
    const lane = b.lane === 'chat' ? 'chat' : 'background';
    const now = Date.now();
    const deadline = now + 26000; // v5.66.5 兩條渠道共用 26 秒(函式上限 30 秒,留 4 秒給額度讀寫與回應)
    const candidates = [];
    const groqBlock = groqKey ? _groqBudgetBlock(prompt, maxTokens) : null; // v5.67.0 免費額度不夠 → 這次不優先用 Groq
    if (lane === 'chat') {
        if (groqKey && now >= _lane.groqCooldownUntil && !groqBlock) candidates.push('groq');
        if (RELAY_KEY) candidates.push('relay');
        if (groqKey && !candidates.includes('groq')) candidates.push('groq'); // 冷卻中/額度不足仍留作最後備援
    } else {
        if (RELAY_KEY && now >= _lane.relayCooldownUntil) candidates.push('relay');
        if (groqKey) candidates.push('groq');
        if (RELAY_KEY && !candidates.includes('relay')) candidates.push('relay');
    }

    let reply = '';
    let provider = '';
    let lastErr = null;
    const failed = []; // v5.66.3 記錄退回原因(回應與日誌都帶,方便線上診斷)
    for (const c of candidates) {
        if (deadline - Date.now() < 2000) { failed.push({ provider: c, model: '', error: 'no_time_left' }); continue; } // 預算用完就不再嘗試
        try {
            reply = c === 'groq'
                ? await callGroq(groqKey, prompt, maxTokens, temperature, deadline)
                : await callRelay(prompt, maxTokens, temperature, deadline);
            provider = c;
            if (c === 'relay' && _lane.relayFailCount) { _lane.relayFailCount = 0; _lane.relayCooldownUntil = 0; } // 中繼恢復
            break;
        } catch (e) {
            lastErr = e;
            failed.push({ provider: c, model: c === 'groq' ? _lastGroqModel : RELAY_MODEL, error: String(e && e.message || e).slice(0, 120) });
            console.warn('[chat] provider failed:', c, c === 'groq' ? _lastGroqModel : RELAY_MODEL, String(e && e.message || e).slice(0, 200));
            if (c === 'groq') {
                // v5.66.4 空回覆是單次現象,只退回這一次不冷卻;限流/故障(429/5xx/逾時)才冷卻 5 分鐘
                if (e && e.message !== 'groq_empty') _lane.groqCooldownUntil = Date.now() + (e.retryAfterMs ? Math.min(e.retryAfterMs, 6 * 3600000) : 300000); // v5.67.0 429 照 retry-after(上限 6 小時)
            } else {
                _lane.relayFailCount = Math.min(_lane.relayFailCount + 1, 5);
                _lane.relayCooldownUntil = Date.now() + 60000 * _lane.relayFailCount; // 60s × 次數,最多 5 分鐘
            }
        }
    }
    if (!provider) {
        if (lastErr && lastErr.status === 429) return L.err(res, 429, 'rate_limited', 'AI 忙碌中,請稍後再試');
        return L.err(res, 502, 'upstream_error', 'AI 服務暫時無法使用');
    }

    q.count += 1;
    await L.writeJson(quotaPath, q).catch(() => {}); // 額度寫入失敗不阻擋回覆

    const out = { reply, remaining: Math.max(0, limit - q.count), provider, lane, model: provider === 'groq' ? _lastGroqModel : RELAY_MODEL };
    if (failed.length) out.fallback_from = failed;
    if (groqBlock) out.groq_skipped = groqBlock;
    if (_groqQuota.at) out.groq_quota = { tokens: _groqQuota.remainingTokens, requests: _groqQuota.remainingRequests };
    return res.status(200).json(out);
};


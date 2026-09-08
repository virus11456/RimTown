// 小鎮伺服器 AI:代理 Groq,金鑰保管在伺服器端(env: GROQ_API_KEY)
// 每日額度:訪客(依 IP)20 則 / 登入玩家 100 則,記錄在 Blob quota/<日期>/<key>.json
const crypto = require('crypto');
const L = require('./_lib');

const GUEST_DAILY = 20;
const USER_DAILY = 100;
// v5.33.3 模型動態解析:Groq 汰換模型頻繁,寫死名稱遲早 404;查可用清單挑一個並快取於 lambda 內存
const MODEL_PREFER = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'moonshotai/kimi-k2-instruct'];
let _modelCache = null;

async function resolveModel(apiKey, force = false) {
    if (_modelCache && !force) return _modelCache;
    try {
        const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
        if (r.ok) {
            const ids = ((await r.json()).data || []).map(m => m.id);
            let pick = MODEL_PREFER.find(p => ids.includes(p));
            if (!pick) pick = ids.find(id => !/whisper|tts|guard|embed|vision|scout|maverick/i.test(id));
            if (pick) { _modelCache = pick; return pick; }
        }
    } catch (e) {}
    return _modelCache || MODEL_PREFER[0];
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return L.err(res, 405, 'method_not_allowed', 'POST only');
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return L.err(res, 503, 'no_server_key', '伺服器 AI 未設定');

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

    // 呼叫 Groq(模型動態解析;404 表示快取模型被下架 → 重查清單重試一次)
    let reply = '';
    try {
        const callGroq = (model) => fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature }),
        });
        let r = await callGroq(await resolveModel(apiKey));
        if (r.status === 404) r = await callGroq(await resolveModel(apiKey, true));
        if (r.status === 429) return L.err(res, 429, 'rate_limited', 'AI 忙碌中,請稍後再試');
        if (!r.ok) return L.err(res, 502, 'upstream_error', 'AI 服務暫時無法使用');
        const data = await r.json();
        reply = data.choices?.[0]?.message?.content || '';
    } catch (e) {
        return L.err(res, 502, 'upstream_error', 'AI 服務暫時無法使用');
    }

    q.count += 1;
    await L.writeJson(quotaPath, q).catch(() => {}); // 額度寫入失敗不阻擋回覆

    return res.status(200).json({ reply, remaining: Math.max(0, limit - q.count) });
};

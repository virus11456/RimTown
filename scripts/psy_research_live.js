// Anthropic research adapter for the loan-pair study. Network is OFF by default.
//
// What this file does:
//   - builds the Messages API body for each research stage (appraisal, choice, supplement, confirmation);
//   - sends it through the official SDK (@anthropic-ai/sdk, research/package.json) with retries, model fallback,
//     result cache and prompt cache all off;
//   - parses the reply, classifies technical failures (timeout, bad JSON, truncation, refusal, rate limit, server error);
//   - keeps a separate live ledger in nano-USD that reserves the worst-case cost before every send;
//   - records each request and raw reply so the batch can be replayed offline, labelled by source.
//
// What it never does on its own: open the network. A live send needs ALL gates in checkLive() to pass, including
// network.allowLive in the config (committed as false), the --live CLI flag, a per-batch confirmation env var,
// and an acknowledged input-token bound. A key in the environment, mode: live, or running the script is not enough.
// Credentials are read only from config.credentials.apiKeyEnv and are never written to records, ledgers or errors.
const fs = require('fs'), path = require('path');
const PSY = require('../chrome-extension/psy-core.js');
const { createEvaluator, run, Budget } = require('./psy_research.js');
const clone = PSY.clone;
const SDK_DIR = path.join(__dirname, '../research/node_modules/@anthropic-ai/sdk');
const loadSdk = () => require(SDK_DIR);
const sdkVersion = () => { try { return JSON.parse(fs.readFileSync(path.join(SDK_DIR, 'package.json'), 'utf8')).version; } catch (e) { return null; } };
const LIVE = 'LIVE_ANTHROPIC', FAKE = 'FAKE_PROVIDER_FORMAT', REPLAY = 'REPLAY_LIVE_RECORDING';
const POLICY = { maxRequests: 60, maxConcurrency: 1, maxOutputTokens: 4096, retries: 0, maxCostNanoUSD: 5000000000 };

// ---------------- request body ----------------
// One independent single-turn request per stage: no prior conversation, no cache_control, no sampling or thinking
// parameters (official defaults apply), no fallbacks. The stage request (contract, instruction, frozen input,
// appraisal/proposal when the stage needs them) is the only user content.
const SYSTEM = [
    '你在一個研究用的小鎮模擬裡，替輸入資料中 self 所指的那位村民思考一件事。',
    '只能使用輸入裡給的資料（本人知道的事實、記憶、聽到的話、本人狀態）；沒有給的就是不知道。',
    '這件事沒有預設的正確答案，也沒有人期待你選哪一個；照這位村民自己的處境與在乎的事來判斷即可。',
    '依照 instruction 只回一個 JSON 物件，不要加任何說明文字或 Markdown。引用資料時使用輸入裡的 id。',
].join('\n');
function buildWire(config, request) {
    const payload = { protocol: request.protocol, contract: request.contract, stage: request.stage, instruction: request.instruction, input: request.input, ...(request.appraisal ? { appraisal: request.appraisal } : {}), ...(request.proposal ? { proposal: request.proposal } : {}) };
    return { model: config.model, max_tokens: config.maxOutputTokens, system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(payload) }] };
}

// ---------------- reply parsing ----------------
// Anything other than a complete, single JSON object from the requested model is a technical failure.
function parseMessage(msg, model) {
    if (!msg || msg.type !== 'message') return { fail: 'bad_response' };
    if (msg.model !== model) return { fail: 'model_mismatch' };
    if (msg.stop_reason === 'max_tokens') return { fail: 'truncated' };
    if (msg.stop_reason === 'refusal') return { fail: 'refusal', detail: msg.stop_details?.category ?? null };
    if (msg.stop_reason !== 'end_turn') return { fail: 'unexpected_stop:' + msg.stop_reason };
    let text = (msg.content || []).filter(b => b && b.type === 'text').map(b => b.text).join('').trim();
    const fence = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/); if (fence) text = fence[1].trim();
    try { const v = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) return { fail: 'bad_json' }; return { value: v }; } catch (e) { return { fail: 'bad_json' }; }
}
// SDK error -> technical failure code. No usage arrives with these, so the full reservation stays charged.
function classifyError(e, A) {
    if (e instanceof A.APIConnectionTimeoutError) return 'timeout';
    if (e instanceof A.RateLimitError) return 'rate_limited';
    if (e instanceof A.OverloadedError || e instanceof A.InternalServerError || e instanceof A.ServiceUnavailableError || e instanceof A.GatewayTimeoutError) return 'server_error';
    if (e instanceof A.AuthenticationError || e instanceof A.PermissionDeniedError) return 'auth_error';
    if (e instanceof A.BadRequestError) return 'invalid_request';
    if (e instanceof A.APIConnectionError) return 'network_error';
    if (e instanceof A.APIError) return 'api_error_' + (e.status ?? 'unknown');
    return 'transport_error';
}
const KEYISH = /sk-ant-[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._-]+/g;
function scrub(v, secrets) { let s = typeof v === 'string' ? v : JSON.stringify(v); if (s === undefined) return v; for (const x of secrets) if (x) s = s.split(x).join('[REDACTED]'); s = s.replace(KEYISH, '[REDACTED]'); return typeof v === 'string' ? s : JSON.parse(s); }

// ---------------- live ledger (nano-USD) ----------------
// Separate from the fixture ledger. Every send reserves the worst case first:
//   input bound  = UTF-8 bytes of the request body + overhead tokens (assumption: a billed token covers at least one byte),
//                  priced at the highest input rate (1h cache write) in case anything is cached unexpectedly;
//   output bound = max_tokens (thinking tokens count toward max_tokens and are billed as output), at the output rate;
//   both times the worst data-residency multiplier (inference_geo "us" = 1.1x).
// Settlement uses the provider usage; missing usage, errors, timeouts and crashes keep the reservation.
class LiveBudget {
    constructor(config, saved = null, persist = () => {}, kind = 'anthropic_live') {
        this.kind = kind; this.c = { batchId: config.batchId, model: config.model, maxRequests: config.maxRequests, maxCostNanoUSD: config.maxCostNanoUSD, maxOutputTokens: config.maxOutputTokens, overheadTokens: config.inputBound.overheadTokens, pricing: clone(config.pricing) };
        this.calls = 0; this.charged = 0; this.locked = false; this.ledger = [];
        const P = this.c.pricing; for (const n of [this.c.maxRequests, this.c.maxCostNanoUSD, this.c.maxOutputTokens, this.c.overheadTokens, P.input, P.output, P.cacheWrite5m, P.cacheWrite1h, P.cacheRead]) if (!Number.isSafeInteger(n) || n < 0) throw new Error('invalid_live_budget_config');
        if (saved) {
            if (saved.kind !== kind) throw new Error('journal_kind_mismatch');
            if (PSY.hashOf(saved.config) !== PSY.hashOf(this.c) || !Array.isArray(saved.ledger) || saved.ledger.length !== saved.calls || saved.ledger.reduce((s, r) => s + r.chargedNanos, 0) !== saved.charged) throw new Error('invalid_live_journal');
            this.calls = saved.calls; this.charged = saved.charged; this.locked = !!saved.locked; this.ledger = clone(saved.ledger);
            // A reservation left open by a crash or kill: the request may have been billed. Keep it charged.
            for (const r of this.ledger) if (r.status === 'reserved') r.status = 'interrupted_reserved';
        }
        this._persist = persist; this.persist();
    }
    persist() { this._persist({ kind: this.kind, config: this.c, calls: this.calls, charged: this.charged, locked: this.locked, ledger: this.ledger }); }
    geo(g) { const G = this.c.pricing.geo || {}; return (g && G[g]) || this.c.pricing.worstGeo; }
    costOf(inputTokens, outputTokens, geo) { const P = this.c.pricing; const [n, d] = geo; const raw = inputTokens * Math.max(P.input, P.cacheWrite5m, P.cacheWrite1h) + outputTokens * P.output; return Math.ceil(raw * n / d); }
    reserve(wire) {
        if (this.locked) throw new Error('budget_locked');
        if (this.ledger.some(r => r.status === 'reserved')) throw new Error('concurrent_request_open'); // at most one request in flight
        if (this.calls >= this.c.maxRequests) throw new Error('budget_limit_requests');
        const inputTokens = Buffer.byteLength(JSON.stringify(wire), 'utf8') + this.c.overheadTokens; const outputTokens = wire.max_tokens;
        if (outputTokens !== this.c.maxOutputTokens) throw new Error('budget_output_bound_mismatch');
        const cost = this.costOf(inputTokens, outputTokens, this.c.pricing.worstGeo);
        if (!Number.isSafeInteger(cost) || this.charged + cost > this.c.maxCostNanoUSD) throw new Error('budget_limit_cost');
        const row = { call: ++this.calls, reservedInputTokens: inputTokens, reservedOutputTokens: outputTokens, reservedNanos: cost, chargedNanos: cost, status: 'reserved', at: new Date().toISOString() };
        this.charged += cost; this.ledger.push(row); this.persist(); return row;
    }
    settle(row, usage) {
        if (!this.ledger.includes(row) || row.status !== 'reserved') throw new Error('reservation_not_open');
        const int = (x) => Number.isSafeInteger(x) && x >= 0; const opt = (x) => (x == null ? 0 : x);
        if (!usage || !int(usage.input_tokens) || !int(usage.output_tokens) || ![usage.cache_creation_input_tokens, usage.cache_read_input_tokens].every(x => x == null || int(x))) { row.status = 'usage_unknown'; this.persist(); return; }
        const P = this.c.pricing; const cw = opt(usage.cache_creation_input_tokens), cr = opt(usage.cache_read_input_tokens);
        const cw5 = Math.min(cw, opt(usage.cache_creation?.ephemeral_5m_input_tokens)); const cw1 = cw - cw5; const [n, d] = this.geo(usage.inference_geo);
        const actual = Math.ceil((usage.input_tokens * P.input + cw5 * P.cacheWrite5m + cw1 * P.cacheWrite1h + cr * P.cacheRead + usage.output_tokens * P.output) * n / d);
        row.usage = clone(usage);
        const tools = usage.server_tool_use || {}; const unexpected = (tools.web_search_requests > 0) || (tools.web_fetch_requests > 0) || usage.speed === 'fast' || usage.service_tier === 'priority' || usage.service_tier === 'batch';
        if (unexpected) { this.charged += Math.max(0, actual - row.chargedNanos); row.chargedNanos = Math.max(actual, row.chargedNanos); row.status = 'unexpected_billing'; this.locked = true; this.persist(); throw new Error('unexpected_billing'); }
        if (usage.input_tokens + cw + cr > row.reservedInputTokens || usage.output_tokens > row.reservedOutputTokens || actual > row.reservedNanos) {
            this.charged += Math.max(0, actual - row.chargedNanos); row.chargedNanos = Math.max(actual, row.chargedNanos); row.status = 'usage_exceeded_reservation'; this.locked = true; this.persist(); throw new Error('usage_exceeded_reservation');
        }
        this.charged -= row.reservedNanos - actual; row.chargedNanos = actual; row.status = 'settled'; this.persist();
    }
}
// Replay spends nothing and never touches a live or fake-provider ledger.
class ReplayBudget { constructor() { this.calls = 0; this.charged = 0; this.locked = false; this.ledger = []; } reserve() { const row = { call: ++this.calls, chargedNanos: 0, status: 'replay' }; this.ledger.push(row); return row; } settle() {} persist() {} }

// ---------------- gates ----------------
function checkLive(config, { env = process.env, cliLive = false } = {}) {
    const b = []; const C = config || {};
    if (C.provider !== 'anthropic') b.push('provider_not_anthropic');
    if (C.baseURL !== 'https://api.anthropic.com') b.push('base_url_not_official');
    if (C.model !== 'claude-sonnet-5-5') b.push('model_not_claude-sonnet-5-5');
    if (C.network?.allowLive !== true) b.push('network_gate_closed');
    if (!cliLive) b.push('cli_live_flag_missing');
    if (!C.batchId || env[C.network?.confirmEnv || 'RIMTOWN_RESEARCH_LIVE_CONFIRM'] !== C.batchId) b.push('live_confirmation_missing');
    if (!env[C.credentials?.apiKeyEnv || 'RIMTOWN_RESEARCH_API_KEY']) b.push('api_key_env_missing');
    if (env.ANTHROPIC_CUSTOM_HEADERS) b.push('custom_headers_env_set');
    if (C.inputBound?.method !== 'utf8_bytes_plus_overhead' || C.inputBound?.assumptionAcknowledged !== true) b.push('input_bound_assumption_unacknowledged');
    if (!(C.maxRequests > 0 && C.maxRequests <= POLICY.maxRequests)) b.push('limit:maxRequests');
    if (C.maxConcurrency !== POLICY.maxConcurrency) b.push('limit:maxConcurrency');
    if (!(C.maxOutputTokens > 0 && C.maxOutputTokens <= POLICY.maxOutputTokens)) b.push('limit:maxOutputTokens');
    if (!(C.maxCostNanoUSD > 0 && C.maxCostNanoUSD <= POLICY.maxCostNanoUSD)) b.push('limit:maxCostNanoUSD');
    if (C.retries !== 0) b.push('limit:retries');
    if (C.modelFallback !== false) b.push('limit:modelFallback');
    if (C.resultCache !== false) b.push('limit:resultCache');
    if (C.promptCache !== false) b.push('limit:promptCache');
    for (const k of Object.keys(C.providerSettings || {})) b.push('unsupported_provider_setting:' + k); // official defaults this round; not dropped silently
    if (!C.pricing?.verifiedOn || C.pricing?.model !== C.model) b.push('pricing_unverified');
    if (sdkVersion() !== C.sdkVersion) b.push('sdk_version_mismatch');
    return b;
}

// ---------------- transports ----------------
// kind LIVE: real network, only after checkLive() passes. kind FAKE: same SDK path, but the caller must inject fetch
// (offline provider-format responses); the SDK gets a placeholder credential, never a real key.
function createProviderTransport(config, { kind = FAKE, fetch = null, env = process.env, cliLive = false } = {}) {
    const A = loadSdk(); const Client = A.default || A.Anthropic;
    let apiKey, doFetch, secrets = [];
    if (kind === LIVE) {
        const blockers = checkLive(config, { env, cliLive });
        if (blockers.length) throw Object.assign(new Error('live_blocked'), { blockers });
        apiKey = env[config.credentials.apiKeyEnv]; secrets = [apiKey];
        const base = config.baseURL + '/v1/messages';
        doFetch = (url, init) => { if (String(url).split('?')[0] !== base) throw new Error('unexpected_endpoint'); return globalThis.fetch(url, init); }; // Messages only: no models, no count_tokens
    } else if (kind === FAKE) {
        if (typeof fetch !== 'function') throw new Error('fake_provider_requires_injected_fetch');
        apiKey = 'offline-placeholder-not-a-key'; doFetch = fetch;
    } else throw new Error('unknown_transport_kind');
    const wsEnv = config.credentials?.workspaceIdEnv; const workspaceId = (wsEnv && env[wsEnv]) || config.credentials?.workspaceId || null;
    const client = new Client({ apiKey, baseURL: config.baseURL, maxRetries: 0, timeout: config.sdkTimeoutMs, logLevel: 'off', logger: { debug() {}, info() {}, warn() {}, error() {} }, fetch: doFetch, defaultHeaders: workspaceId ? { 'anthropic-workspace-id': workspaceId } : {} });
    return { kind, source: kind, verified: true, evaluatorId: 'anthropic-research', evaluatorVersion: config.model, prepare: (request) => buildWire(config, request),
        async send(request, wire) {
            try {
                const { data, response, request_id } = await client.messages.create(wire).withResponse();
                const raw = scrub(JSON.parse(JSON.stringify(data)), secrets); const p = parseMessage(raw, config.model);
                const meta = { request_id: request_id ?? null, http_status: response.status, response_model: raw.model ?? null, stop_reason: raw.stop_reason ?? null, stop_detail: p.detail ?? null, api_version_sent: 'set by SDK ' + sdkVersion(), thinking_tokens: raw.usage?.output_tokens_details?.thinking_tokens ?? null };
                return p.fail ? { fail: p.fail, usage: raw.usage, raw, meta } : { value: p.value, usage: raw.usage, raw, meta };
            } catch (e) {
                const code = classifyError(e, A);
                throw Object.assign(new Error(code), { fail: code, meta: { http_status: e.status ?? null, request_id: e.requestID ?? null, error_type: e.error?.error?.type ?? e.constructor?.name ?? null, message: scrub(String(e.message || ''), secrets).slice(0, 300) }, raw: e.error ? scrub(e.error, secrets) : null });
            }
        } };
}
// Offline replay of provider-format recordings, in the original order, checked against the full request and body.
function replayLiveTransport(config, records) {
    let next = 0;
    return { kind: REPLAY, source: REPLAY, verified: true, evaluatorId: 'anthropic-research', evaluatorVersion: config.model, prepare: (request) => buildWire(config, request),
        async send(request, wire) {
            const row = records[next++];
            if (!row || row.fixture || ![LIVE, FAKE].includes(row.source)) throw Object.assign(new Error('replay_source_mismatch'), { fail: 'replay_source_mismatch' });
            if (row.request_hash !== PSY.hashOf(request) || row.wire_hash !== PSY.hashOf(wire)) throw Object.assign(new Error('replay_mismatch'), { fail: 'replay_mismatch' });
            const meta = Object.assign(clone(row.provider || {}), { replayed_from: row.source, replayed_call: row.call });
            if (!row.raw || row.raw.type !== 'message') throw Object.assign(new Error(row.error || 'replay_failed_record'), { fail: row.error || 'replay_failed_record', meta });
            const p = parseMessage(row.raw, config.model);
            return p.fail ? { fail: p.fail, usage: row.raw.usage, raw: row.raw, meta } : { value: p.value, usage: row.raw.usage, raw: row.raw, meta };
        } };
}

// ---------------- offline provider-format responder (dry runs and tests only) ----------------
// Returns Messages API shaped JSON. The content is handwritten plumbing, labelled as such; not character behaviour.
function fakeProviderFetch(responder, calls = []) {
    return async (url, init) => {
        const body = JSON.parse(init.body); const payload = JSON.parse(body.messages[0].content); calls.push({ url: String(url), body, headers: Object.fromEntries(new Headers(init.headers)) });
        const out = await responder(payload, body, calls.length);
        if (out instanceof Response) return out;
        const text = typeof out.text === 'string' ? out.text : JSON.stringify(out.value);
        const msg = { id: 'msg_fake_' + calls.length, type: 'message', role: 'assistant', model: out.model || body.model, content: [{ type: 'thinking', thinking: '', signature: 'fake-signature' }, { type: 'text', text }], stop_reason: out.stop_reason || 'end_turn', stop_sequence: null, stop_details: out.stop_details || null,
            usage: Object.assign({ input_tokens: Math.ceil(Buffer.byteLength(init.body) / 3), output_tokens: 150, output_tokens_details: { thinking_tokens: 60 }, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, inference_geo: 'global', service_tier: 'standard', speed: 'standard' }, out.usage || {}) };
        return new Response(JSON.stringify(msg), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_fake_' + calls.length } });
    };
}
// Same handwritten plumbing answer as the fixture transport: appraise refuse only, choose refuse.
function plumbingResponder(payload) {
    const input = payload.input;
    if (payload.stage === 'appraisal') return { value: { contract: 1, concerns: [{ id: 'c1', what: '考慮手上的錢', ev: ['s_cash'] }], reading: { what: '朋友提出借款請求', unsure: ['未來還款不確定'] }, impacts: [{ opt: 'refuse', expect: [{ what: '錢留在身上', who: [input.self.id], status: 'derived', ev: ['s_cash'] }], like: ['c1'], dislike: [], unsure: [] }], not_considered: input.options.filter(o => o.opt !== 'refuse').map(o => ({ opt: o.opt, why: 'FAKE_PROVIDER_FORMAT 流程測試未評估' })) } };
    return { value: { contract: 1, opt: 'refuse', params: {}, because: ['c1'], accept: [], left: [], public: '', private: '', commit: null, act: { opt: 'refuse' } } };
}

// ---------------- batch files ----------------
function withBatchLock(dir, fn) {
    fs.mkdirSync(dir, { recursive: true }); const lock = path.join(dir, 'batch.lock'); let fd;
    try { fd = fs.openSync(lock, 'wx'); } catch (e) { if (e.code === 'EEXIST') throw new Error('batch_locked'); throw e; }
    const done = () => { fs.closeSync(fd); fs.unlinkSync(lock); };
    let r; try { r = fn(); } catch (e) { done(); throw e; }
    if (r && typeof r.then === 'function') return r.finally(done); done(); return r;
}
function journalBudget(dir, config, kind) {
    const file = path.join(dir, 'ledger.json'); const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    return new LiveBudget(config, saved, (state) => { fs.writeFileSync(file + '.tmp', JSON.stringify(state, null, 2)); fs.renameSync(file + '.tmp', file); }, kind);
}
module.exports = { LIVE, FAKE, REPLAY, POLICY, SYSTEM, buildWire, parseMessage, classifyError, scrub, LiveBudget, ReplayBudget, checkLive, createProviderTransport, replayLiveTransport, fakeProviderFetch, plumbingResponder, withBatchLock, journalBudget, sdkVersion };

// CLI (repo root):
//   node scripts/psy_research_live.js --check            gate report only; no network
//   node scripts/psy_research_live.js --fake-provider    offline dry run through the SDK path; separate ledger
//   node scripts/psy_research_live.js --replay <run.json> offline replay of a recorded provider-format run
//   node scripts/psy_research_live.js --live             refused unless every gate in checkLive() passes
if (require.main === module) {
    const argv = process.argv.slice(2); const cfgPath = 'research/anthropic-research.json';
    const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); const dataset = JSON.parse(fs.readFileSync('research/loan-pairs.json', 'utf8'));
    const report = (o) => console.log(JSON.stringify(o));
    (async () => {
        if (argv.includes('--check')) { report({ live_blockers: checkLive(config, { cliLive: argv.includes('--live') }), sdk: sdkVersion() }); return; }
        if (argv.includes('--replay')) {
            const src = JSON.parse(fs.readFileSync(argv[argv.indexOf('--replay') + 1], 'utf8'));
            const r = await run(dataset, config, replayLiveTransport(config, src.calls), new ReplayBudget(), { timeoutMs: config.stageTimeoutMs });
            report({ replayed_calls: r.calls.length, same_evaluations: PSY.stable(r.evaluations) === PSY.stable(src.evaluations), stopped: r.stopped }); return;
        }
        const live = argv.includes('--live'), fake = argv.includes('--fake-provider');
        if (live === fake) { console.error('choose one of --check, --fake-provider, --replay <file>, --live'); process.exitCode = 2; return; }
        if (live) { const blockers = checkLive(config, { cliLive: true }); if (blockers.length) { report({ live: 'refused', blockers }); process.exitCode = 3; return; } }
        const dir = path.join('test-results', live ? 'loan-research-live' : 'loan-research-fake-provider', config.batchId);
        await withBatchLock(dir, async () => {
            const budget = journalBudget(dir, config, live ? 'anthropic_live' : 'fake_provider');
            const transport = live ? createProviderTransport(config, { kind: LIVE, cliLive: true }) : createProviderTransport(config, { kind: FAKE, fetch: fakeProviderFetch(plumbingResponder) });
            const result = await run(dataset, config, transport, budget, { timeoutMs: config.stageTimeoutMs });
            const out = fs.mkdtempSync(path.join(dir, 'run-')); fs.writeFileSync(path.join(out, 'run.json'), JSON.stringify(result, null, 2) + '\n');
            report({ out, source: transport.source, evaluations: result.evaluations.length, calls: result.calls.length, chargedNanoUSD: budget.charged, ledgerCalls: budget.calls, stopped: result.stopped });
        });
    })().catch(e => { console.error(e.message === 'batch_locked' ? 'batch_locked: another process holds ' + config.batchId : e.message); process.exitCode = 1; });
}

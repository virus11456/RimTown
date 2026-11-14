// Offline tests for the Anthropic research adapter. No provider API request is made: every SDK call goes through an
// injected fake fetch that returns Messages API shaped responses, and the global fetch is a tripwire that throws.
// Fixed responses only exercise plumbing. No test treats a particular option as the correct answer.
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const PSY = require('../chrome-extension/psy-core.js');
const { run, replayTransport, Budget } = require('./psy_research.js');
const L = require('./psy_research_live.js');
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, '../research/anthropic-research.json'), 'utf8'));
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '../research/loan-pairs.json'), 'utf8'));
const FIXCFG = JSON.parse(fs.readFileSync(path.join(__dirname, '../research/config.json'), 'utf8'));
for (const k of ['RIMTOWN_RESEARCH_API_KEY', 'RIMTOWN_RESEARCH_LIVE_CONFIRM', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']) delete process.env[k]; // runs with no key at all
let netCalls = 0; globalThis.fetch = () => { netCalls++; throw new Error('network_forbidden_in_offline_test'); };
let checks = 0; const check = async (name, fn) => { await fn(); checks++; console.log('PASS ' + name); };
const cfg = (o = {}) => Object.assign(PSY.clone(BASE), { sdkTimeoutMs: 2000, stageTimeoutMs: 5000 }, o);
const one = { ...DATA, cases: [DATA.cases[0]], repeats: 1 };
const fake = (responder, calls = [], c = cfg()) => L.createProviderTransport(c, { kind: L.FAKE, fetch: L.fakeProviderFetch(responder, calls) });
const mem = (c = cfg()) => new L.LiveBudget(c);
const errResp = (status, type, message = 'm') => new Response(JSON.stringify({ type: 'error', error: { type, message }, request_id: 'req_err' }), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_err' } });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'psy-live-'));
// 在執行時組出假金鑰，避免原始碼本身被秘密掃描誤判；這不是真的金鑰。
const FAKE_KEY = ['sk', 'ant', 'api03', 'OFFLINE', 'TEST', 'VALUE', 'NOT', 'A', 'REAL', 'KEY', '0000'].join('-');

// Responders for the supplement / confirmation paths (handwritten plumbing, different outcomes on purpose)
const notConsidered = (input, keep) => input.options.filter(o => !keep.includes(o.opt)).map(o => ({ opt: o.opt, why: '流程測試未評估' }));
const appraisal30 = (input) => ({ contract: 1, concerns: [{ id: 'c1', what: '手上的錢', ev: ['s_cash'] }, { id: 'c2', what: '對方開口', ev: ['o_req'] }], reading: { what: '朋友來借錢', unsure: [] },
    impacts: [{ opt: 'lend', params: { amount: 30 }, expect: [{ what: '借出 30 後剩 20', who: [input.self.id], status: 'derived', ev: ['d_after_req'] }], like: ['c2'], dislike: ['c1'], unsure: [] }, { opt: 'refuse', expect: [{ what: '錢留著', who: [input.self.id], status: 'derived', ev: ['s_cash'] }], like: ['c1'], dislike: ['c2'], unsure: [] }],
    not_considered: notConsidered(input, ['lend', 'refuse']) });
const choice = (opt, amount) => ({ contract: 1, opt, params: amount ? { amount } : {}, because: ['c1'], accept: [], left: [], public: '', private: '', commit: null, act: amount ? { opt, amount } : { opt } });
const supplementFlow = (confirm) => (p) => {
    if (p.stage === 'appraisal') return { value: appraisal30(p.input) };
    if (p.stage === 'choice') return { value: choice('lend', 10) }; // not evaluated yet -> supplement
    if (p.stage === 'supplement') return { value: { impacts: [{ opt: 'lend', params: { amount: 10 }, expect: [{ what: '借出 10 後剩 40', who: [p.input.self.id], status: 'derived', ev: ['s_cash'] }], like: ['c1', 'c2'], dislike: [], unsure: [] }] } };
    return { value: confirm };
};

(async () => {
    await check('official settings recorded: model id, base URL, API version, SDK pin, no sampling/thinking params', async () => {
        assert.equal(BASE.model, 'claude-sonnet-5-5'); assert.equal(BASE.baseURL, 'https://api.anthropic.com'); assert.equal(BASE.apiVersion, '2026-10-21'); assert.equal(L.sdkVersion(), BASE.sdkVersion);
        assert.deepEqual(BASE.providerSettings, {}); assert.equal(BASE.retries, 0); assert.equal(BASE.modelFallback, false); assert.equal(BASE.resultCache, false); assert.equal(BASE.promptCache, false);
        assert.equal(BASE.maxRequests, 60); assert.equal(BASE.maxConcurrency, 1); assert.equal(BASE.maxOutputTokens, 4096); assert.equal(BASE.maxCostNanoUSD, 5e9);
        assert.deepEqual([BASE.pricing.input, BASE.pricing.output, BASE.pricing.cacheWrite5m, BASE.pricing.cacheWrite1h, BASE.pricing.cacheRead], [2000, 10000, 2500, 4000, 100]);
    });

    await check('gates closed by default: key present, --live, or confirmation alone do not open the network', async () => {
        const env = { RIMTOWN_RESEARCH_API_KEY: FAKE_KEY };
        for (const opts of [{ env }, { env, cliLive: true }, { env: { ...env, RIMTOWN_RESEARCH_LIVE_CONFIRM: BASE.batchId }, cliLive: true }]) {
            const b = L.checkLive(BASE, opts); assert(b.includes('network_gate_closed') && b.includes('input_bound_assumption_unacknowledged'), b.join());
            assert.throws(() => L.createProviderTransport(BASE, { kind: L.LIVE, ...opts }), (e) => e.message === 'live_blocked' && !JSON.stringify(e).includes(FAKE_KEY));
        }
        assert.throws(() => L.createProviderTransport({ ...BASE, mode: 'live' }, { kind: L.LIVE, env }), /live_blocked/);
        assert.equal(netCalls, 0);
    });

    await check('every gate is needed: opening all but one still blocks', async () => {
        const open = { ...cfg(), network: { ...BASE.network, allowLive: true }, inputBound: { ...BASE.inputBound, assumptionAcknowledged: true } };
        const env = { RIMTOWN_RESEARCH_API_KEY: FAKE_KEY, RIMTOWN_RESEARCH_LIVE_CONFIRM: BASE.batchId };
        assert.deepEqual(L.checkLive(open, { env, cliLive: true }), []);
        const breakers = [[{ network: { ...BASE.network } }, {}, 'network_gate_closed'], [{}, { cliLive: false }, 'cli_live_flag_missing'], [{}, { env: { ...env, RIMTOWN_RESEARCH_LIVE_CONFIRM: 'other-batch' } }, 'live_confirmation_missing'],
            [{ inputBound: BASE.inputBound }, {}, 'input_bound_assumption_unacknowledged'], [{ providerSettings: { temperature: 0.2 } }, {}, 'unsupported_provider_setting:temperature'], [{ retries: 2 }, {}, 'limit:retries'], [{ maxRequests: 61 }, {}, 'limit:maxRequests'],
            [{ modelFallback: true }, {}, 'limit:modelFallback'], [{ maxConcurrency: 2 }, {}, 'limit:maxConcurrency'], [{ maxOutputTokens: 8192 }, {}, 'limit:maxOutputTokens'], [{ model: 'claude-opus-5-5' }, {}, 'model_not_claude-sonnet-5-5'], [{ baseURL: 'https://rimtown.cc/api/chat' }, {}, 'base_url_not_official'], [{}, { env: { ...env, ANTHROPIC_CUSTOM_HEADERS: 'x: y' } }, 'custom_headers_env_set']];
        for (const [c, o, code] of breakers) assert(L.checkLive({ ...open, ...c }, { env, cliLive: true, ...o }).includes(code), code);
        // With every gate open, the live transport is created but nothing is sent in this test
        const t = L.createProviderTransport(open, { kind: L.LIVE, env, cliLive: true }); assert.equal(t.kind, L.LIVE); assert.equal(netCalls, 0);
    });

    const calls = [];
    const normal = await run(one, cfg(), fake(L.plumbingResponder, calls), mem());
    await check('request body: one independent user turn, official defaults, no cache or fallback; auth header only on the wire', async () => {
        assert.equal(normal.evaluations[0].result.status, 'done'); assert.equal(calls.length, 2);
        for (const c of calls) {
            assert.equal(c.url, 'https://api.anthropic.com/v1/messages'); assert.equal(c.headers['anthropic-version'], '2026-10-21'); assert(/^Bearer /.test(c.headers.authorization));
            assert.deepEqual(Object.keys(c.body).sort(), ['max_tokens', 'messages', 'model', 'system']); assert.equal(c.body.model, 'claude-sonnet-5-5'); assert.equal(c.body.max_tokens, 4096);
            assert.equal(c.body.messages.length, 1); assert.equal(c.body.messages[0].role, 'user'); assert(!JSON.stringify(c.body).includes('cache_control'));
            const payload = JSON.parse(c.body.messages[0].content); assert(!('case_id' in payload) && !('repeat' in payload) && !('audit' in payload) && !('provider_settings' in payload));
        }
        assert(!JSON.stringify(normal.calls).match(/Bearer|authorization|offline-placeholder/i), 'records carry no auth');
    });

    for (const [label, confirm, status, final] of [['maintain', choice('lend', 10), 'done', 'lend'], ['modify', choice('refuse'), 'done', 'refuse'], ['withdraw', { withdraw: true }, 'withdrawn', null]]) {
        const cs = []; const r = await run(one, cfg(), fake(supplementFlow(confirm), cs), mem());
        await check('four stages through one interface and budget: supplement then ' + label, async () => {
            const res = r.evaluations[0].result; assert.equal(res.status, status, JSON.stringify(res.tries)); assert.deepEqual(r.calls.map(c => c.request.stage), ['appraisal', 'choice', 'supplement', 'confirmation']);
            assert.equal(r.budget.calls, 4); assert(r.budget.ledger.every(x => x.status === 'settled')); assert.equal(cs.length, 4);
            if (final) assert.equal(res.choice.opt, final); else assert.equal(res.choice, null);
            assert.equal(res.initial_choice.opt, 'lend'); assert(res.order.includes('appraisal#2'));
        });
    }

    const stageFail = (make) => async (p) => (p.stage === 'appraisal' ? make() : L.plumbingResponder(p));
    const cases = [
        ['fenced JSON is accepted', () => ({ text: '```json\n' + JSON.stringify(L.plumbingResponder({ stage: 'appraisal', input: DATA.cases[0].input }).value) + '\n```' }), 'done', null],
        ['prose around JSON is bad_json', () => ({ text: '好的，以下是評估：{"contract":1}' }), 'pending', 'bad_json@appraisal'],
        ['non-object JSON is bad_json', () => ({ text: '[1,2]' }), 'pending', 'bad_json'],
        ['max_tokens stop is truncated (usage still settled)', () => ({ text: '{"contract":1,"conc', stop_reason: 'max_tokens', usage: { output_tokens: 4096, output_tokens_details: { thinking_tokens: 4000 } } }), 'pending', 'truncated'],
        ['refusal is technical, not a choice', () => ({ text: '', stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } }), 'pending', 'refusal'],
        ['other model in reply is model_mismatch', () => ({ value: {}, model: 'claude-sonnet-5' }), 'pending', 'model_mismatch'],
    ];
    for (const [name, make, status, fail] of cases) {
        const cs = []; const r = await run(one, cfg(), fake(stageFail(make), cs), mem());
        await check('parse: ' + name, async () => {
            const res = r.evaluations[0].result; assert.equal(res.status, status, JSON.stringify(res.tries)); if (fail) { assert(String(res.fail).startsWith(fail.split('@')[0]), res.fail); assert.equal(res.choice, null); }
            assert.equal(cs.length, status === 'done' ? 2 : 1); assert.equal(r.budget.ledger[0].status, 'settled');
            if (name.startsWith('max_tokens')) assert.equal(r.calls[0].provider.thinking_tokens, 4000);
        });
    }

    const errs = [['429 rate limit', () => errResp(429, 'rate_limit_error'), 'rate_limited'], ['500 server', () => errResp(500, 'api_error'), 'server_error'], ['529 overloaded', () => errResp(529, 'overloaded_error'), 'server_error'],
        ['400 invalid request', () => errResp(400, 'invalid_request_error'), 'invalid_request'], ['401 auth (echoed key is scrubbed)', () => errResp(401, 'authentication_error', 'bad key ' + FAKE_KEY), 'auth_error'],
        ['network failure', () => { throw new TypeError('fetch failed'); }, 'network_error']];
    for (const [name, make, code] of errs) {
        let n = 0; const t = L.createProviderTransport(cfg(), { kind: L.FAKE, fetch: async () => { n++; return make(); } }); const r = await run(one, cfg(), t, mem());
        await check('error: ' + name + ' -> ' + code + ', one attempt, reservation kept, no choice', async () => {
            const res = r.evaluations[0].result; assert.equal(res.fail, code); assert.equal(res.choice, null); assert.equal(n, 1);
            assert.equal(r.budget.ledger[0].status, 'failed_reserved'); assert.equal(r.budget.charged, r.budget.ledger[0].reservedNanos); assert(!JSON.stringify(r.calls).includes(FAKE_KEY));
        });
    }
    { let n = 0; const c = cfg({ sdkTimeoutMs: 40 }); const t = L.createProviderTransport(c, { kind: L.FAKE, fetch: (u, init) => { n++; return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))); } });
      const r = await run(one, c, t, mem(c));
      await check('timeout: SDK timeout -> timeout, reservation kept, no retry, no choice', async () => { const res = r.evaluations[0].result; assert.equal(res.fail, 'timeout'); assert.equal(n, 1); assert.equal(r.budget.charged, r.budget.ledger[0].reservedNanos); assert.equal(res.choice, null); }); }

    { const cs = []; const c = cfg({ maxCostNanoUSD: 1000 }); const r = await run(one, c, fake(L.plumbingResponder, cs, c), mem(c));
      await check('budget too small: send is never called', async () => { assert.equal(cs.length, 0); assert.equal(r.stopped, true); assert.equal(r.evaluations[0].result.choice, null); assert(/budget_limit_cost/.test(r.evaluations[0].result.fail)); }); }
    { const cs = []; const c = cfg({ maxRequests: 3 }); const r = await run(DATA, c, fake(L.plumbingResponder, cs, c), mem(c));
      await check('request cap: the 4th request is not sent, run stops', async () => { assert.equal(cs.length, 3); assert.equal(r.stopped, true); assert.equal(r.budget.calls, 3); }); }
    { const cs = []; const b = mem(); const r = await run(one, cfg(), fake(supplementFlow(choice('lend', 10)), cs), b); const sum = b.ledger.reduce((s, x) => s + x.chargedNanos, 0);
      await check('supplement and confirmation are charged to the same ledger', async () => { assert.equal(b.calls, 4); assert.equal(sum, b.charged); assert(b.ledger.every(x => x.usage && x.usage.output_tokens_details)); }); }

    await check('reservation covers worst case (1.1x geo, 1h cache-write rate, max_tokens incl. thinking); usage over it locks', async () => {
        const b = mem(); const wire = L.buildWire(cfg(), { protocol: 'p', contract: 1, stage: 'appraisal', instruction: 'i', input: DATA.cases[0].input }); const row = b.reserve(wire);
        const bytes = Buffer.byteLength(JSON.stringify(wire)); assert.equal(row.reservedInputTokens, bytes + 2048); assert.equal(row.reservedNanos, Math.ceil(((bytes + 2048) * 4000 + 4096 * 10000) * 11 / 10));
        b.settle(row, { input_tokens: 1000, output_tokens: 500, inference_geo: 'global' }); assert.equal(b.charged, 1000 * 2000 + 500 * 10000);
        const r2 = b.reserve(wire); b.settle(r2, { input_tokens: 1000, output_tokens: 500, inference_geo: 'us' }); assert.equal(r2.chargedNanos, Math.ceil((1000 * 2000 + 500 * 10000) * 11 / 10));
        const r3 = b.reserve(wire); b.settle(r3, { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 10, cache_creation_input_tokens: 10, cache_creation: { ephemeral_5m_input_tokens: 4, ephemeral_1h_input_tokens: 6 }, inference_geo: 'global' }); assert.equal(r3.chargedNanos, 10 * 100 + 4 * 2500 + 6 * 4000);
        const r4 = b.reserve(wire); b.settle(r4, { input_tokens: 5, output_tokens: 5, inference_geo: null }); assert.equal(r4.chargedNanos, Math.ceil((5 * 2000 + 5 * 10000) * 11 / 10), 'unknown geo -> worst multiplier');
        const r5 = b.reserve(wire); b.settle(r5, { output_tokens: 3 }); assert.equal(r5.status, 'usage_unknown'); assert.equal(r5.chargedNanos, r5.reservedNanos);
        const r6 = b.reserve(wire); assert.throws(() => b.settle(r6, { input_tokens: 1, output_tokens: 4097 }), /usage_exceeded/); assert.throws(() => b.reserve(wire), /budget_locked/);
        const c = mem(); const r7 = c.reserve(wire); assert.throws(() => c.settle(r7, { input_tokens: 1, output_tokens: 1, server_tool_use: { web_search_requests: 1 } }), /unexpected_billing/); assert.equal(c.locked, true);
    });

    await check('one request in flight: a second concurrent send is refused before fetch', async () => {
        let n = 0, release; const t = L.createProviderTransport(cfg(), { kind: L.FAKE, fetch: L.fakeProviderFetch(async (p) => { n++; if (n === 1) await new Promise(r => { release = r; }); return L.plumbingResponder(p); }) }); // first request held open
        const b = mem(); const [r1, r2] = [run(one, cfg(), t, b), run(one, cfg(), t, b)]; await new Promise(r => setTimeout(r, 50)); release();
        const [a, c] = await Promise.all([r1, r2]); assert.equal(a.evaluations[0].result.status, 'done'); assert(/concurrent_request_open/.test(c.evaluations[0].result.fail), c.evaluations[0].result.fail); assert.equal(n, 2, 'only the first run reached fetch'); assert.equal(b.calls, 2);
    });

    await check('restart and repeated runs keep spend and count; interrupted reservations stay charged; ledgers kept apart', async () => {
        const dir = tmp(); const c = cfg({ maxRequests: 5 });
        await L.withBatchLock(dir, () => run(one, c, fake(L.plumbingResponder, [], c), L.journalBudget(dir, c, 'fake_provider')));
        const j1 = JSON.parse(fs.readFileSync(path.join(dir, 'ledger.json'), 'utf8')); assert.equal(j1.calls, 2);
        await L.withBatchLock(dir, () => run(one, c, fake(L.plumbingResponder, [], c), L.journalBudget(dir, c, 'fake_provider')));
        const j2 = JSON.parse(fs.readFileSync(path.join(dir, 'ledger.json'), 'utf8')); assert.equal(j2.calls, 4); assert(j2.charged > j1.charged);
        const b = L.journalBudget(dir, c, 'fake_provider'); b.reserve(L.buildWire(c, { protocol: 'p', contract: 1, stage: 's', instruction: 'i', input: {} })); // simulated crash: left open
        const after = L.journalBudget(dir, c, 'fake_provider'); assert.equal(after.calls, 5); assert.equal(after.ledger[4].status, 'interrupted_reserved'); assert.equal(after.charged, b.charged);
        assert.throws(() => after.reserve({ max_tokens: 4096 }), /budget_limit_requests/);
        assert.throws(() => L.journalBudget(dir, c, 'anthropic_live'), /journal_kind_mismatch/);
        assert.throws(() => new Budget(FIXCFG, j2), /invalid_budget_journal/); // fixture ledger cannot load a provider ledger
        assert.throws(() => L.journalBudget(dir, cfg({ maxRequests: 60 }), 'fake_provider'), /invalid_live_journal/); // changed limits cannot reset the batch
    });

    await check('parallel start: a second process on the same batch is refused by the lock', async () => {
        const dir = path.join('test-results', 'loan-research-fake-provider', BASE.batchId); fs.mkdirSync(dir, { recursive: true });
        const before = fs.existsSync(path.join(dir, 'ledger.json')) ? fs.readFileSync(path.join(dir, 'ledger.json'), 'utf8') : null;
        await L.withBatchLock(dir, () => { const r = cp.spawnSync(process.execPath, ['scripts/psy_research_live.js', '--fake-provider'], { cwd: path.join(__dirname, '..'), encoding: 'utf8', env: { PATH: process.env.PATH } }); assert.notEqual(r.status, 0); assert(/batch_locked/.test(r.stderr), r.stderr); });
        const after = fs.existsSync(path.join(dir, 'ledger.json')) ? fs.readFileSync(path.join(dir, 'ledger.json'), 'utf8') : null; assert.equal(after, before);
    });

    const cs3 = []; const all = await run(DATA, cfg(), fake(L.plumbingResponder, cs3), mem());
    await check('3 repeats of each input are 3 independent requests (identical bodies, separate sends, no carried context)', async () => {
        assert.equal(all.evaluations.length, 12); assert.equal(cs3.length, 24); assert(all.evaluations.every(e => e.result.status === 'done' && !e.result.from_cache));
        for (let i = 0; i < 8; i++) { assert.equal(PSY.stable(cs3[i].body), PSY.stable(cs3[i + 8].body)); assert.equal(PSY.stable(cs3[i].body), PSY.stable(cs3[i + 16].body)); }
        assert(cs3.every(c => c.body.messages.length === 1)); assert.equal(new Set(all.calls.map(c => c.call)).size, 24);
    });

    await check('source labels: provider-format records are not fixtures, and the two replays refuse each other', async () => {
        assert(all.calls.every(c => c.source === L.FAKE && c.fixture === false && c.wire_hash && c.provider.request_id));
        const fx = await run(one, FIXCFG); assert(fx.calls.every(c => c.source === 'TEST_FIXTURE_HANDWRITTEN' && c.fixture === true));
        const r1 = await run(one, cfg(), L.replayLiveTransport(cfg(), fx.calls), new L.ReplayBudget()); assert.equal(r1.evaluations[0].result.fail, 'replay_source_mismatch');
        const r2 = await run(one, FIXCFG, replayTransport(normal.calls), new Budget(FIXCFG)); assert.equal(r2.evaluations[0].result.status, 'pending');
    });

    await check('offline replay: same evaluations, original order enforced, zero spend, no ledger write, no network', async () => {
        const n0 = netCalls; const rb = new L.ReplayBudget(); const rep = await run(DATA, cfg(), L.replayLiveTransport(cfg(), all.calls), rb);
        assert.deepEqual(rep.evaluations, all.evaluations); assert.equal(rb.charged, 0); assert(rep.calls.every(c => c.source === L.REPLAY && c.provider.replayed_from === L.FAKE)); assert.equal(netCalls, n0);
        const shuffled = all.calls.slice(); [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
        const bad = await run(one, cfg(), L.replayLiveTransport(cfg(), shuffled), new L.ReplayBudget()); assert.equal(bad.evaluations[0].result.fail, 'replay_mismatch');
        const failedRec = await run(one, cfg(), L.createProviderTransport(cfg(), { kind: L.FAKE, fetch: async () => errResp(529, 'overloaded_error') }), mem());
        const rf = await run(one, cfg(), L.replayLiveTransport(cfg(), failedRec.calls), new L.ReplayBudget()); assert.equal(rf.evaluations[0].result.fail, 'server_error');
    });

    await check('fixed responses that choose differently all pass; validator does not prefer an answer', async () => {
        const outs = {};
        for (const [k, ch] of [['lend30', choice('lend', 30)], ['refuse', choice('refuse')]]) { const r = await run(one, cfg(), fake((p) => (p.stage === 'appraisal' ? { value: appraisal30(p.input) } : { value: ch })), mem()); outs[k] = r.evaluations[0].result.status; }
        assert.deepEqual(outs, { lend30: 'done', refuse: 'done' });
    });

    await check('no credential in code, config, records or ledgers; global fetch never used', async () => {
        const files = ['scripts/psy_research_live.js', 'research/anthropic-research.json', 'scripts/psy_research.js'].map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
        assert(!new RegExp(['sk-' + 'ant-api', 'gs' + 'k_', 'AI' + 'za', 'vercel_blob' + '_rw_'].join('|')).test(files));
        assert(!/RIMTOWN_RESEARCH_API_KEY/.test(JSON.stringify(all.calls)) && !JSON.stringify(all).includes('offline-placeholder'));
        assert.equal(netCalls, 0);
    });

    console.log(checks + ' checks passed; provider API requests: 0 (global fetch calls: ' + netCalls + ')');
})().catch(e => { console.error(e); process.exitCode = 1; });

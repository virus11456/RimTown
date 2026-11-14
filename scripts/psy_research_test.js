const assert = require('node:assert/strict');
const PSY = require('../chrome-extension/psy-core.js');
const { buildPairs } = require('./psy_loan_pairs.js');
const { Budget, createEvaluator, fixtureTransport, replayTransport, run } = require('./psy_research.js');
const config = require('../research/config.json');
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log('PASS ' + name); };
(async () => {
    const ds = buildPairs();
    check('reproducible synthetic dataset', () => assert.deepEqual(ds, buildPairs()));
    check('same person, cash, request and candidate set in every variant', () => {
        for (const c of ds.cases) { assert.deepEqual(c.input.options, ds.cases[0].input.options); assert.equal(c.input.self.cash.v, 50); assert.equal(c.input.self.id, 'aming'); assert.deepEqual(c.input.ids, ds.cases[0].input.ids); assert.deepEqual(PSY.validateInput(c.input), []); }
    });
    check('treatment changes only allowed facts plus dependent versions/arithmetic', () => {
        const allowed = { repaid_memory: ['recall.', 'versions.knowledge'], known_expense: ['self.obligations.', 'derived.', 'versions.state'], stated_purpose: ['seen.', 'versions.knowledge'] };
        for (const p of ds.pairs) { assert(p.diff.length); for (const d of p.diff) assert(allowed[p.variant].some(prefix => d.path.startsWith(prefix)), d.path); }
    });
    const before = PSY.stable(ds);
    // Network tripwire: any accidental fetch fails even if invoked by a new adapter.
    global.fetch = () => { throw new Error('network_forbidden_in_fixture_test'); };
    const result = await run(ds, config);
    check('12 independent evaluations use 24 calls, no result cache', () => {
        assert.equal(result.evaluations.length, 12); assert.equal(result.calls.length, 24); assert.equal(result.stopped, false);
        assert(result.evaluations.every(x => x.result.status === 'done' && !x.result.from_cache));
    });
    check('identical inputs have identical repeated request content', () => {
        for (let i = 0; i < 8; i++) assert.equal(result.calls[i].request_hash, result.calls[i + 8].request_hash);
    });
    check('no treatment label or audit sent; no input mutation', () => {
        for (const c of result.calls) { assert(!('audit' in c.request)); assert(!('case_id' in c.request)); assert(!('repeat' in c.request)); }
        assert.equal(PSY.stable(ds), before);
    });
    check('same fixed choice is allowed across variants', () => assert(result.evaluations.every(x => x.result.choice.opt === 'refuse')));
    const replay = await run(ds, config, replayTransport(result.calls));
    check('recorded replies replay identically without live transport', () => assert.deepEqual(replay.evaluations, result.evaluations));
    check('exact budget bookkeeping', () => { assert.equal(result.budget.calls, 24); assert.equal(result.budget.charged, 24 * (100 * 4 + 100 * 20)); });
    check('live transport blocked before send', () => {
        let sent = false;
        assert.throws(() => createEvaluator({ ...config, mode: 'live' }, { kind: 'live', send: () => { sent = true; } }, new Budget(config)), /live_transport_disabled/);
        assert.equal(sent, false);
    });
    for (const field of ['maxCalls', 'maxCostMicros']) {
        const r = await run(ds, { ...config, [field]: 0 });
        check('zero ' + field + ' prevents all sends', () => { assert.equal(r.calls.length, 0); assert.equal(r.stopped, true); });
    }
    const limited = await run(ds, { ...config, maxCalls: 1 });
    check('second stage blocked when call cap reached', () => { assert.equal(limited.calls.length, 1); assert.equal(limited.stopped, true); assert.equal(limited.evaluations[0].result.choice, null); });
    check('unknown usage retains reservation; no double refund', () => {
        const b = new Budget(config), row = b.reserve({}); const charged = b.charged; b.settle(row); assert.equal(b.charged, charged); assert.throws(() => b.settle(row, { input_tokens: 1, output_tokens: 1 }), /reservation_not_open/);
    });
    check('unexpected provider usage locks further calls', () => {
        const b = new Budget(config), row = b.reserve({}); assert.throws(() => b.settle(row, { input_tokens: row.reservedInput + 1, output_tokens: 0 }), /usage_exceeded/); assert.throws(() => b.reserve({}), /budget_locked/);
    });
    check('restart retains spent and unresolved reservations', () => {
        let journal; const b = new Budget({ ...config, maxCalls: 1 }, null, s => { journal = PSY.clone(s); }); b.reserve({});
        const restarted = new Budget({ ...config, maxCalls: 1 }, journal); assert.equal(restarted.charged, b.charged); assert.throws(() => restarted.reserve({}), /budget_limit/);
        assert.throws(() => new Budget(config, journal), /invalid_budget_journal/);
    });
    const bad = { kind: 'TEST_FIXTURE_HANDWRITTEN', send: async () => { throw new Error('transport_failure'); } };
    const failed = await run({ ...ds, cases: [ds.cases[0]], repeats: 1 }, config, bad);
    check('transport failure retains cost and does not select', () => { assert.equal(failed.budget.calls, 1); assert.equal(failed.budget.charged, failed.budget.ledger[0].reservedMicros); assert.equal(failed.evaluations[0].result.choice, null); });
    const propose = () => ({ contract: 1, opt: 'lend', params: { amount: 10 }, because: ['c1'], accept: [], left: [], public: '', private: '', commit: null, act: { opt: 'lend', amount: 10 } });
    const supplementTransport = { kind: 'TEST_FIXTURE_HANDWRITTEN', send: async r => {
        if (r.stage === 'appraisal') return fixtureTransport().send(r);
        return { value: r.stage === 'supplement' ? { impacts: [{ opt: 'lend', params: { amount: 10 }, expect: [], like: ['c1'], dislike: [], unsure: [] }] } : propose(), usage: { input_tokens: 100, output_tokens: 100 } };
    } };
    const one = { ...ds, cases: [ds.cases[0]], repeats: 1 };
    const supplemented = await run(one, config, supplementTransport);
    check('supplement and confirmation both pass the budget gate', () => { assert.equal(supplemented.evaluations[0].result.status, 'done'); assert.deepEqual(supplemented.calls.map(c => c.request.stage), ['appraisal', 'choice', 'supplement', 'confirmation']); });
    const capped = await run(one, { ...config, maxCalls: 3 }, supplementTransport);
    check('confirmation cannot bypass exhausted budget', () => { assert.equal(capped.calls.length, 3); assert.equal(capped.stopped, true); assert.equal(capped.evaluations[0].result.choice, null); });
    const timeout = await run(one, config, { kind: 'TEST_FIXTURE_HANDWRITTEN', send: () => new Promise(() => {}) });
    check('timeout retains reservation and produces no choice', () => { assert.equal(timeout.budget.charged, timeout.budget.ledger[0].reservedMicros); assert.equal(timeout.evaluations[0].result.fail, 'timeout'); assert.equal(timeout.evaluations[0].result.choice, null); });
    const altered = PSY.clone(ds); altered.cases[0].input.self.cash.v = 999;
    await assert.rejects(() => run(altered, config), /input_hash_mismatch/); checks++;
    console.log(checks + ' checks passed; no live AI or network calls');
})().catch(e => { console.error(e); process.exitCode = 1; });

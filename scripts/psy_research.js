// Offline research boundary. No HTTP transport, credentials, game settlement, or automatic retries.
const PSY = require('../chrome-extension/psy-core.js');
const clone = PSY.clone;
class Budget {
    constructor(config, saved = null, persist = () => {}) {
        this.c = clone(config); this.calls = 0; this.charged = 0; this.locked = false; this.ledger = [];
        for (const n of [this.c.maxCalls, this.c.maxCostMicros, this.c.maxOutputTokens, this.c.inputOverheadTokens, this.c.pricing?.inputMicrosPerToken, this.c.pricing?.outputMicrosPerToken]) if (!Number.isSafeInteger(n) || n < 0) throw new Error('invalid_budget_config');
        if (saved) {
            if (PSY.hashOf(saved.config) !== PSY.hashOf(this.c) || !Array.isArray(saved.ledger) || !Number.isSafeInteger(saved.calls) || saved.calls < 0 || !Number.isSafeInteger(saved.charged) || saved.charged < 0) throw new Error('invalid_budget_journal');
            this.calls = saved.calls; this.charged = saved.charged; this.locked = !!saved.locked; this.ledger = clone(saved.ledger);
            if (this.ledger.length !== this.calls || this.ledger.some((r, i) => r.call !== i + 1 || !Number.isSafeInteger(r.chargedMicros) || r.chargedMicros < 0) || this.ledger.reduce((sum, r) => sum + r.chargedMicros, 0) !== this.charged) throw new Error('invalid_budget_journal');
        }
        this.persist = () => persist({ config: this.c, calls: this.calls, charged: this.charged, locked: this.locked, ledger: this.ledger });
    }
    reserve(request) {
        if (this.locked) throw new Error('budget_locked');
        // UTF-8 byte count + overhead is a conservative offline bound, not a provider token count.
        const input = Buffer.byteLength(JSON.stringify(request), 'utf8') + this.c.inputOverheadTokens;
        const output = this.c.maxOutputTokens;
        const cost = input * this.c.pricing.inputMicrosPerToken + output * this.c.pricing.outputMicrosPerToken;
        if (!Number.isSafeInteger(cost) || this.calls >= this.c.maxCalls || this.charged + cost > this.c.maxCostMicros) throw new Error('budget_limit');
        const row = { call: ++this.calls, reservedInput: input, reservedOutput: output, reservedMicros: cost, chargedMicros: cost, status: 'reserved' };
        this.charged += cost; this.ledger.push(row); this.persist(); return row;
    }
    settle(row, usage) {
        if (!this.ledger.includes(row) || row.status !== 'reserved') throw new Error('reservation_not_open');
        // Missing/invalid usage or transport failures retain the full reservation.
        if (!usage || !Number.isSafeInteger(usage.input_tokens) || !Number.isSafeInteger(usage.output_tokens) || usage.input_tokens < 0 || usage.output_tokens < 0) { row.status = 'usage_unknown'; this.persist(); return; }
        if (usage.input_tokens > row.reservedInput || usage.output_tokens > row.reservedOutput) {
            const actual = usage.input_tokens * this.c.pricing.inputMicrosPerToken + usage.output_tokens * this.c.pricing.outputMicrosPerToken;
            this.charged += Math.max(0, actual - row.chargedMicros); row.chargedMicros = Math.max(actual, row.chargedMicros);
            row.status = 'usage_exceeded_reservation'; this.locked = true; this.persist(); throw new Error('usage_exceeded_reservation');
        }
        const cost = usage.input_tokens * this.c.pricing.inputMicrosPerToken + usage.output_tokens * this.c.pricing.outputMicrosPerToken;
        this.charged -= row.reservedMicros - cost; row.chargedMicros = cost; row.status = 'settled'; row.usage = clone(usage); this.persist();
    }
}
const instructions = {
    appraisal: '只回 appraisal JSON：contract、concerns[{id,what,ev}]、reading{what,unsure}、impacts[{opt,params,expect[{what,who,status,ev}],like,dislike,unsure}]、not_considered[{opt,why}]。資料來源用輸入 id；推測標 inferred，未知標 unknown。每個選項評估或列未考慮；不預選、不宣告結局。',
    choice: '只回 choice JSON：contract、opt、params、because（concern id）、accept、left、public、private、commit、act。選擇已評估方案，可承擔代價，沒有預定正確答案。act 與 opt/params 一致。',
    supplement: '只新增 impacts 與 concerns；不改舊評估、不帶選擇。不要求支持初步提案，記錄未確定事項。',
    confirmation: '依補充評估重新確認或修改選擇，格式同 choice；可回 {"withdraw":true} 撤回。不得因為先前提案就必須維持。'
};
function createEvaluator(config, transport, budget, records = []) {
    // Real provider wiring requires a separate implementation and explicit authorization.
    if (config.mode !== 'fixture' || transport.kind !== 'TEST_FIXTURE_HANDWRITTEN') throw new Error('live_transport_disabled');
    if (Object.keys(config.providerSettings || {}).some(k => !['temperature', 'effort', 'seed'].includes(k))) throw new Error('unsupported_provider_setting');
    const call = async (stage, input, appraisal, proposal) => {
        const request = { protocol: 'psy-research-v1', contract: PSY.CONTRACT, stage, instruction: instructions[stage], input, ...(appraisal ? { appraisal } : {}), ...(proposal ? { proposal } : {}), max_output_tokens: config.maxOutputTokens, provider_settings: config.providerSettings };
        const row = budget.reserve(request);
        const record = { call: row.call, request_hash: PSY.hashOf(request), request: clone(request), model: config.model, channel: config.channel, fixture: true, status: 'started' }; records.push(record);
        try {
            const response = await transport.send(PSY.freeze(clone(request)));
            record.raw = clone(response); budget.settle(row, response.usage);
            record.status = 'returned'; return clone(response.value);
        } catch (e) { if (row.status === 'reserved') { row.status = 'failed_reserved'; budget.persist(); } record.status = 'failed'; record.error = String(e.message); throw e; }
    };
    return { id: 'research-fixture', version: '1', contract: PSY.CONTRACT, fixture: true, appraise: i => call('appraisal', i), choose: (i, a) => call('choice', i, a), supplement: (i, a, p) => call('supplement', i, a, p), confirm: (i, a, p) => call('confirmation', i, a, p) };
}
// Same handwritten answer for every variant: demonstrates plumbing only, not sensitivity.
function fixtureTransport() {
    return { kind: 'TEST_FIXTURE_HANDWRITTEN', send: async r => {
        if (r.stage === 'appraisal') return { value: { contract: 1, concerns: [{ id: 'c1', what: '考慮手上的錢', ev: ['s_cash'] }], reading: { what: '朋友提出借款請求', unsure: ['未來還款不確定'] }, impacts: [{ opt: 'refuse', expect: [{ what: '錢留在身上', who: [r.input.self.id], status: 'derived', ev: ['s_cash'] }], like: ['c1'], dislike: [], unsure: [] }], not_considered: r.input.options.filter(o => o.opt !== 'refuse').map(o => ({ opt: o.opt, why: '手寫流程測試未評估' })) }, usage: { input_tokens: 100, output_tokens: 100 } };
        return { value: { contract: 1, opt: 'refuse', params: {}, because: ['c1'], accept: [], left: [], public: '', private: '', commit: null, act: { opt: 'refuse' } }, usage: { input_tokens: 100, output_tokens: 100 } };
    } };
}
function replayTransport(records) {
    let next = 0;
    return { kind: 'TEST_FIXTURE_HANDWRITTEN', send: async request => {
        const row = records[next++];
        if (!row || row.request_hash !== PSY.hashOf(request) || !row.fixture || row.status !== 'returned') throw new Error('replay_mismatch');
        return clone(row.raw);
    } };
}
async function run(dataset, config, transport = fixtureTransport(), budget = new Budget(config)) {
    const calls = [], evaluations = [];
    const evaluator = createEvaluator(config, transport, budget, calls);
    for (let repeat = 0; repeat < dataset.repeats; repeat++) for (const c of dataset.cases) {
        if (PSY.hashOf(c.input) !== c.input_hash) throw new Error('input_hash_mismatch');
        const result = await PSY.evaluate({ input: c.input }, [evaluator], { timeoutMs: 1000 }); // No result cache; no audit or treatment labels sent.
        evaluations.push({ case_id: c.case_id, repeat, result });
        if (budget.locked || result.tries.some(t => /budget_|usage_exceeded/.test(t.fail || ''))) return { calls, evaluations, budget, stopped: true };
    }
    return { calls, evaluations, budget, stopped: false };
}
module.exports = { Budget, createEvaluator, fixtureTransport, replayTransport, run };
if (require.main === module) {
    const fs = require('fs'), path = require('path');
    (async () => {
        const dataset = JSON.parse(fs.readFileSync('research/loan-pairs.json', 'utf8'));
        const config = JSON.parse(fs.readFileSync('research/config.json', 'utf8'));
        const root = 'test-results/loan-research-fixture'; fs.mkdirSync(root, { recursive: true });
        // Exclusive lock and atomic journal replacement prevent concurrent CLI runs from overspending.
        const lock = path.join(root, 'budget.lock'); const fd = fs.openSync(lock, 'wx');
        try {
            const file = path.join(root, 'budget.json'); const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
            const budget = new Budget(config, saved, state => { fs.writeFileSync(file + '.tmp', JSON.stringify(state, null, 2)); fs.renameSync(file + '.tmp', file); });
            const result = await run(dataset, config, fixtureTransport(), budget);
            const out = fs.mkdtempSync(path.join(root, 'run-'));
            fs.writeFileSync(path.join(out, 'run.json'), JSON.stringify(result, null, 2) + '\n');
            console.log(JSON.stringify({ out, evaluations: result.evaluations.length, calls: result.calls.length, simulatedChargedMicros: result.budget.charged, stopped: result.stopped }));
        } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
    })().catch(e => { console.error(e.message); process.exitCode = 1; });
}

// Synthetic, actor-known research facts. Never loaded by the game.
const PSY = require('../chrome-extension/psy-core.js');
const LOAN = require('../chrome-extension/psy-loan.js');
function world() {
    const agent = (agentId, name) => ({ agentId, name, age: 34, mood: 55, needs: { hunger: 70, energy: 60 }, personality: { traits: ['kind'], values: ['family'] }, job: { key: 'farmer' }, memory: { entries: [] }, relationships: { relationships: {} } });
    const a = agent('aming', '阿明'), b = agent('hua', '阿華');
    a.relationships.relationships.hua = { affinity: 35, trust: 10 };
    return { townName: '研究小世界', tickCount: 9600, _absDay: () => 100, agents: { aming: a, hua: b }, wallet: { bal: { aming: 50, hua: 5 } }, dark: { debts: [] }, bank: { loans: {} }, health: { a: {} } };
}
function buildPairs() {
    const cases = ['baseline', 'repaid_memory', 'known_expense', 'stated_purpose'].map(name => {
        const w = world();
        if (name === 'repaid_memory') w.agents.aming.memory.entries.push({ tick: 9504, content: '阿華上次向我借的錢，已經照約定還清。', importance: 5, category: 'social', relatedAgents: ['阿華'] });
        const event = { id: 'research-event', decision: 'research-decision', agent: 'aming', from: 'hua', n: 30, said: name === 'stated_purpose' ? '屋頂破了，我想買材料修好。' : null, world: '研究小世界' };
        const snap = PSY.snapshot(w, LOAN, event);
        const input = PSY.clone(snap.input);
        if (name === 'known_expense') {
            // Explicit synthetic knowledge, not a reading of somebody else's health table.
            input.self.obligations.push({ id: 'k_research_expense', what: '我已確認孩子明天看病，需要由我支付 40 銀幣。', amount: 40, due_in_days: 1, src: 'research_actor_known_fact' });
            input.derived.push({ id: 'd_research_total', what: '已知明天需支付 40 銀幣', value: 40, from: ['k_research_expense'] }, { id: 'd_research_left', what: '借出 30 後剩 20，比已知的 40 少 20 銀幣', value: -20, from: ['d_after_req', 'k_research_expense'] });
        }
        input.versions = { state: PSY.hashOf(input.self).slice(0, 16), knowledge: PSY.hashOf([input.seen, input.recall, input.views]).slice(0, 16), candidates: PSY.hashOf(input.options).slice(0, 16) };
        const errors = PSY.validateInput(input); if (errors.length) throw new Error(errors.join(','));
        return { case_id: name, input: PSY.freeze(input), input_hash: PSY.hashOf(input), audit: snap.audit };
    });
    const baseline = cases[0];
    return { schema: 1, synthetic: true, description: '人工建立的可知事實；不代表遊戲已支援醫療預約或經歷生成。無指定正確選擇。', repeats: 3, cases, pairs: cases.slice(1).map(c => ({ baseline: baseline.case_id, variant: c.case_id, diff: PSY.diff(baseline.input, c.input) })) };
}
module.exports = { buildPairs };
if (require.main === module) {
    const fs = require('fs'), path = require('path'); const out = process.argv[2] || 'research/loan-pairs.json';
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(buildPairs(), null, 2) + '\n'); console.log(out);
}

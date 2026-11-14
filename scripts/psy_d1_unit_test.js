// 擬人化智能體 D1 單元測試：共用評估流程（純 Node，不開瀏覽器、不連網、不呼叫任何 AI）
// 用一個手寫的小世界（阿明、阿華、阿明的孩子）測快照、資訊邊界、驗證、兩階段、快取、故障、重播。
// 評估器全部是「人工標記的固定回應」（label: TEST_FIXTURE_HANDWRITTEN），只驗工程流程，不代表任何角色行為。
// 界線：只檢查一致性、不替角色決定。測試只驗資訊來源、格式、引用、確定算術、方案與行動一致；不把任何選項當成「正確答案」。
// 例子裡的金額（阿明 50、阿華借 30）只是測試資料，不在正式評估邏輯裡；遊戲沒有的資訊（例如家人病況的消息）只在測試裡明確建立。
// 用法：node scripts/psy_d1_unit_test.js            （FIRE=1 另外跑第二個情境的測試）
const path = require('path'); const fs = require('fs'); const crypto = require('crypto');
const PSY = require(path.join(__dirname, '../chrome-extension/psy-core.js'));
const LOAN = require(path.join(__dirname, '../chrome-extension/psy-loan.js'));
const FIRE = require(path.join(__dirname, '../chrome-extension/psy-fire.js'));
const RUN_FIRE = process.env.FIRE === '1'; // 第二個情境本輪暫停驗收（跨情境驗證留待下一輪）；FIRE=1 才跑它的測試
let pass = 0, fail = 0; const fails = [];
const ok = (c, name, extra) => { if (c) pass++; else { fail++; fails.push(name + (extra ? ' :: ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' :: ' + extra : '')); } };

function world() {
    const mk = (id, name, o = {}) => Object.assign({ agentId: id, name, age: 34, mood: 55, needs: { hunger: 70, energy: 60 }, personality: { traits: ['kind'], values: ['family'] }, job: { key: 'farmer' }, memory: { entries: [] }, relationships: { relationships: {} } }, o);
    const w = {
        townName: '測試鎮', tickCount: 9600, _absDay() { return 100; },
        agents: {
            aming: mk('aming', '阿明', { memory: { entries: [
                { tick: 9000, content: '阿華上個月幫我扛過一袋米。', importance: 5, category: 'social', relatedAgents: ['阿華'] },
                { tick: 9300, content: '今天田裡收成普通。', importance: 2, category: 'observation', relatedAgents: [] },
            ] }, relationships: { relationships: { hua: { affinity: 35, trust: 10, targetName: '阿華' } } } }),
            hua: mk('hua', '阿華', { job: { key: 'carpenter' }, memory: { entries: [{ tick: 9400, content: '我其實藏了一筆私房錢在床底下。', importance: 8, category: 'social', relatedAgents: [] }] }, relationships: { relationships: { aming: { affinity: 60, trust: 40 } } } }),
            kid: mk('kid', '小明', { age: 8, _parentNames: ['阿明'] }),
        },
        wallet: { bal: { aming: 50, hua: 5, kid: 0 } },
        health: { a: { kid: [{ k: 'injury', s: 2, p: 'f' }] } },
        dark: { debts: [] }, bank: { loans: {}, dep: { hua: 300 } },
        housing: { map: { aming: 'h1', kid: 'h1', hua: 'h2' } }, // 阿明和孩子住同一棟，阿華住別棟
    };
    return w;
}
const ev = (o = {}) => Object.assign({ id: 'ev1', decision: 'dc1', agent: 'aming', from: 'hua', n: 30, said: null, world: '測試鎮' }, o);
const snap = (w, e) => PSY.snapshot(w, LOAN, e || ev());
// 測試裡明確建立「本人看得到的公開消息」（遊戲本身的訊息模板，逐字照抄 sim-health.js）
const FIGHT = '👊 {a}跟{b}打起來了，{l}的{p}受了傷。', OWED = '💸 {a}要開刀，但湊不出 {n} 銀幣，只能拖著。';
const news = (w, k, p, d = 99) => { (w.messageLog = w.messageLog || []).push({ type: 'health', d, k, p }); return w; };

// 人工標記的固定回應（依輸入的編號產生；只驗流程）
function fixtureFor(input, over = {}) {
    const has = (id) => PSY.idSet(input).has(id);
    const concerns = [{ id: 'c1', what: '手上的錢夠不夠應付家裡的開銷', ev: ['s_cash'].concat(has('d_known_total') ? ['d_known_total'] : []) }, { id: 'c2', what: '阿華開口了，想回應他', ev: ['o_req'] }];
    const impacts = [
        { opt: 'lend', params: { amount: 30 }, expect: [{ what: '照他說的借出 30 後，身上剩 20 銀幣', who: ['aming'], status: 'derived', ev: ['d_after_req'] }, { what: '他大概會還', who: ['hua'], status: 'inferred', ev: ['v_promise'] }], like: ['c2'], dislike: ['c1'], unsure: ['他什麼時候能還'] },
        { opt: 'lend', params: { amount: 10 }, expect: [{ what: '借出 10 後身上剩 40 銀幣', who: ['aming'], status: 'derived', ev: ['s_cash'] }], like: ['c1', 'c2'], dislike: [], unsure: ['10 夠不夠他用'] },
        { opt: 'refuse', expect: [{ what: '錢留在身上', who: ['aming'], status: 'derived', ev: ['s_cash'] }], like: ['c1'], dislike: ['c2'], unsure: [] },
    ];
    const not_considered = input.options.filter(o => !impacts.some(i => i.opt === o.opt)).map(o => ({ opt: o.opt, why: '當下沒想到' }));
    const appraisal = { contract: 1, concerns, reading: { what: '阿華想借錢', unsure: ['他需要多少才夠'] }, impacts, not_considered };
    const choice = { contract: 1, opt: 'lend', params: { amount: 10 }, because: ['c1', 'c2'], accept: ['他可能覺得少'], left: [], public: '先借你 10', private: '有點過意不去', commit: null, act: { opt: 'lend', amount: 10 } };
    return Object.assign({ label: 'TEST_FIXTURE_HANDWRITTEN', appraisal, choice }, over);
}
const fx = (input, over) => ({ [PSY.inputKey(input)]: fixtureFor(input, over) });

(async () => {
    console.log('— SHA-256 與穩定序列化');
    for (const s of ['', 'abc', '阿明借錢 50 元 🙂', 'x'.repeat(777)]) ok(PSY.sha256(s) === crypto.createHash('sha256').update(s).digest('hex'), 'sha256 對照 Node crypto：' + s.slice(0, 8));
    ok(PSY.stable({ b: 1, a: [2, { d: 1, c: 2 }] }) === PSY.stable({ a: [2, { c: 2, d: 1 }], b: 1 }), 'stable 與鍵順序無關');

    console.log('— 快照：不改世界、不用亂數、只讀本人可知資料');
    { const w = world(); const before = JSON.stringify(w); const s = snap(w); ok(JSON.stringify(w) === before, '快照前後世界完全相同'); ok(s.audit.rnd === 0, '快照沒有取用亂數'); ok(!!s.input && Object.isFrozen(s.input), '快照凍結'); ok(PSY.validateInput(s.input).length === 0, '輸入通過驗證', PSY.validateInput(s.input).join(','));
      const owners = new Set(s.audit.manifest.map(m => m.owner)); ok([...owners].every(o => ['self', 'cohabitant', 'public'].includes(o)), '讀取清單只有本人、同住、公開', [...owners].join(','));
      const txt = PSY.stable(s.input); ok(!txt.includes('私房錢'), '阿華的私人記憶不在輸入裡'); ok(!/\b300\b/.test(txt), '阿華的存款不在輸入裡'); }

    console.log('— 只改隱藏財務：本人輸入與候選清單不變');
    { const a = snap(world()).input; const w2 = world(); w2.wallet.bal.hua = 98765.43; w2.bank.dep.hua = 4321; w2.agents.hua.memory.entries.push({ tick: 9500, content: '我打算不還了', importance: 9, relatedAgents: [] }); w2.agents.hua.relationships.relationships.aming.affinity = -90;
      const b = snap(w2).input; ok(PSY.hashOf(a) === PSY.hashOf(b), '隱藏資料改變後輸入雜湊相同', JSON.stringify(PSY.diff(a, b)).slice(0, 200)); ok(PSY.stable(a.options) === PSY.stable(b.options), '候選清單相同'); ok(!PSY.stable(b).includes('98765'), '隱藏現金數字沒有出現在輸入'); }

    console.log('— 讀別人私有資料會被擋下（技術錯誤，不是角色行為）');
    { const bad = Object.assign({}, LOAN, { build(R, e) { R.cashOf('hua'); return LOAN.build(R, e); } }); const s = PSY.snapshot(world(), bad, ev()); ok(s.input === null && /boundary:read_other_cash/.test(s.audit.error), '讀別人現金 → BoundaryError', s.audit.error);
      const bad2 = Object.assign({}, LOAN, { build(R, e) { R.healthOf('hua', [{ id: 'hua' }]); return LOAN.build(R, e); } }); const s2 = PSY.snapshot(world(), bad2, ev()); ok(s2.input === null && /read_other_health/.test(s2.audit.error), '讀別人的病況 → BoundaryError（adapter 多傳名單也沒用）'); }

    console.log('— 已知醫療支出、還款經歷、朋友說法：資料正確反映差異');
    { const w0 = world(); w0.health.a.aming = [{ k: 'injury', s: 2, p: 'h' }]; const a = snap(w0).input; const b = snap(world()).input; // 阿明自己的手傷（本人的病況，讀得到）
      ok(a.self.obligations.some(o => o.src === 'own_body' && o.amount === 60) && !b.self.obligations.some(o => o.src === 'own_body'), '自己的病 → 列出診所收費；沒病就沒有');
      ok(a.derived.some(d => d.id === 'd_after_req_vs_known' && /不夠/.test(d.what)) && !b.derived.some(d => d.id === 'd_after_req_vs_known'), '算術：借 30 後剩 20 不夠 60（只在有已知支出時）', JSON.stringify(a.derived.map(d => d.what)));
      ok(a.versions.state !== b.versions.state && a.versions.knowledge === b.versions.knowledge, '狀態版本變、知識版本不變');
      ok(!PSY.stable(a).includes('拒絕') && !PSY.stable(a).includes('base'), '輸入沒有預填心理判斷或分數');
      const w3 = world(); w3.agents.aming.memory.entries.push({ tick: 9500, content: '阿華準時把借的 10 銀幣還我了，這人可靠。', importance: 4, category: 'social', relatedAgents: ['阿華'] }); const c = snap(w3).input;
      ok(c.recall.some(m => /準時把借的/.test(m.text)) && !a.recall.some(m => /準時把借的/.test(m.text)), '加上還款經歷 → 出現在可取用記憶'); ok(c.versions.knowledge !== a.versions.knowledge, '知識版本跟著變');
      const d = snap(world(), ev({ said: '我娘病了要買藥' })).input; ok(d.seen.length === 2 && /買藥/.test(d.seen[1].text) && d.seen[1].src === 'heard_direct:hua', '朋友說明用途 → 進入觀察，標明親口說');
      const e = snap(world(), ev({ n: 45 })).input; ok(e.derived.some(x => x.id === 'd_after_req' && /剩 5 銀幣/.test(x.what)), '借 45（身上 50）→ 算術寫明剩 5', JSON.stringify(e.derived.map(x => x.what)));
      const f = snap(world(), ev({ n: 80 })).input; ok(f.derived.some(x => x.id === 'd_short_req' && /不夠借出 80/.test(x.what)), '借 80 超過現金 → 算術寫明不夠');
      ok(a.views.find(v => v.id === 'v_promise').kind === 'promise' && a.views.some(v => v.kind === 'unknown'), '「下週還」是承諾、對方現金是未知');
      ok(!a.views.some(v => v.id === 'v_kin'), '阿華不是家人 → 沒有家人身分'); const k = snap(world(), ev({ from: 'kid', n: 5 })).input; ok(k.views.some(v => v.id === 'v_kin' && v.kind === 'public' && /孩子/.test(v.what)), '孩子來借 → 標明是你的孩子（公開身分事實）');
      const lend = a.options.find(o => o.opt === 'lend'); ok(lend && lend.params.amount.max === 50 && !('base' in lend) && !('lean' in lend), '借款金額 1～50 由現金決定，沒有預填分數'); }

    console.log('— 兩階段評估：驗證、凍結、技術故障');
    const s0 = snap(world()); const I = s0.input;
    { const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator(fx(I))]); ok(r.status === 'done' && r.choice.opt === 'lend' && r.evaluator.fixture === true, '固定回應通過', r.fail + ' ' + JSON.stringify(r.tries)); ok(r.notes.length === 0, '沒有證據不足的註記', r.notes.join(',')); }
    { const f = fixtureFor(I); f.appraisal.concerns[0].ev = ['m_fake']; const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: f })]); ok(r.status === 'pending' && r.tries[0].fail === 'invalid_appraisal' && r.tries[0].errors.includes('unknown_source:m_fake') && r.choice === null, '偽造來源 → 驗證失敗，不產生選擇'); }
    { const f = fixtureFor(I); f.appraisal.not_considered = f.appraisal.not_considered.filter(x => x.opt !== 'gift'); const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: f })]); ok(r.tries[0].errors?.includes('option_not_addressed:gift'), '有選項沒評估也沒寫「沒考慮」→ 失敗'); }
    { const f = fixtureFor(I); f.choice.opt = 'steal'; const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: f })]); ok(r.status === 'pending' && r.tries[0].fail === 'illegal_option', '非法選項 → illegal_option'); }
    { const f = fixtureFor(I); f.choice.params.amount = 999; const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: f })]); ok(r.tries[0].errors?.includes('bad_param:amount'), '金額超過現金 → bad_param'); }
    { const f = fixtureFor(I); f.choice.agreed = true; const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: f })]); ok(r.tries[0].errors?.includes('claims_outcome:agreed'), '選擇宣稱對方同意 → 失敗'); }
    { const f = fixtureFor(I); f.choice.act.paid = true; const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: f })]); ok(r.tries[0].errors?.includes('claims_outcome:paid'), '選擇宣稱已付款 → 失敗'); }
    { const f = fixtureFor(I); f.choice.concerns = []; const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: f })]); ok(r.tries[0].errors?.includes('choice_rewrites_concerns'), '選擇想改寫評估 → 失敗'); }
    { const f = fixtureFor(I); f.appraisal.opt = 'lend'; const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: f })]); ok(r.tries[0].errors?.includes('appraisal_has_opt'), '評估階段先選了 → 失敗'); }
    { const base = PSY.ReplayEvaluator(fx(I)); const sneaky = Object.assign({}, base, { id: 'sneaky', choose: async (inp, ap) => { try { ap.concerns[0].what = '改掉'; ap.concerns.push({ id: 'cX' }); } catch (e) {} return base.choose(inp, ap); } });
      const r = await PSY.evaluate(s0, [sneaky]); ok(r.status === 'done' && r.appraisal.concerns[0].what === '手上的錢夠不夠應付家裡的開銷' && r.appraisal.concerns.length === 2 && PSY.hashOf(r.appraisal) === r.appraisal_hash, '選擇階段改不動已凍結的評估'); }
    { const f = fixtureFor(I); f.appraisal.impacts[0].expect.push({ what: '阿華有 200 銀幣', who: ['hua'], status: 'derived', ev: [] }); const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: f })]);
      ok(r.status === 'done' && r.notes.some(n => n.startsWith('unsupported_assertion')), '無依據的斷言 → 記為證據不足（不算越界、不直接作廢）', r.notes.join(',')); }
    { const f = fixtureFor(I); f.appraisal.impacts[0].expect[0].what = '借出後剩 17 銀幣'; const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: f })]); ok(r.notes.some(n => n === 'number_not_in_sources:lend:17'), '算錯的數字 → 註記不在來源中', r.notes.join(',')); }
    { const w2 = world(); w2.wallet.bal.hua = 300; const s2 = snap(w2); const f = fixtureFor(s2.input); f.appraisal.impacts[0].expect.push({ what: '他是木匠，應該不至於還不出來', who: ['hua'], status: 'inferred', ev: ['v_job'] });
      const r = await PSY.evaluate(s2, [PSY.ReplayEvaluator({ [PSY.inputKey(s2.input)]: f })]); ok(r.status === 'done' && r.notes.length === 0, '有根據的推測（即使碰巧猜中）不算越界', r.notes.join(',')); }
    { const hang = { id: 'hang', version: '1', contract: 1, appraise: () => new Promise(() => {}), choose: async () => ({}) }; const r = await PSY.evaluate(s0, [hang], { timeoutMs: 50 }); ok(r.status === 'pending' && r.fail === 'timeout' && r.choice === null, '逾時 → 技術待處理，不偽造拒絕或暫緩'); }
    { const junk = { id: 'junk', version: '1', contract: 1, appraise: async () => '這不是 JSON {', choose: async () => ({}) }; const r = await PSY.evaluate(s0, [junk]); ok(r.fail === 'bad_json@appraisal' && r.choice === null, '壞 JSON → bad_json'); }
    { const hang = { id: 'hang', version: '1', contract: 1, appraise: () => new Promise(() => {}), choose: async () => ({}) }; const nc = { id: 'nc', appraise: async () => ({}), choose: async () => ({}) };
      const r = await PSY.evaluate(s0, [nc, hang, PSY.ReplayEvaluator(fx(I), { id: 'fixture-b' })], { timeoutMs: 50 }); ok(r.status === 'done' && r.evaluator.id === 'fixture-b' && r.tries.map(t => t.fail).join(',') === 'evaluator_not_conforming,timeout,', '依序：不合契約的跳過、逾時的換下一個', JSON.stringify(r.tries)); }
    { const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({ [PSY.inputKey(I)]: Object.assign(fixtureFor(I), { label: 'whatever' }) })]); ok(r.fail === 'unlabeled_fixture', '沒有人工標記的固定回應拒用'); }
    { const r = await PSY.evaluate(s0, [PSY.ReplayEvaluator({})]); ok(r.status === 'pending' && r.fail === 'no_response' && r.choice === null, '沒有對應回應 → 待處理'); }

    console.log('— 快取：角色、相關輸入、候選參數、版本都要相同');
    { const cache = new Map(); const E = PSY.ReplayEvaluator(fx(I)); const r1 = await PSY.evaluate(s0, [E], { cache }); const r2 = await PSY.evaluate(snap(world(), ev({ id: 'ev2', decision: 'dc2' })), [E], { cache });
      ok(!r1.from_cache && r2.from_cache, '同樣的輸入（不同事件編號）→ 快取命中');
      const w3 = world(); w3.health.a.aming = [{ k: 'fever', s: 1, p: 'l' }]; const r3 = await PSY.evaluate(snap(w3), [E], { cache }); ok(!r3.from_cache && r3.fail === 'no_response', '自己的醫療支出改變 → 快取失效');
      const w3b = world(); w3b.agents.aming.needs.hunger = 20; const r3b = await PSY.evaluate(snap(w3b), [E], { cache }); ok(!r3b.from_cache && r3b.fail === 'no_response', '需求改變（餓了）→ 快取失效');
      const w3c = world(); w3c.health.a.kid = []; const r3c = await PSY.evaluate(snap(w3c), [E], { cache }); ok(r3c.from_cache, '只改孩子的健康表（本人沒有消息）→ 輸入相同，快取命中');
      const r4 = await PSY.evaluate(snap(world(), ev({ n: 20 })), [E], { cache }); ok(!r4.from_cache, '借款金額改變 → 快取失效');
      const E2 = Object.assign({}, E, { version: '2' }); const r5 = await PSY.evaluate(s0, [E2], { cache }); ok(!r5.from_cache, '評估器版本改變 → 快取失效');
      const w6 = world(); w6.wallet.bal.hua = 999; const r6 = await PSY.evaluate(snap(w6), [E], { cache }); ok(r6.from_cache, '只改隱藏資料 → 輸入相同，快取照常命中（證明快取沒有讀隱藏資料）'); }

    console.log('— 研究紀錄、重複回應、重播一致');
    { const log = new PSY.ResearchLog(); const E = PSY.ReplayEvaluator(fx(I)); await PSY.evaluate(s0, [E], { log }); await PSY.evaluate(s0, [E], { log }); ok(log.rows.length === 1 && log.rejected[0]?.reason === 'duplicate_response', '同一決策的第二份回應被拒收');
      const a = await PSY.evaluate(s0, [PSY.ReplayEvaluator(fx(I))]); const b = await PSY.evaluate(s0, [PSY.ReplayEvaluator(fx(I))]); ok(PSY.stable(a) === PSY.stable(b), '同一份回應重播兩次，紀錄逐字相同');
      const w2 = world(); w2.wallet.bal.aming = 40; const dd = PSY.diff(I, snap(w2).input); ok(dd.some(x => x.path.startsWith('self.cash')) && dd.some(x => x.path.startsWith('derived')), '差異比較列出改變的欄位', dd.map(x => x.path).join(' ')); }

    console.log('— 輸入驗證：不准帶分數、不准引擎替角色推測');
    { const bad = Object.assign({}, LOAN, { build(R, e) { const d = LOAN.build(R, e); d.options[0].base = 1.2; d.views.push({ id: 'v_x', about: 'hua', kind: 'inferred', what: '他會還' }); return d; } }); const s = PSY.snapshot(world(), bad, ev()); const er = PSY.validateInput(s.input);
      ok(er.some(e => e.startsWith('forbidden_key:') && e.endsWith('base')) && er.some(e => e.startsWith('view_kind:v_x')), '選項帶 base、引擎提供推測 → 輸入驗證失敗', er.join(',')); const r = await PSY.evaluate(s, [PSY.ReplayEvaluator({})]); ok(r.fail === 'invalid_input', '輸入不合格就不評估'); }


    console.log('— 修正一：讀取器自己授權；親屬、同住、本人實際知道的病況分開');
    { const a = snap(world()).input; const kidO = a.self.obligations.find(o => o.who === 'kid');
      ok(!!kidO && kidO.status === 'unknown' && kidO.amount === undefined && kidO.amount_max === undefined && !/腳|受傷|嚴重/.test(kidO.what), '親屬但沒有知情依據：明白寫「沒有消息」，不給病況、不給金額', JSON.stringify(kidO));
      ok(!a.derived.some(d => d.id === 'd_known_total'), '不知道的項目不算進已知支出');
      ok(a.self.kin.some(k => k.who === 'kid' && k.rel === 'child') && a.self.cohabitants.some(c => c.who === 'kid'), '親屬與同住分開列出（兩者都不等於知道病況）');
      const w1 = world(); w1.health.a.kid = [{ k: 'disease', s: 3, p: 'c' }]; ok(PSY.hashOf(snap(w1).input) === PSY.hashOf(a), '孩子的健康表怎麼改，輸入都一樣（讀取器不讀別人的健康表）');
      ok(!a.self.obligations.some(o => o.src === 'cohabitant') && !PSY.stable(a).includes('assumed_visible'), '不再用「同住看得見」推定病況');
      // 玩家可見紀錄沒有角色接收依據：不可作為角色知情。
      const w2 = news(world(), FIGHT, { a: '阿強', b: '小明', l: '小明', p: '腳' });
      const b = snap(w2).input; const kn = b.self.obligations.find(o => o.who === 'kid');
      ok(kn.status === 'unknown' && !PSY.stable(b).includes('腳受了傷'), '玩家可見消息不代表角色收到');
      const w3 = news(world(), OWED, { a: '小明', n: 60 });
      ok(snap(w3).input.self.obligations.find(o => o.who === 'kid').status === 'unknown', '沒有接收證據不得推定病況或費用');
      const w4 = news(world(), FIGHT, { a: '阿強', b: '阿華', l: '阿華', p: '手' });
      ok(!snap(w4).input.views.some(v => v.id.startsWith('v_news')), '他人的消息不能直接進入觀點');
      const w5 = world(); w5.agents.aming.memory.entries.push({ tick: 9550, content: '小明的腳腫起來了，走路一拐一拐。', importance: 6, category: 'observation', relatedAgents: ['小明'] }); const e = snap(w5, ev({ from: 'kid', n: 5 })).input;
      ok(e.recall.some(m => /小明的腳腫/.test(m.text)), '本人自己的記憶（親眼看到）可以取用；不從健康表補');
      const w6 = world(); w6.agents.aming.relationships.relationships.hua.status = 'married'; w6.health.a.hua = [{ k: 'fever', s: 1, p: 'l' }]; const f = snap(w6).input;
      ok(f.self.kin.some(k => k.who === 'hua' && k.rel === 'spouse') && f.self.obligations.some(o => o.who === 'hua' && o.status === 'unknown') && !/風寒|肺/.test(PSY.stable(f)), '配偶生病但沒有消息：知道是配偶，病況保持未知');
      // 偽造名單：讀取器不收 adapter 傳進來的名單
      const forged = Object.assign({}, LOAN, { build(R, e) { const k = R.kin([{ id: 'hua', name: '阿華', rel: 'child' }]); const c2 = R.cohabitants(['hua']); const d0 = LOAN.build(R, e); d0.views.push({ id: 'v_forged', about: 'hua', kind: 'public', what: JSON.stringify([k.map(x => x.id), c2]) }); return d0; } });
      const g = PSY.snapshot(world(), forged, ev()).input; const vf = g.views.find(v => v.id === 'v_forged'); ok(vf && vf.what === JSON.stringify([['kid'], ['kid']]), '偽造的親屬／同住名單被忽略，讀取器自己判斷', vf && vf.what);
      const forged2 = Object.assign({}, LOAN, { build(R, e) { R.healthOf('kid'); return LOAN.build(R, e); } }); ok(/read_other_health:kid/.test(PSY.snapshot(world(), forged2, ev()).audit.error), '家人的健康表也讀不到（BoundaryError）');
      ok(!('w' in PSY.reader(world(), 'aming')) && !Object.values(PSY.reader(world(), 'aming')).some(v => v && typeof v === 'object' && 'agents' in v), '讀取器不把世界物件交給 adapter');
      const w7 = world(); delete w7.housing; ok(!snap(w7).input.self.cohabitants.length, '沒有住房對照 → 當作沒有同住的人，不猜'); }

    console.log('— 修正一：資訊來源稽核涵蓋事件內容、候選清單與 adapter 讀取路徑');
    { const seen = []; const prox = (o, tag) => new Proxy(o, { get(t, k) { if (typeof k === 'string') seen.push(tag + '.' + k); const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
      const w = world(); const e1 = LOAN.eventOf(prox(w, 'w'), prox(w.agents.aming, 'a'), prox({ from: 'hua', n: 30, said: '屋頂破了' }, 'ctx'));
      const allowed = ['w._absDay', 'w.townName', 'a.agentId', 'ctx.from', 'ctx.n', 'ctx.said']; const extra = [...new Set(seen)].filter(x => !allowed.includes(x));
      ok(!extra.length, 'eventOf 只讀日曆、鎮名、本人編號與 ctx 的 from／n／said', extra.join(','));
      ok(Object.keys(LOAN.EVENT_SOURCES).sort().join() === 'day,from,n,said,world' && e1.n === 30 && e1.said === '屋頂破了', '事件內容的來源有明文登記（寫進快照稽核）');
      ok(snap(world()).audit.event_sources === LOAN.EVENT_SOURCES, '快照稽核帶著事件內容來源');
      const R = PSY.reader(world(), 'aming'); const d = LOAN.build(R, ev()); const opt = d.options.map(o => o.opt + ':' + JSON.stringify(o.params)).join('|');
      const w2 = world(); w2.wallet.bal.hua = 7777; w2.health.a.kid = []; const R2 = PSY.reader(w2, 'aming'); ok(LOAN.build(R2, ev()).options.map(o => o.opt + ':' + JSON.stringify(o.params)).join('|') === opt, '候選清單只依本人現金：改別人的錢與健康表，候選完全相同');
      ok(R.manifest.every(m => ['self', 'public'].includes(m.owner)) && R.manifest.some(m => m.why === 'recipient_unknown') && !R.manifest.some(m => /health\.a\[(?!self)/.test(m.path)), 'adapter 的讀取路徑全記在清單裡：只有本人與公開資料', [...new Set(R.manifest.map(m => m.path))].join(' '));
      const code = (f) => fs.readFileSync(path.join(__dirname, '../chrome-extension/' + f), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l) && !/^if \(typeof module/.test(l)).join('\n');
      ok(!/\bwindow\b|globalThis|rimtownApp|document\.|localStorage|\bw\.(wallet|health|bank|dark|agents)/.test(code('psy-loan.js') + code('psy-world.js')), 'adapter 原始碼不讀全域物件，也不直接讀世界的錢包、健康、銀行、債務'); }

    console.log('— 修正三：本人的需求、情緒、性格、價值有穩定編號可引用（不帶權重）');
    { const a = snap(world()).input; const ids = PSY.idSet(a); ok(['s_mood', 'need_hunger', 'need_energy', 'trait_kind', 'value_family', 's_job', 's_age'].every(x => ids.has(x)), '本人狀態都有編號', [...ids].filter(x => /^(s_|need_|trait_|value_)/.test(x)).join(','));
      ok(a.self.items.every(x => !('weight' in x) && !('importance' in x) && !('priority' in x)), '本人狀態沒有重要性或權重欄位');
      const f = fixtureFor(a); f.appraisal.concerns.push({ id: 'c3', what: '有點餓，想先顧好自己', ev: ['need_hunger', 'value_family'] }); const r = await PSY.evaluate(snap(world()), [PSY.ReplayEvaluator({ [PSY.inputKey(a)]: f })]); ok(r.status === 'done', '在乎的事可以引用需求與價值', r.fail + JSON.stringify(r.tries));
      const g = fixtureFor(a); g.appraisal.concerns.push({ id: 'c3', what: 'x', ev: ['need_madeup'] }); const r2 = await PSY.evaluate(snap(world()), [PSY.ReplayEvaluator({ [PSY.inputKey(a)]: g })]); ok(r2.tries[0].errors?.includes('unknown_source:need_madeup'), '引用不存在的狀態編號 → 失敗'); }

    console.log('— 修正二：最終選擇必須對應已評估的方案與參數');
    { const s1 = snap(world()); const I1 = s1.input; const run = async (mut) => { const f = fixtureFor(I1); mut(f); return PSY.evaluate(s1, [PSY.ReplayEvaluator({ [PSY.inputKey(I1)]: f })]); };
      let r = await run(f => { f.appraisal.impacts = f.appraisal.impacts.filter(i => !(i.opt === 'lend' && i.params.amount === 10)); }); ok(r.tries[0].errors?.some(e => e.startsWith('choice_not_evaluated:lend')), '只評估了借 30，卻選借 10 → 失敗', JSON.stringify(r.tries[0].errors));
      r = await run(f => { delete f.appraisal.impacts[0].params; }); ok(r.tries[0].errors?.includes('impact_missing_params:lend:amount'), '有金額的動作沒寫評估的是哪個金額 → 失敗');
      r = await run(f => { f.appraisal.impacts[0].params.amount = 999; }); ok(r.tries[0].errors?.includes('impact_bad_param:lend:amount'), '評估的金額超出範圍 → 失敗');
      r = await run(f => { f.appraisal.impacts.push(JSON.parse(JSON.stringify(f.appraisal.impacts[0]))); }); ok(r.tries[0].errors?.some(e => e.startsWith('duplicate_impact')), '同一方案評估兩次 → 失敗');
      r = await run(f => { f.choice.act = { opt: 'lend', amount: 30 }; }); ok(r.tries[0].errors?.includes('act_mismatch:amount'), 'act 寫 30、params 寫 10 → 矛盾');
      r = await run(f => { f.choice.act = { opt: 'lend', amount: 10, to: 'kid' }; }); ok(r.tries[0].errors?.includes('act_unknown_key:to'), 'act 多出對象欄位 → 失敗');
      r = await run(f => { f.choice = { contract: 1, opt: 'refuse', params: { explain: '孩子要看病' }, because: ['c1'], accept: [], left: [], public: '這次真的不行', private: '', commit: null, act: { opt: 'refuse', explain: '孩子要看病' } }; }); ok(r.status === 'done', '說話內容（文字參數）不需要逐字評估', JSON.stringify(r.tries));
      r = await run(f => { f.appraisal.impacts[1].expect[0].what = '借出 10 後身上剩 41 銀幣'; }); ok(r.notes.includes('number_not_in_sources:lend:41'), '驗證器自己做成本算術：剩 41 不對（應是 40）', r.notes.join(','));
      r = await run(() => {}); ok(r.status === 'done' && r.notes.length === 0, '剩 40 對得上，沒有註記', r.notes.join(',')); }

    console.log('— 修正二（續）：合法改方案、補評估、超出資源、算術錯誤只記錄');
    { const s1 = snap(world()); const I1 = s1.input; const K1 = PSY.inputKey(I1);
      const only30 = () => { const f = fixtureFor(I1); f.appraisal.impacts = f.appraisal.impacts.filter(i => !(i.opt === 'lend' && i.params.amount === 10)); return f; };
      const sup = (impacts, extra = {}) => Object.assign({}, PSY.ReplayEvaluator({ [K1]: only30() }), { id: 'fixture-sup', supplement: async () => Object.assign({ impacts }, extra), confirm: async (_input, _appraisal, choice) => choice });
      const im10 = { opt: 'lend', params: { amount: 10 }, expect: [{ what: '借出 10 後身上剩 40 銀幣', who: ['aming'], status: 'derived', ev: ['s_cash'] }], like: ['c1', 'c2'], dislike: [], unsure: [] };
      let r = await PSY.evaluate(s1, [sup([im10])]);
      ok(r.status === 'done' && r.choice.opt === 'lend' && r.choice.params.amount === 10, '評估了借 30、最後想借 10：補上借 10 的評估後接受，選擇原封不動', r.fail + JSON.stringify(r.tries));
      ok(r.appraisal_versions?.length === 2 && r.appraisal_versions[1].prev === r.appraisal_versions[0].hash && r.appraisal_versions[1].after === 'choice' && Object.isFrozen(r.appraisal) && Object.isFrozen(r.appraisal_first), '補評估是新的一版、另外凍結，第一版保留');
      ok(r.order.join('>') === 'appraisal#1>choice>appraisal#2>confirmation>accepted' && !r.appraisal_first.impacts.some(i => i.params?.amount === 10) && PSY.hashOf(r.appraisal_first) === r.appraisal_versions[0].hash, '順序照實記下：補評估發生在選擇之後；第一版內容沒被改', r.order && r.order.join('>'));
      r = await PSY.evaluate(s1, [sup([Object.assign({}, im10, { params: { amount: 15 } })])]); ok(r.status === 'pending' && r.tries[0].fail === 'invalid_choice' && r.choice === null, '補的評估對不上選擇（補了 15、選 10）→ 不接受，也不替角色改成 15');
      r = await PSY.evaluate(s1, [sup([im10], { choice: { opt: 'refuse' } })]); ok(r.tries[0].fail === 'invalid_supplement' && r.tries[0].errors.includes('supplement_has_choice'), '補評估不能順便改選擇');
      { const E = sup([im10]); delete E.confirm; const rr = await PSY.evaluate(s1, [E]); ok(rr.status === 'pending' && rr.fail === 'confirmation_required', '沒有確認能力時不自動定案'); }
      { const E = sup([im10]); E.confirm = async () => ({ withdraw: true }); const rr = await PSY.evaluate(s1, [E]); ok(rr.status === 'withdrawn' && rr.choice === null && rr.order.at(-1) === 'withdrawn', '角色可撤回，與技術待處理分開'); }
      { const E = sup([im10]); E.confirm = async () => { const f = fixtureFor(I1); return Object.assign({}, f.choice, { opt: 'refuse', params: {}, act: { opt: 'refuse' } }); }; const rr = await PSY.evaluate(s1, [E]); ok(rr.status === 'done' && rr.choice.opt === 'refuse', '補評估後角色可改選已評估方案'); }
      { const E = sup([im10]); E.confirm = async () => { const f = fixtureFor(I1); f.choice.params.amount = 15; f.choice.act.amount = 15; return f.choice; }; const rr = await PSY.evaluate(s1, [E]); ok(rr.status === 'pending' && rr.choice === null, '再次改成未評估參數不自動接受'); }
      { const E = sup([im10]); E.confirm = async () => new Promise(() => {}); const rr = await PSY.evaluate(s1, [E], { timeoutMs: 10 }); ok(rr.status === 'pending' && rr.choice === null, '確認逾時為技術待處理'); }
      r = await PSY.evaluate(s1, [PSY.ReplayEvaluator({ [K1]: only30() })]); ok(r.status === 'pending' && r.choice === null, '沒有補評估能力的評估器：選了沒評估的方案就是待處理，核心不替它挑一個評估過的');
      // 合法地改成其他方案：同一份評估，選拒絕、借 30、先問清楚都一樣通過（驗證器沒有偏好的答案）
      const alts = { refuse: { opt: 'refuse', params: {}, act: { opt: 'refuse' } }, lend30: { opt: 'lend', params: { amount: 30 }, act: { opt: 'lend', amount: 30 } }, ask: { opt: 'ask', params: { question: '你要做什麼用？' }, act: { opt: 'ask', question: '你要做什麼用？' } } };
      for (const [k, c] of Object.entries(alts)) { const f = fixtureFor(I1); if (k === 'ask') { f.appraisal.impacts.push({ opt: 'ask', expect: [{ what: '先知道他要做什麼', who: ['hua'], status: 'inferred', ev: ['o_req'] }], like: ['c2'], dislike: [], unsure: [] }); f.appraisal.not_considered = f.appraisal.not_considered.filter(x => x.opt !== 'ask'); }
        f.choice = Object.assign({ contract: 1, because: ['c1'], accept: [], left: [], public: '', private: '', commit: null }, c); const rr = await PSY.evaluate(s1, [PSY.ReplayEvaluator({ [K1]: f })]); ok(rr.status === 'done' && rr.choice.opt === c.opt, '改選「' + k + '」也通過（只要評估過、參數一致）', rr.fail + JSON.stringify(rr.tries)); }
      // 超出資源限制：金額超過現金 → 不合法；紀錄是待處理，不改成合法金額、不改選別的
      { const f = fixtureFor(I1); f.appraisal.impacts.push({ opt: 'lend', params: { amount: 60 }, expect: [], like: [], dislike: [], unsure: [] }); const rr = await PSY.evaluate(s1, [PSY.ReplayEvaluator({ [K1]: f })]); ok(rr.tries[0].errors?.includes('impact_bad_param:lend:amount') && rr.choice === null, '評估一個超過身上現金的金額 → 評估不合格'); }
      { const f = fixtureFor(I1); f.choice.params.amount = 51; f.choice.act.amount = 51; const rr = await PSY.evaluate(s1, [PSY.ReplayEvaluator({ [K1]: f })]); ok(rr.status === 'pending' && rr.tries[0].errors.includes('bad_param:amount') && rr.choice === null, '選擇借 51（身上 50）→ 不合法、待處理，沒有被改成 50 或拒絕'); }
      // 參數矛盾
      { const f = fixtureFor(I1); f.choice.act = { opt: 'gift', amount: 10 }; const rr = await PSY.evaluate(s1, [PSY.ReplayEvaluator({ [K1]: f })]); ok(rr.tries[0].errors?.includes('act_mismatch:opt'), 'act 的動作和選擇不同 → 矛盾'); }
      // 算術錯誤只記錄
      { const f = fixtureFor(I1); f.appraisal.impacts[1].cash_after = 45; const rr = await PSY.evaluate(s1, [PSY.ReplayEvaluator({ [K1]: f })]); ok(rr.status === 'done' && rr.notes.includes('arith_mismatch:lend:45≠40') && rr.choice.opt === 'lend' && rr.choice.params.amount === 10, '評估器算錯「剩 45」（應是 40）→ 記錄 arith_mismatch，選擇照舊', rr.notes.join(',')); }
      { const f = fixtureFor(I1); f.appraisal.impacts[1].cash_after = 40; const rr = await PSY.evaluate(s1, [PSY.ReplayEvaluator({ [K1]: f })]); ok(rr.status === 'done' && !rr.notes.length, '算對了就沒有註記'); } }

    console.log('— 界線：只檢查一致性、不替角色決定');
    { ok(PSY.BOUNDARY === '只檢查一致性、不替角色決定', '核心帶著界線常數');
      const doc = fs.readFileSync(path.join(__dirname, '../DESIGN_HUMANLIKE_D1.md'), 'utf8'); ok(doc.includes('只檢查一致性、不替角色決定'), 'D1 文件寫明界線');
      // 家人有消息要開刀、錢可能不夠：借、拒絕、先問都一樣通過；驗證器沒有「孩子生病就該拒絕」這種規則
      const w = news(world(), OWED, { a: '小明', n: 60 }); const s2 = snap(w); const I2 = s2.input; const K2 = PSY.inputKey(I2);
      const res = {}; for (const c of [{ opt: 'refuse', params: {}, act: { opt: 'refuse' } }, { opt: 'lend', params: { amount: 30 }, act: { opt: 'lend', amount: 30 } }, { opt: 'lend', params: { amount: 10 }, act: { opt: 'lend', amount: 10 } }]) {
        const f = fixtureFor(I2); f.choice = Object.assign({ contract: 1, because: ['c2'], accept: [], left: [], public: '', private: '', commit: null }, c); const r = await PSY.evaluate(s2, [PSY.ReplayEvaluator({ [K2]: f })]); res[c.opt + (c.params.amount || '')] = r.status; }
      ok(Object.values(res).every(x => x === 'done'), '孩子有開刀的消息時，借 30、借 10、拒絕都同樣通過（沒有標準答案）', JSON.stringify(res));
      const core = fs.readFileSync(path.join(__dirname, '../chrome-extension/psy-core.js'), 'utf8'); const vc = core.slice(core.indexOf('function validateChoice'), core.indexOf('// ---------------- 評估器'));
      ok(!/obligations|derived|items|mood|need_|value_|trait_|kin|cohab/.test(vc), '選擇驗證不看支出、算術結果、心情、需求、價值、家人（只看方案與參數一致）');
      const va = core.slice(core.indexOf('function validateAppraisal'), core.indexOf('const OUTCOME_KEYS'));
      ok(!/like\.length|dislike\.length|concerns\.length\s*[<>]|\.v\s*[<>]/.test(va), '評估驗證不要求在乎的事要有幾件、不比較狀態數值');
      const all = ['psy-core.js', 'psy-world.js', 'psy-loan.js'].map(f => fs.readFileSync(path.join(__dirname, '../chrome-extension/' + f), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/\s\/\/\s.*$/, '')).join('\n')).join('\n');
      ok(!/同情|生氣|憤怒|難過|害怕|焦慮|愧疚|感激|開心|心疼|丟臉|面子/.test(all), '沒有情緒關鍵字對照表（核心與 adapter 的程式碼裡沒有情緒詞）');
      ok(!/Math\.exp|softmax|temperature|threshold|NOISE|lean\(|score\(/.test(all), '沒有機率、溫度、門檻、傾向分數'); }

    console.log('— 修正三（續）：狀態版本與快取跟著資料變；格式驗證與語意抽查分開');
    { const a = snap(world()).input; const w1 = world(); w1.agents.aming.needs.energy = 15; const b = snap(w1).input; const w2 = world(); w2.agents.aming.mood = -40; const c = snap(w2).input;
      ok(a.versions.state !== b.versions.state && a.versions.state !== c.versions.state && a.versions.knowledge === b.versions.knowledge && a.versions.candidates === b.versions.candidates, '需求或心情改變 → 狀態版本變，知識與候選版本不變');
      const E = PSY.ReplayEvaluator({ [PSY.inputKey(a)]: fixtureFor(a), [PSY.inputKey(b)]: fixtureFor(b) }); ok(PSY.cacheKey(a, E) !== PSY.cacheKey(b, E), '快取鍵跟著狀態變');
      const w3 = world(); w3.agents.aming.personality.traits = ['kind', 'kind', 'thrifty']; const d = snap(w3).input; ok(PSY.validateInput(d).length === 0 && d.self.items.filter(x => x.id === 'trait_kind').length === 1 && d.self.items.some(x => x.id === 'trait_thrifty'), '遊戲資料裡重複的特質去重後編號（長跑實測發現）', PSY.validateInput(d).join(','));
      const w4 = world(); const m0 = w4.agents.aming.memory.entries[0]; w4.agents.aming.memory.entries.push(Object.assign({}, m0)); const e4 = snap(w4).input; const ids4 = e4.recall.map(m => m.id);
      ok(PSY.validateInput(e4).length === 0 && ids4.length === new Set(ids4).size && ids4.filter(x => x.startsWith(e4.recall.find(m => m.text === m0.content).id)).length === 2, '同一刻記了兩次的同一則記憶：兩筆都保留，第二筆編號加序號（長跑實測發現）', PSY.validateInput(e4).join(',') + ' ' + ids4.join(','));
      const dupA = Object.assign({}, LOAN, { build(R, e) { const x = LOAN.build(R, e); x.views.push({ id: 'v_job', about: 'hua', kind: 'public', what: '重複' }); return x; } }); ok(PSY.validateInput(PSY.snapshot(world(), dupA, ev()).input).includes('duplicate_ids:v_job'), '重複編號的錯誤會列出是哪個編號');
      const log = new PSY.ResearchLog(); const inputs = {}; for (const [i, n] of [[1, 30], [2, 20], [3, 25]]) { const s = snap(world(), ev({ id: 'e' + i, decision: 'd' + i, n })); inputs['d' + i] = s.input; await PSY.evaluate(s, [PSY.ReplayEvaluator({ [PSY.inputKey(s.input)]: fixtureFor(s.input) })], { log }); }
      const sp = PSY.spotSample(log.rows, inputs, 2); const sp2 = PSY.spotSample(log.rows, inputs, 2);
      ok(sp.length === 2 && PSY.stable(sp) === PSY.stable(sp2) && sp.every(x => x.review === 'pending_human' && x.concerns.every(c => c.cited.every(z => z.text && z.text !== '(找不到輸入)'))), '語意抽查：固定挑樣本，把關心的事和引用原文並排，留給人工標註（不自動判定）');
      ok(sp[0].concerns[0].cited.some(z => z.id === 's_cash' && /"v":50/.test(z.text)), '抽查樣本裡看得到引用的原文'); }

    console.log('— 修正四（單元部分）：掛勾的同一請求辨認、版本、去重；離線評估不用遊戲亂數');
    { const mkD = () => { const calls = []; return { calls, KINDS: { asked: { options(w, a, ctx) { calls.push(ctx); return [{ id: 'lend', run() {} }, { id: 'refuse', run() {} }]; } } } }; };
      const D = mkD(); const sink = []; const skips = []; sink.onSkip = (x) => skips.push(x); const w = world(); const untap = PSY.tap(D, LOAN, sink); const ctx = { from: 'hua', n: 30 };
      const o1 = D.KINDS.asked.options(w, w.agents.aming, ctx); const o2 = D.KINDS.asked.options(w, w.agents.aming, ctx);
      ok(o1.length === 2 && o2.length === 2 && o1[0].id === 'lend', '掛勾不改回傳值');
      ok(sink.length === 1 && skips.length === 1 && sink[0].audit.version === 0 && sink[0].input.ids.decision.endsWith('#v0'), '同一個請求列兩次、處境沒變 → 只拍一次，第二次記為略過', sink.length + '/' + skips.length);
      w.wallet.bal.aming = 42; w._absDay = () => 101; D.KINDS.asked.options(w, w.agents.aming, ctx);
      ok(sink.length === 2 && sink[1].audit.version === 1 && sink[1].audit.supersedes === sink[0].input.ids.decision && sink[1].input.ids.event === sink[0].input.ids.event, '隔天再列、處境變了 → 同一事件的新版本，標明取代前一版');
      D.KINDS.asked.options(w, w.agents.aming, { from: 'hua', n: 30 }); ok(sink.length === 3 && sink[2].input.ids.event !== sink[0].input.ids.event, '另一個請求（不同的 ctx 物件）→ 新事件');
      ok(new Set(sink.map(x => x.input.ids.decision)).size === 3, '決策編號都不重複');
      const log = new PSY.ResearchLog(); for (const x of sink) await PSY.evaluate(x, [PSY.ReplayEvaluator({ [PSY.inputKey(x.input)]: fixtureFor(x.input) })], { log }); ok(log.rows.length === 3 && !log.rejected.length, '研究紀錄收下三份，不當成重複回應');
      untap(); ok(!D.KINDS.asked._psyTapped, '卸下掛勾');
      // 離線評估：把亂數換成一呼叫就丟錯的函式，評估照樣完成 → 評估不取用任何亂數（包括遊戲的）
      const mr = Math.random; let used = 0; Math.random = () => { used++; throw new Error('no rng'); };
      let r; try { r = await PSY.evaluate(s0, [PSY.ReplayEvaluator(fx(I))], { cache: new Map(), log: new PSY.ResearchLog() }); } finally { Math.random = mr; }
      ok(r.status === 'done' && used === 0, '離線評估一次都沒呼叫亂數', 'used=' + used + ' ' + r.fail); }

    if (RUN_FIRE) { console.log('— 第二個情境：店面失火，老闆來求助（FIRE=1；本輪暫停驗收）');
    { const fire = { owner: 'hua', shop: '木工坊', loss: 40 }; const fe = (w) => FIRE.eventOf(w, 'aming', fire, '鋪子燒了一半'); const fs0 = (w) => PSY.snapshot(w, FIRE, fe(w));
      const a = fs0(world()); ok(!!a.input && a.audit.rnd === 0 && PSY.validateInput(a.input).length === 0, '失火情境的輸入通過驗證', a.audit.error || PSY.validateInput(a.input).join(','));
      ok(['give', 'lend', 'labor', 'refuse', 'defer', 'ask', 'consult'].every(o => a.input.options.some(x => x.opt === o)), '動作：給錢、借錢、去幫忙、幫不上，加上共用的暫緩／詢問／商量');
      ok(a.input.options.every(o => !('base' in o) && !('lean' in o) && !('score' in o)), '動作沒有預填分數');
      const w2 = world(); w2.wallet.bal.hua = 4321; w2.bank.dep.hua = 9999; ok(PSY.hashOf(fs0(w2).input) === PSY.hashOf(a.input), '只改老闆的現金與存款 → 輸入不變');
      ok(!PSY.stable(a.input).includes('私房錢'), '老闆的私人記憶不在輸入裡');
      ok(a.input.views.some(v => v.id === 'v_loss_said' && v.kind === 'said') && a.input.views.some(v => v.id === 'v_savings_unknown' && v.kind === 'unknown'), '損失金額是他說的、積蓄是未知');
      const I2 = a.input; const fix = { label: 'TEST_FIXTURE_HANDWRITTEN', appraisal: { contract: 1, concerns: [{ id: 'c1', what: '自己的錢', ev: ['s_cash'] }, { id: 'c2', what: '阿華的鋪子燒了', ev: ['o_fire', 'o_req'] }], reading: { what: '阿華遭遇損失來求助', unsure: ['他還有沒有別的辦法'] },
        impacts: [{ opt: 'give', params: { amount: 10 }, expect: [{ what: '給出 10 後身上剩 40 銀幣', who: ['aming'], status: 'derived', ev: ['s_cash'] }], like: ['c2'], dislike: ['c1'], unsure: [] }, { opt: 'labor', params: { days: 1 }, expect: [{ what: '一天不能做自己的工作', who: ['aming'], status: 'derived', ev: ['opt:labor'] }], like: ['c2'], dislike: [], unsure: [] }],
        not_considered: I2.options.filter(o => !['give', 'labor'].includes(o.opt)).map(o => ({ opt: o.opt, why: '當下沒想到' })) },
        choice: { contract: 1, opt: 'labor', params: { days: 1 }, because: ['c2'], accept: ['少賺一天'], left: [], public: '我明天去幫你搬', private: '', commit: '明天去幫忙', act: { opt: 'labor', days: 1 } } };
      const r = await PSY.evaluate(a, [PSY.ReplayEvaluator({ [PSY.inputKey(I2)]: fix })]); ok(r.status === 'done' && r.notes.length === 0, '固定回應走完兩階段（只驗流程）', r.fail + JSON.stringify(r.tries) + r.notes.join(','));
      const log = { messageLog: [{ k: FIRE.FIRE_KEY, p: { o: '阿華', s: '木工坊', n: 40 }, tick: 9500 }, { k: '別的訊息', p: {} }] }; const L = FIRE.firesInLog(Object.assign(world(), log)); ok(L.length === 1 && L[0].owner === 'hua' && L[0].loss === 40, '從公開訊息紀錄找出真實的失火');
      const src = fs.readFileSync(path.join(__dirname, '../chrome-extension/psy-fire.js'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'); ok(!/Math\.random|base\s*:|lean\s*:|score|weight|modifyAffinity|addThought/.test(src), '失火 adapter 沒有亂數、分數、心理寫入'); } } else console.log('— 第二個情境（店面失火）本輪暫停驗收，略過；FIRE=1 才跑');

    console.log('— 原始碼檢查：共用核心不看事件名稱、不用亂數、不碰結算');
    { const core = fs.readFileSync(path.join(__dirname, '../chrome-extension/psy-core.js'), 'utf8'); const loan = fs.readFileSync(path.join(__dirname, '../chrome-extension/psy-loan.js'), 'utf8'); const code = (s) => s.split('\n').filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/\s\/\/\s.*$/, '')).join('\n'); // 去掉整行與行尾註解
      ok(!/['"](asked|fire|loan)['"]|request_money|help_after_fire|PSY_LOAN|PSY_FIRE/.test(code(core)) && !/kind\s*===/.test(code(core)), '核心沒有事件名稱判斷（借錢、失火都不出現在核心）');
      ok(!/Math\.random\(\)/.test(code(core).replace(/Math\.random = function[^;]*;/, '')) && !/Math\.random/.test(code(loan)), '核心與 adapter 不呼叫亂數');
      ok(!/\.run\(|applyAi|lendTo|giveTo|refuseLoan|modifyAffinity|addThought|memory\.add|WALLET\./.test(code(core) + code(loan)), '不呼叫結算、心理或錢包函式');
      { const all = ['psy-core.js', 'psy-world.js', 'psy-loan.js', 'psy-fire.js'].map(f => code(fs.readFileSync(path.join(__dirname, '../chrome-extension/' + f), 'utf8'))).join('\n'); ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|_askJson|\.generate\(/.test(all), 'D1 檔案沒有任何網路或 AI 呼叫'); }
      const town = fs.readFileSync(path.join(__dirname, '../chrome-extension/town.html'), 'utf8'); const sw = fs.readFileSync(path.join(__dirname, '../chrome-extension/sw.js'), 'utf8'); ok(!/psy-core|psy-loan|psy-world|psy-fire/.test(town + sw), '正式遊戲頁與快取清單都沒有載入 D1 檔案'); }

    console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();


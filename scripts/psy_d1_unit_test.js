// 擬人化智能體 D1 單元測試：共用評估流程（純 Node，不開瀏覽器、不連網、不呼叫任何 AI）
// 用一個手寫的小世界（阿明、阿華、阿明的孩子）測快照、資訊邊界、驗證、兩階段、快取、故障、重播。
// 評估器全部是「人工標記的固定回應」（label: TEST_FIXTURE_HANDWRITTEN），只驗工程流程，不代表任何角色行為。
// 用法：node scripts/psy_d1_unit_test.js
const path = require('path'); const fs = require('fs'); const crypto = require('crypto');
const PSY = require(path.join(__dirname, '../chrome-extension/psy-core.js'));
const LOAN = require(path.join(__dirname, '../chrome-extension/psy-loan.js'));
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
    };
    return w;
}
const ev = (o = {}) => Object.assign({ id: 'ev1', decision: 'dc1', agent: 'aming', from: 'hua', n: 30, said: null, world: '測試鎮' }, o);
const snap = (w, e) => PSY.snapshot(w, LOAN, e || ev());

// 人工標記的固定回應（依輸入的編號產生；只驗流程）
function fixtureFor(input, over = {}) {
    const has = (id) => PSY.idSet(input).has(id);
    const concerns = [{ id: 'c1', what: '手上的錢夠不夠應付家裡的開銷', ev: ['s_cash'].concat(has('d_known_total') ? ['d_known_total'] : []) }, { id: 'c2', what: '阿華開口了，想回應他', ev: ['o_req'] }];
    const impacts = [
        { opt: 'lend', expect: [{ what: '照他說的借出 30 後，身上剩 20 銀幣', who: ['aming'], status: 'derived', ev: ['d_after_req'] }, { what: '他大概會還', who: ['hua'], status: 'inferred', ev: ['v_promise'] }], like: ['c2'], dislike: ['c1'], unsure: ['他什麼時候能還'] },
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
      const owners = new Set(s.audit.manifest.map(m => m.owner)); ok([...owners].every(o => ['self', 'household', 'public'].includes(o)), '讀取清單只有本人、同戶、公開', [...owners].join(','));
      const txt = PSY.stable(s.input); ok(!txt.includes('私房錢'), '阿華的私人記憶不在輸入裡'); ok(!/\b300\b/.test(txt), '阿華的存款不在輸入裡'); }

    console.log('— 只改隱藏財務：本人輸入與候選清單不變');
    { const a = snap(world()).input; const w2 = world(); w2.wallet.bal.hua = 98765.43; w2.bank.dep.hua = 4321; w2.agents.hua.memory.entries.push({ tick: 9500, content: '我打算不還了', importance: 9, relatedAgents: [] }); w2.agents.hua.relationships.relationships.aming.affinity = -90;
      const b = snap(w2).input; ok(PSY.hashOf(a) === PSY.hashOf(b), '隱藏資料改變後輸入雜湊相同', JSON.stringify(PSY.diff(a, b)).slice(0, 200)); ok(PSY.stable(a.options) === PSY.stable(b.options), '候選清單相同'); ok(!PSY.stable(b).includes('98765'), '隱藏現金數字沒有出現在輸入'); }

    console.log('— 讀別人私有資料會被擋下（技術錯誤，不是角色行為）');
    { const bad = Object.assign({}, LOAN, { build(R, e) { R.cashOf('hua'); return LOAN.build(R, e); } }); const s = PSY.snapshot(world(), bad, ev()); ok(s.input === null && /boundary:read_other_cash/.test(s.audit.error), '讀別人現金 → BoundaryError', s.audit.error);
      const bad2 = Object.assign({}, LOAN, { build(R, e) { R.ailmentsOf('hua', R.household()); return LOAN.build(R, e); } }); const s2 = PSY.snapshot(world(), bad2, ev()); ok(s2.input === null && /read_other_health/.test(s2.audit.error), '讀非同戶的病歷 → BoundaryError'); }

    console.log('— 已知醫療支出、還款經歷、朋友說法：資料正確反映差異');
    { const a = snap(world()).input; const w2 = world(); w2.health.a.kid = []; const b = snap(w2).input;
      ok(a.self.obligations.length === 1 && b.self.obligations.length === 0, '孩子沒病時沒有醫療支出');
      ok(a.derived.some(d => d.id === 'd_after_req_vs_known' && /不夠/.test(d.what)) && !b.derived.some(d => d.id === 'd_after_req_vs_known'), '算術：借 30 後剩 20 不夠 60（只在有支出時）', JSON.stringify(a.derived.map(d => d.what)));
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
      const w3 = world(); w3.health.a.kid = []; const r3 = await PSY.evaluate(snap(w3), [E], { cache }); ok(!r3.from_cache && r3.fail === 'no_response', '醫療支出改變 → 快取失效');
      const r4 = await PSY.evaluate(snap(world(), ev({ n: 20 })), [E], { cache }); ok(!r4.from_cache, '借款金額改變 → 快取失效');
      const E2 = Object.assign({}, E, { version: '2' }); const r5 = await PSY.evaluate(s0, [E2], { cache }); ok(!r5.from_cache, '評估器版本改變 → 快取失效');
      const w6 = world(); w6.wallet.bal.hua = 999; const r6 = await PSY.evaluate(snap(w6), [E], { cache }); ok(r6.from_cache, '只改隱藏資料 → 輸入相同，快取照常命中（證明快取沒有讀隱藏資料）'); }

    console.log('— 研究紀錄、重複回應、重播一致');
    { const log = new PSY.ResearchLog(); const E = PSY.ReplayEvaluator(fx(I)); await PSY.evaluate(s0, [E], { log }); await PSY.evaluate(s0, [E], { log }); ok(log.rows.length === 1 && log.rejected[0]?.reason === 'duplicate_response', '同一決策的第二份回應被拒收');
      const a = await PSY.evaluate(s0, [PSY.ReplayEvaluator(fx(I))]); const b = await PSY.evaluate(s0, [PSY.ReplayEvaluator(fx(I))]); ok(PSY.stable(a) === PSY.stable(b), '同一份回應重播兩次，紀錄逐字相同');
      const w2 = world(); w2.health.a.kid = []; const dd = PSY.diff(I, snap(w2).input); ok(dd.some(x => x.path.startsWith('self.obligations')) && dd.some(x => x.path.startsWith('derived')), '差異比較列出改變的欄位', dd.map(x => x.path).join(' ')); }

    console.log('— 輸入驗證：不准帶分數、不准引擎替角色推測');
    { const bad = Object.assign({}, LOAN, { build(R, e) { const d = LOAN.build(R, e); d.options[0].base = 1.2; d.views.push({ id: 'v_x', about: 'hua', kind: 'inferred', what: '他會還' }); return d; } }); const s = PSY.snapshot(world(), bad, ev()); const er = PSY.validateInput(s.input);
      ok(er.some(e => e.startsWith('forbidden_key:') && e.endsWith('base')) && er.some(e => e.startsWith('view_kind:v_x')), '選項帶 base、引擎提供推測 → 輸入驗證失敗', er.join(',')); const r = await PSY.evaluate(s, [PSY.ReplayEvaluator({})]); ok(r.fail === 'invalid_input', '輸入不合格就不評估'); }

    console.log('— 原始碼檢查：共用核心不看事件名稱、不用亂數、不碰結算');
    { const core = fs.readFileSync(path.join(__dirname, '../chrome-extension/psy-core.js'), 'utf8'); const loan = fs.readFileSync(path.join(__dirname, '../chrome-extension/psy-loan.js'), 'utf8'); const code = (s) => s.split('\n').filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/\s\/\/\s.*$/, '')).join('\n'); // 去掉整行與行尾註解
      ok(!/['"]asked['"]/.test(code(core)) && !/kind\s*===/.test(code(core)), '核心沒有事件名稱判斷');
      ok(!/Math\.random\(\)/.test(code(core).replace(/Math\.random = function[^;]*;/, '')) && !/Math\.random/.test(code(loan)), '核心與 adapter 不呼叫亂數');
      ok(!/\.run\(|applyAi|lendTo|giveTo|refuseLoan|modifyAffinity|addThought|memory\.add|WALLET\./.test(code(core) + code(loan)), '不呼叫結算、心理或錢包函式');
      const town = fs.readFileSync(path.join(__dirname, '../chrome-extension/town.html'), 'utf8'); const sw = fs.readFileSync(path.join(__dirname, '../chrome-extension/sw.js'), 'utf8'); ok(!/psy-core|psy-loan/.test(town + sw), '正式遊戲頁與快取清單都沒有載入 D1 檔案'); }

    console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();

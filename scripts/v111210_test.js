// v11.12.1 提案說明不再出現 [object Object]
//   提案的說明是「一句範本＋參數」。參數可以是一段要再填字的句子 { k, p }，或不翻譯的原文 { raw }（空字串＝這一段不寫）。
//   以前 sim-proposals.js 的 _fill 一律把參數轉成文字，任命官員（沒有利益衝突時）與公庫向銀行借錢的說明就出現 [object Object]。
//   用法：BASE=http://localhost:8193/ node scripts/v111210_test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8193/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
async function run(browser, lang) {
  console.log(lang); const L = `[${lang}] `;
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; w.reset(); w.observerMode = true; w.fullAgentMode = false; ORIGIN.seed(w, 3, { seed: 5 }); const P = w.proposals; const out = {};
    const bad = (s) => /\[object |undefined|\{[a-z]+\}/i.test(String(s));
    // 一、填字本身
    out.rawEmpty = P._fill('甲{c}乙', { c: { raw: '' } }); out.rawText = P._fill('甲{c}乙', { c: { raw: 'X' } });
    out.nested = P._fill('{past}{un}', { past: { k: '這一年已經借過 {k} 次，{x}。', p: { k: 2, x: { k: '最近 60 天有 {m} 次付不出利息', p: { m: 1 } } } }, un: { k: '鎮上有 {u} 個人不放心首長管錢。', p: { u: 3 } } });
    out.plain = P._fill('{a}／{n}／{z}／{l}', { a: '農夫', n: 10.5, z: null, l: [1, 2] });
    // 二、任命官員：稅務員沒有利益衝突那一段，說明結尾不能多出東西
    const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18); const M = w.agents[TIERS.holderId(w)] || npcs[0]; const a = npcs.find(x => x !== M);
    for (const post of Object.keys(OFFICE.POSTS)) { for (const p of P.items) if (p.kind === 'office_appoint' && ['open', 'shelved'].includes(p.status)) p.status = 'rejected'; let p = null; try { p = OFFICE.nominate(w, M, post, a); } catch (e) { out['err_' + post] = String(e); } (out.office = out.office || {})[post] = p ? { desc: P.desc(p), title: P.title ? P.title(p) : P._fill(p.tk, p.tp) } : null; }
    // 四、跑 30 天，所有提案的標題與說明、動態訊息都不能出現沒填好的東西
    for (let i = 0; i < 30; i++) { const d0 = w._absDay(); let k = 0; while (w._absDay() === d0 && k < 400) { w.paused = false; w.tick(); k++; } }
    // 三、公庫向銀行借錢（跑過 30 天、有固定支出之後才借得出來）：沒借過、沒有人不放心時那兩段是空的
    try { const B = w.bank || (w.bank = {}); if (!B.open || !B.banker) { B.open = true; B.banker = (npcs.find(x => x !== M && x !== a) || a).agentId; B.deposits = B.deposits || {}; } B.reserve = Math.max(B.reserve || 0, 5000); FISCAL.S(w).bankAsk = null; FISCAL.S(w).bankNo = null; FISCAL.S(w).last.fisc_bond = -999; if (FISCAL.S(w).bond) FISCAL.S(w).bond = null; { const M2 = w.agents[TIERS.holderId(w)]; if (M2) out.M2 = 1; } for (const p of P.items) if (p.kind === 'fisc_bond' && ['open', 'shelved', 'approved'].includes(p.status)) p.status = 'rejected';
      out.offer = FISCAL.bondOffer(w); const p = FISCAL.propose(w, 'fisc_bond', M, ''); out.bond = p ? { desc: P.desc(p), title: P._fill(p.tk, p.tp) } : null; } catch (e) { out.bondErr = String(e); }
    const items = P.items; out.n = items.length; out.badProps = items.map(p => ({ id: p.id, kind: p.kind, t: P._fill(p.tk, p.tp), d: P.desc(p) })).filter(x => bad(x.t) || bad(x.d)).slice(0, 5);
    // 五、記憶與動態共用的填字（Memory.render）：{ raw } 照放、舊存檔寫壞的句子拿掉那一段；離開小鎮的原因可以是 { k, p }
    out.mem = [Memory.render('我在{p}又跟{b}吵了起來', { p: { raw: '廣場' }, b: '甲' }), Memory.render('🧳 {line}', { line: '乙收拾行李離開了鎮上（[object Object]）。' }), Memory.render('{a}{z}', { a: { k: '查到{x}', p: { x: { raw: '少報' } } }, z: null })];
    { const lv = npcs.filter(x => w.agents[x.agentId] && x.agentId !== TIERS.holderId(w)).slice(-1)[0]; const n0 = (w.messageLog || []).length; if (lv) { w.leaveTown(lv.agentId, { k: '被{p}高薪挖走', p: { p: { raw: '外地商號' } } }); out.leave = { line: (w.messageLog || []).map(m => String(m.content || '')).filter(x => x.includes('🧳')).slice(-1)[0] || '', reason: w.movedOut.slice(-1)[0]?.reason }; } }
    let memN = 0; const badMem = []; for (const a2 of Object.values(w.agents)) for (const m of (a2.memory?.entries || [])) { memN++; const c = String(m.content || ''); if (/\[object /.test(c) && badMem.length < 5) badMem.push(c.slice(0, 120)); } out.memN = memN; out.badMem = badMem;
    out.logN = (w.messageLog || []).length; out.badLogs = (w.messageLog || []).map(m => String(m.content || '')).filter(s => /\[object /.test(s)).slice(0, 5); out.kinds = [...new Set(items.map(p => p.kind))].length;
    out.cjk = (s) => 0; out.lang = LLM_LANG.get(); return out; });
  ok(r.rawEmpty === '甲乙' && r.rawText === '甲X乙', L + '空的一段不寫、原文照放', [r.rawEmpty, r.rawText]);
  ok(!/\[object |\{/.test(r.nested) && /2/.test(r.nested) && /3/.test(r.nested) && /1/.test(r.nested) && r.nested.length > 20, L + '句子裡再包句子，一層一層填好', r.nested);
  ok(!/\[object /.test(r.plain) && /10\.5/.test(r.plain) && /1,2/.test(r.plain) && !/null/.test(r.plain), L + '字串、數字、清單照舊；沒有值的不寫', r.plain);
  const off = Object.entries(r.office || {}); ok(off.length >= 2 && off.every(([, v]) => v && !/\[object |\{[a-z]+\}/.test(v.desc) && !/\[object /.test(v.title)), L + `任命官員的說明沒有 [object Object]（${off.length} 個職位）`, r.office);
  ok(r.office?.tax && /[。.]\s*$/.test(r.office.tax.desc.trim()), L + '稅務員的說明停在句號', r.office?.tax);
  ok(r.bond && !/\[object |\{[a-z]+\}/.test(r.bond.desc) && !/\[object /.test(r.bond.title), L + '公庫向銀行借錢的說明沒有 [object Object]', r.bond || { offer: r.offer, err: r.bondErr });
  ok(r.n >= 5 && r.badProps.length === 0, L + `跑 30 天：${r.n} 個提案（${r.kinds} 種）的標題與說明都填好了`, r.badProps);
  ok(r.badLogs.length === 0, L + `動態訊息 ${r.logN} 則沒有 [object`, r.badLogs);
  ok(r.mem && !r.mem.some(x => /\[object |\{|null/.test(x)) && /廣場/.test(r.mem[0]) && !/（）|\(\)/.test(r.mem[1]) && /少報/.test(r.mem[2]), L + '記憶與動態的填字：原文照放、舊存檔寫壞的那一段拿掉', r.mem);
  ok(r.leave && !/\[object /.test(r.leave.line) && /外地商號/.test(r.leave.line) && typeof r.leave.reason === 'string', L + '離開小鎮的原因是一段句子時照樣寫得出來', r.leave);
  ok(r.memN > 100 && r.badMem.length === 0, L + `全鎮記憶 ${r.memN} 則沒有 [object`, r.badMem);
  if (lang === 'en') { const all = [r.nested, ...off.map(([, v]) => v?.desc || ''), r.bond?.desc || '']; ok(all.every(s => !/[一-鿿]/.test(s.replace(/[一-鿿]{2,4}(?=[\s,.:'’]|$)/g, ''))), L + '英文模式：補上的句子是英文', all.filter(s => /[一-鿿]/.test(s)).slice(0, 3)); }
  ok(errs.length === 0, L + '沒有頁面錯誤', errs.slice(0, 3)); await page.context().close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); for (const lang of ['zh', 'en']) await run(browser, lang); await browser.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();

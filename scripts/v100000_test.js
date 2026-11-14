// v10.0.0 讓村民有人性。不連線、不呼叫真的 AI：AI 的回答用 DECIDE.applyAi 直接餵，其餘都是真的遊戲程式。
// 看：1. 題目裡有「跟這件事有關的往事」 2. 回答多帶「出於什麼」「嘴上怎麼說」，對方記得的是嘴上那句
//     3. 照個性推估時不受影響 4. 名下有產業的人不能當工會的人 5. 提案被否決的理由回到提案人身上 6. 介面
// 用法：node scripts/v100000_test.js     需要本機服務 chrome-extension/（預設 8126，可用 BASE 換）
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/'; const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'test-results', 'humanlike');
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 700) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function open(browser, lang, vp) {
  const page = await (await browser.newContext({ viewport: vp, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  return { page, errs };
}
const stage = () => {
  const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {}; app._showCornerNotice = () => {};
  let s = 7; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 22 }); w.observerMode = true; app._fullAgentOn = () => false; try { app._visitorMailboxTick(); } catch (e) {} w.fullAgentMode = false; WALLET.S(w);
  const out = {}; const tickN = (n) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); } };
  tickN(96 * 12); SCHEME.S(w).quiet = true; for (const P of SCHEME.S(w).list) if (P.stage === 'recruit' || P.stage === 'set') { P.stage = 'dropped'; P.out = { ok: false, k: '作罷', p: {} }; }
  // 照個性推估的決定：不該有「出於什麼」「嘴上說」
  const X = DECIDE.S(w); out.ruleExtra = Object.values(X.log).flat().filter(e => e.feel || e.pub).length; out.ruleN = Object.values(X.log).flat().length;
  const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId)); const [a, b, c] = A;
  const setAff = (x, y, v) => { const r = x.relationships.getOrCreate(y.agentId, y.name); r.modifyAffinity(v - (r.affinity || 0)); };
  // 1. 往事：b 來找 a 一起做事；a 記得兩件跟 b 有關的事，上次也回過他
  setAff(a, b, -45); a.memory.addT(w.tickCount, w.clock.timeStr, 'social', '{b}上個月借了我十銀幣，到現在沒還。', { b: b.name }, 8, [b.name]); a.memory.addT(w.tickCount, w.clock.timeStr, 'social', '{b}在酒館當眾笑我窮。', { b: b.name }, 7, [b.name]);
  a.memory.addT(w.tickCount, w.clock.timeStr, 'social', '今天天氣不錯。', {}, 9, []);
  const P = SCHEME.create(w, b, { tone: 'fun', title: '在廣場辦一場擲石頭比賽', why: '想熱鬧一下', helpers: [a], ai: true }); const K = DECIDE.KINDS.schemeAsk; const ctx = { sid: P.id };
  const facts = K.facts(w, a, ctx); out.facts = facts.includes(b.name);
  const inv = DECIDE.involved(w, a, facts).map(x => x.name); out.involved = inv.length === 1 && inv[0] === b.name;
  const past0 = DECIDE.pastLines(w, a, K, facts, 46); out.past0 = past0;
  const opts = K.options(w, a, ctx); const pr = DECIDE.prompt(w, K, [{ a, K, ctx, opts }]); const ce = w.conversationEngine;
  out.prompt = { len: pr.length, max: ce._promptMax ? ce._promptMax() : 0, hasBlock: pr.includes('【跟這件事有關的往事】'), hasMem: pr.includes('沒還') && pr.includes('笑我窮'), noUnrelated: !pr.split('【跟這件事有關的往事】')[1]?.split('【遇到的事】')[0]?.includes('天氣'), hasFeel: pr.includes('"feel"') && pr.includes('賭氣'), hasSay: pr.includes('"say"'), hasHuman: pr.includes('嚥不下這口氣') };
  // 2. AI 回答：不划算的選擇，有出於什麼，嘴上說的跟心裡想的不一樣
  const m0 = b.memory.entries.length;
  DECIDE.applyAi(w, a, K, ctx, opts, { pick: 'no', why: '他欠我十銀幣還當眾笑我窮，我才不去捧他的場', feel: '賭氣', say: '那天我店裡走不開' });
  const e1 = (X.log[a.agentId] || []).slice(-1)[0]; out.log = { feel: e1?.feel, pub: e1?.pub, ai: e1?.ai };
  const n1 = NOTES.S(w).list.filter(e => e.who === a.agentId).slice(-1)[0]; out.note = { f: n1?.f, s: n1?.s, y: n1?.y?.raw }; const f1 = NOTES.feed(w, 5)[0]; out.feed = { feel: f1?.feel, pub: f1?.pub, text: f1?.text };
  const heard = b.memory.entries.slice(m0).map(e => e.content || Memory.render(e.k, e.p || {})); out.heard = { said: heard.some(x => x.includes('走不開')), inner: heard.some(x => x.includes('笑我窮')) };
  // 嘴上說的跟心裡想的一樣：不另外記
  const P2 = SCHEME.create(w, c, { tone: 'fun', title: '請大家喝一杯', why: '好久沒聚', helpers: [a], ai: true }); const o2 = K.options(w, a, { sid: P2.id }); DECIDE.applyAi(w, a, K, { sid: P2.id }, o2, { pick: 'join', why: '好啊我去', feel: '義氣', say: '好啊我去' });
  const e2 = (X.log[a.agentId] || []).slice(-1)[0]; out.same = { feel: e2?.feel, pub: e2?.pub || '' };
  // 下一次遇到跟 b 有關的事：往事裡有上次的決定和後果、也有「同樣的事上次怎麼選」
  const past1 = DECIDE.pastLines(w, a, K, facts, 46); out.past1 = past1;
  // 3. 工會：名下有產業的人不能是工會的人
  try { const M = MARKET; const U = UNION.S(w); const ks = Object.keys(M.SECTORS); const ws = UNION.privateWorkers(w, Object.values(w.agents).filter(x => !x.isPlayer && !x.isDead));
    const L = ws[0], m2 = ws[1]; out.union = { ws: ws.length };
    if (L && m2) { U.on = true; U.name = '測試工會'; U.leader = L.agentId; U.members = { [L.agentId]: 1, [m2.agentId]: 1 }; U.founded = 1;
      const kL = UNION.sectorOf(w, L); const other = ks.find(k => k !== kL && M.ownerOf(w, k) && M.ownerOf(w, k) !== L.agentId); const old = M.S(w).owners[other]; M.S(w).owners[other] = L.agentId; // L 買下了另一個產業
      out.union.talkSelf = UNION.talkInfo(w, other) === null; out.union.cantJoin = UNION.join(w, L) === false && !UNION.privateWorkers(w, [L]).length; out.union.cantOrg = UNION.canOrganize(w, L) === 0;
      UNION.membership(w, Object.values(w.agents).filter(x => !x.isPlayer && !x.isDead), w._absDay()); out.union.after = { leader: U.leader, lWas: L.agentId, stillMember: !!U.members[L.agentId], on: U.on, newLeader: U.leader === m2.agentId };
      M.S(w).owners[other] = old; U.on = false; U.leader = null; U.members = {}; } } catch (e) { out.unionErr = String(e.stack || e).slice(0, 300); }
  // 4. 提案被否決：理由回到提案人身上
  try { const PS = w.proposals; const p = PS.items.find(x => x.status === 'open') || (() => { for (let i = 0; i < 96 * 6 && !PS.items.some(x => x.status === 'open'); i++) { w.paused = false; w.tick(); } return PS.items.find(x => x.status === 'open'); })();
    if (p) { const pa = w.agents[p.proposerId]; const k0 = pa ? pa.memory.entries.length : 0; p.votes = {}; p.why = {}; const vs = A.filter(x => x.agentId !== p.proposerId).slice(0, 5); vs.forEach((x, i) => { p.votes[x.agentId] = 'against'; p.why[x.agentId] = i === 0 ? 'llm:公庫都快空了，這錢花不得' : 'gut'; });
      PS._decide(w, p, 'reject', 'auto'); const got = pa ? pa.memory.entries.slice(k0).map(e => e.content || Memory.render(e.k, e.p || {})) : []; out.rej = { status: p.status, got: got.filter(x => x.includes('否決')), hasWhy: got.some(x => x.includes('公庫都快空了')) }; } else out.rej = { none: true }; } catch (e) { out.rejErr = String(e.stack || e).slice(0, 300); }
  try { app.state = w.getState(); app._kairoCardOpen = true; app.activeTab = 'proposals'; app._ppTab = 'voices'; app.renderSidebar(); } catch (e) { out.renderErr = String(e); }
  out.aid = a.agentId; return out;
};
(async () => {
  const browser = await chromium.launch(); fs.mkdirSync(SHOTS, { recursive: true });
  const { page, errs } = await open(browser, 'zh', { width: 1280, height: 860 });
  const R = await page.evaluate(stage);
  ok(R.ruleN > 20 && R.ruleExtra === 0, 'AI 關著跑 12 天：照個性推估的決定沒有多出「出於什麼」「嘴上說」', [R.ruleN, R.ruleExtra]);
  ok(R.facts && R.involved, '從題目裡認得出這件事牽涉到誰', [R.facts, R.involved]);
  ok(R.past0.length >= 1 && /結過怨/.test(R.past0[0]) && /沒還/.test(R.past0[0]) && /笑我窮/.test(R.past0[0]) && !/天氣/.test(R.past0.join()), '往事：只挑跟那個人有關的記憶（更重要但無關的不放），還寫出兩人的交情', R.past0);
  ok(R.prompt.hasBlock && R.prompt.hasMem && R.prompt.noUnrelated, '題目裡有「跟這件事有關的往事」這一段', R.prompt);
  ok(R.prompt.hasFeel && R.prompt.hasSay && R.prompt.hasHuman, '題目要他說出這次出於什麼、嘴上怎麼說，也允許賭氣吃虧', R.prompt);
  ok(R.prompt.len > 300 && (!R.prompt.max || R.prompt.len <= R.prompt.max), '題目長度沒超過上限', [R.prompt.len, R.prompt.max]);
  ok(R.log.feel === '賭氣' && R.log.pub === '那天我店裡走不開' && R.log.ai === 1, 'AI 回答後：決定紀錄記下「出於賭氣」和他嘴上的說法', R.log);
  ok(R.note.f === '賭氣' && R.note.s === '那天我店裡走不開' && /笑我窮/.test(R.note.y) && R.feed.feel === '賭氣' && R.feed.pub === '那天我店裡走不開', '手記與心聲卡片：心裡想的、嘴上說的、出於什麼都在', [R.note, R.feed]);
  ok(R.heard.said && !R.heard.inner, '對方記得的是他嘴上說的那句，不知道他心裡想什麼', R.heard);
  ok(R.same.feel === '義氣' && R.same.pub === '', '嘴上說的跟心裡想的一樣時不另外記', R.same);
  ok(R.past1.some(x => /推掉/.test(x) && /天前|今天/.test(x)) && R.past1.some(x => /同樣的事/.test(x)), '下一次遇到同一個人、同一類事：往事裡有上次怎麼選', R.past1);
  ok(!R.unionErr && R.union?.talkSelf && R.union?.cantJoin && R.union?.cantOrg, '工會：名下有產業的人不能入會、不能帶頭，也不會出現領袖跟自己談判', [R.union, R.unionErr]);
  ok(R.union?.after && !R.union.after.stillMember && R.union.after.leader !== R.union.after.lWas && R.union.after.newLeader, '工會：領袖買下產業當了老闆，就退出工會、換人當領袖', R.union?.after);
  ok(!R.rejErr && R.rej && R.rej.status === 'rejected' && R.rej.hasWhy, '提案被否決：提案人記得反對的人說了什麼', [R.rej, R.rejErr]);
  // 介面：心聲卡片
  const card = page.locator('.pv-card').filter({ hasText: '笑我窮' }).first();
  ok(await card.count() === 1 && /出於：賭氣/.test(await card.innerText()) && /心裡想/.test(await card.innerText()) && /嘴上說/.test(await card.innerText()) && /走不開/.test(await card.innerText()), '心聲卡片：看得到「出於：賭氣」、心裡想的、嘴上說的', (await card.innerText().catch(() => '')).slice(0, 200));
  await page.evaluate(() => document.getElementById('season-recap')?.remove()); await page.screenshot({ path: path.join(SHOTS, 'desktop-voices.png') });
  await page.evaluate((id) => NOTES.openBook(window.rimtownApp, id), R.aid); await page.waitForSelector('#notes-book .nb-entry'); const nb = await page.locator('#notes-book .nb-body').innerText();
  ok(/出於：賭氣/.test(nb) && /心裡想/.test(nb) && /嘴上說/.test(nb), '手記裡也看得到', nb.slice(0, 200)); await page.keyboard.press('Escape');
  ok(errs.length === 0, '桌機沒有頁面錯誤', errs.slice(0, 3)); await page.context().close();
  for (const [lang, name] of [['zh', '手機中文'], ['en', '手機英文']]) {
    const m = await open(browser, lang, { width: 390, height: 844 }); const R2 = await m.page.evaluate(stage); await m.page.waitForTimeout(400);
    const lay = await m.page.evaluate(() => { const wide = document.documentElement.scrollWidth > window.innerWidth + 1; const cards = [...document.querySelectorAll('.pv-card')].filter(b => b.offsetParent); const over = [...document.querySelectorAll('.pv-card, .pv-feel, .pv-pub')].filter(b => b.offsetParent && b.getBoundingClientRect().right > window.innerWidth + 1).map(b => b.className);
      return { wide, shown: cards.length, over, txt: (cards.find(c => c.querySelector('.pv-pub'))?.innerText || '').slice(0, 300) }; });
    ok(!lay.wide && lay.over.length === 0 && lay.shown >= 2, `${name}：面板打開、卡片在畫面內，沒有橫向捲動`, lay);
    ok(lang === 'en' ? (/Driven by/.test(lay.txt) && /Thinks/.test(lay.txt) && /Says/.test(lay.txt) && !/出於|心裡想|嘴上說/.test(lay.txt)) : (/出於/.test(lay.txt) && /嘴上說/.test(lay.txt)), `${name}：出於什麼、心裡想、嘴上說的標籤用對語言`, lay.txt);
    ok(R2.prompt.hasBlock || lang === 'en', `${name}：題目照樣組得出來`, R2.prompt);
    await m.page.evaluate(() => document.getElementById('season-recap')?.remove()); await m.page.screenshot({ path: path.join(SHOTS, `mobile-${lang}.png`) }); ok(m.errs.length === 0, `${name}：沒有頁面錯誤`, m.errs.slice(0, 3)); await m.page.context().close();
  }
  await browser.close(); console.log(`\n${pass} checks passed, ${fail} failed；截圖在 test-results/humanlike/`); process.exit(fail ? 1 : 0);
})();

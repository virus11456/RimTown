// v9.15.0 自己打一句話當事件:神寫下一句話,它就在鎮上真的發生(規則版看關鍵字、AI 版寫成一件事),效果只能用白名單、數值夾住;
// 花 6 神力、一天一次;記進反應追蹤、全鎮記得、日報;送錢記進金流帳;手牌最前面有「寫一句話」;存讀檔
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_god_sandbox', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(async (lang) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
    const w = app.world; w.observerMode = true; const out = {};
    const P = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
    const C = CALAMITY.S(w); const fresh = () => { WISH.S(w).day = null; C.power = 50; };
    const logs = () => (w.messageLog || []).map(m => m.content || '').join('\n');
    try {
      // 規則版:下大雨
      fresh(); const food0 = w.stockpile.get('food'), pw0 = C.power; const n0 = (w.eventCards?.played || []).length;
      const r1 = await WISH.cast(w, lang === 'en' ? 'A heavy rain falls on the fields' : '一場大雨落在田裡');
      const last = (w.eventCards.played || []).slice(-1)[0];
      out.rain = { ok: r1.ok, weather: w.weather?.current, food: Math.round(w.stockpile.get('food') - food0), power: Math.round((pw0 - C.power) * 10) / 10, played: (w.eventCards.played || []).length - n0, id: last?.id, wish: last?.wish, reacts: last?.reactions?.length || 0, snap: !!last?.snap, ai: r1.ev?.ai, log: /✍️/.test(logs()) };
      out.mem = P().filter(a => (a.memory?.entries || []).slice(-6).some(m => /鎮上出了事|Something happened in town|happened in town/.test(m.content || ''))).length / P().length;
      // 一天一次、神力不夠、空白
      out.daily = (await WISH.cast(w, '再下一場雨')).why;
      WISH.S(w).day = null; C.power = 2; out.power = (await WISH.cast(w, '再下一場雨')).why;
      fresh(); out.empty = (await WISH.cast(w, ' ')).why;
      // 白名單、夾數值
      const A = P()[0], B = P()[1];
      const fx = WISH.sanitize(w, [{ type: 'resource', res: 'food', amount: 9999 }, { type: 'resource', res: 'silver', amount: 100 }, { type: 'gift', who: A.name, amount: 500 }, { type: 'weather', key: 'lava', days: 9 }, { type: 'weather', key: 'snow', days: 9 }, { type: 'hurt', n: 10 }, { type: 'hack', x: 1 }, { type: 'relation', a: A.name, b: '不存在的人', amount: 20 }]);
      out.fx = fx.map(e => e.type + ':' + (e.amount ?? e.days ?? e.n ?? ''));
      // AI 版:模擬 AI 回應
      const ce = w.conversationEngine; const save = { can: ce.llm?._canMakeRequest, ask: ce._askJson };
      if (!ce.llm) ce.llm = {}; ce.llm._canMakeRequest = () => true;
      let prompt = ''; ce._askJson = async (p) => { prompt = p; return { title: lang === 'en' ? 'Golden coins' : '河裡的金幣', icon: '💰', story: lang === 'en' ? `${t(A.name)} fished a chest out of the river.` : `${A.name}在河邊撈到一箱金幣。`, effects: [{ type: 'gift', who: t(A.name), amount: 80 }, { type: 'resource', res: 'food', amount: 999 }, { type: 'mood', who: 'name:' + t(B.name), amount: 5 }, { type: 'nuke' }], reactions: [{ name: t(A.name), line: lang === 'en' ? 'I am rich!' : '我發財了！' }, { name: '路人甲', line: 'x' }] }; };
      fresh(); const cash0 = WALLET.get(w, A); const tot0 = MONEY.total(w); const d = w._absDay(); const ev0 = MONEY.S(w).days[d]?.event || 0; const f1 = w.stockpile.get('food');
      const r2 = await WISH.cast(w, lang === 'en' ? 'Someone finds treasure by the river' : '有人在河邊撈到寶藏');
      ce.llm._canMakeRequest = save.can; ce._askJson = save.ask;
      out.ai = { ok: r2.ok, ai: r2.ev?.ai, title: r2.ev?.title, cash: Math.round(WALLET.get(w, A) - cash0), food: Math.round(w.stockpile.get('food') - f1), thought: A.currentThought, reacts: r2.ev?.reactions?.length, prompt: prompt.includes(t(A.name)) && prompt.length > 200, money: Math.round((MONEY.total(w) - tot0) - ((MONEY.S(w).days[d]?.event || 0) - ev0)), affected: r2.ev?.affected?.includes(A.agentId) };
      // 規則版:吵架、生病、慶典
      fresh(); const r3 = await WISH.cast(w, lang === 'en' ? 'A flu spreads and two neighbors quarrel' : '風寒傳開，兩個鄰居吵架'); out.combo = { ok: r3.ok, lines: r3.ev?.lines?.length, sick: Object.values(HEALTH.S(w).a || {}).filter(L => L.some(x => x.k === 'fever')).length };
      // 存讀檔
      const blob = JSON.parse(JSON.stringify(w.serialize())); w.loadSave(blob); out.load = { last: !!w.wish?.last, n: w.wish?.n, day: w.wish?.day === d };
      // 介面:手牌最前面、打字、範例、送出、鏡頭
      WISH.S(w).day = null; C.power = 50; app._ghSel = null; app._ghFilter = 'all'; app._ghTab = 'hand'; app._ghShow();
      const tray = document.getElementById('gh-tray'); const first = tray.querySelector('.gh-hand .gh-card');
      out.ui = { first: first?.dataset.v };
      first.click(); const ta = () => document.getElementById('gh-wish-in');
      out.ui.ta = !!ta(); out.ui.font = parseFloat(getComputedStyle(ta()).fontSize);
      tray.querySelector('[data-gh="wish-ex"]').click(); out.ui.ex = ta().value.length > 2;
      ta().focus(); ta().value = lang === 'en' ? 'A bard sings all night long' : '有個詩人唱了一整夜'; ta().dispatchEvent(new Event('input', { bubbles: true }));
      const el0 = ta(); app._ghRefresh(); out.ui.keep = ta() === el0 && ta().value.length > 4;
      tray.querySelector('[data-gh="wish-go"]').click(); for (let i = 0; i < 100 && (WISH.S(w).busy || app._ghOpen); i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 150)); /* 等「命運正在寫…」結束（先問 AI、沒回覆才照規則寫）：固定等 0.4 秒有時還沒寫完 */
      out.ui.closed = !app._ghOpen; out.ui.follow = !!app.tileMap?._followAgent; out.ui.lastText = WISH.S(w).last?.text;
      app._ghShow(); out.ui.blocked = document.querySelector('#gh-tray .gh-card[data-v="wish"]')?.classList.contains('blocked');
      out.ui.note = document.querySelector('#gh-tray .gh-wish .gh-d-note')?.textContent || '';
      app._ghTab = 'track'; app._ghRender(); out.ui.track = (document.querySelector('#gh-tray .gh-track')?.textContent || '').includes(WISH.S(w).last.title);
      app._ghHide();
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 600); }
    return out;
  }, lang);
  console.log(lang, JSON.stringify(r));
  const tag = `[${lang}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.rain && r.rain.ok && r.rain.weather === 'rain' && r.rain.food >= 30 && r.rain.power === 6, `${tag} 寫「下大雨」：真的下雨、田多了糧食、花 6 神力`, r.rain);
  ok(r.rain && r.rain.played === 1 && r.rain.id === 'wish' && r.rain.wish && r.rain.reacts >= 1 && r.rain.snap && r.rain.log, `${tag} 記進反應追蹤（有村民反應、七天後比較用的快照），動態有 ✍️`, r.rain);
  ok(r.mem > 0.9, `${tag} 全鎮都記得這件事`, r.mem);
  ok(r.daily === 'daily' && r.power === 'power' && r.empty === 'empty', `${tag} 一天一次、神力不夠不行、空白不行`, { daily: r.daily, power: r.power, empty: r.empty });
  ok(r.fx && r.fx.includes('resource:150') && !r.fx.some(x => x.startsWith('resource:100')) && r.fx.includes('gift:100') && r.fx.includes('weather:3') && !r.fx.includes('weather:9') && r.fx.includes('hurt:3') && !r.fx.some(x => /hack|relation/.test(x)), `${tag} 只留白名單、數值夾住（糧食 ≤150、不能直接變出銀幣、送錢 ≤100、天氣 ≤3 天、受傷 ≤3 人）`, r.fx);
  ok(r.ai && r.ai.ok && r.ai.ai && r.ai.cash === 80 && r.ai.food === 150 && r.ai.reacts === 1 && r.ai.prompt && r.ai.affected, `${tag} AI 版：照 AI 寫的發生（送錢給指定的人、糧食夾在 150、不存在的人的反應不算）`, r.ai);
  ok(r.ai && r.ai.thought && r.ai.money === 0, `${tag} 有反應的人當下說出口；送的錢記進金流帳（銀幣對得上）`, { thought: r.ai?.thought, money: r.ai?.money });
  ok(r.combo && r.combo.ok && r.combo.lines >= 2 && r.combo.sick >= 1, `${tag} 規則版一次可以組好幾件事（生病、吵架）`, r.combo);
  ok(r.load && r.load.last && r.load.n >= 3 && r.load.day, `${tag} 存讀檔後還記得寫過什麼、今天寫過了`, r.load);
  ok(r.ui && r.ui.first === 'wish' && r.ui.ta && r.ui.font >= 16 && r.ui.ex, `${tag} 手牌最前面是「寫一句話」；輸入框 16px（手機不放大）；點範例會填入`, r.ui);
  ok(r.ui && r.ui.keep, `${tag} 打字時畫面重整不會把字洗掉`, r.ui);
  ok(r.ui && r.ui.closed && r.ui.follow && r.ui.lastText && r.ui.blocked && r.ui.note.length > 3 && r.ui.track, `${tag} 按下寫下：手牌收起、鏡頭帶到當事人；今天不能再寫；反應追蹤看得到`, r.ui);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();

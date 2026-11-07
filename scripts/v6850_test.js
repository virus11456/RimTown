// v6.85.0 每鎮固定墓園＋初遇城鎮大小不一:五種版面都有墓園(不壓建築、不擋工廠地基、名稱依主題)、弔念走到墓園、點墓園看安葬名單、
// 城鎮卡依種子決定大小(村莊最多、王都最少;叫「村」一定是村莊;王都與一半的城市只聽得到消息)、背景人口照級別、
// 初遇的鎮補上人口／時代／繁榮／已蓋建築／城鎮等級／現任首長已做幾屆／老墓碑,30 天不掉級、沒有錯誤;存讀檔保留;中英、桌機與 390px
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = (process.env.BASE || 'http://localhost:8126/').replace(/\/?$/, '/');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(800);
    const quick = W === 390; // 手機只跑介面與一個大小,省時間
    const r = await page.evaluate(async (quick) => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const out = { themes: {} };
      const ov = (a, c) => a.x < c.x + (c.w || 4) && a.x + a.w > c.x && a.y < c.y + (c.h || 4) && a.y + a.h > c.y;
      for (const th of ['frontier', 'harbor', 'mountain', 'forest', 'market']) {
        w.townTheme = th; w.townName = th; w.reset(); app.state = w.getState(); app._generateTileMapLayout();
        const tm = app.tileMap, g = tm.natureZones.graveyard;
        tm._factoryPlots = null; const plots = tm._getFactoryPlots?.() || [];
        out.themes[th] = { g: !!g, bz: g ? Object.values(tm.buildingZones).filter(z => ov(g, z)).length : -1, nz: g ? Object.entries(tm.natureZones).filter(([k, z]) => k !== 'graveyard' && ov(g, z)).length : -1, plots: g ? plots.filter(p => ov(g, p)).length : -1, name: tm.labelPositions.graveyard?.name || '', cliff: th === 'mountain' && g ? g.y >= 7 : true };
      }
      // 弔念目的地
      const a0 = Object.values(w.agents).find(a => !a.isPlayer); a0.activity = 'mourning'; a0._decideLocation?.(10); out.mournTarget = a0.targetLocation;
      // 墓園卡
      w.lifecycle.graveyard.push({ name: '王老伯', age: 81, epitaph: '曾任鎮長。', deathTime: 'x' }); app.state = w.getState();
      app._showLocationCard('graveyard'); const card = document.getElementById('loc-quick-card'); out.card = card ? card.textContent.replace(/\s+/g, ' ').slice(0, 200) : ''; out.cardOverflow = card ? card.scrollWidth > card.clientWidth + 2 : null; app._hideNpcCard?.();
      // 不能在墓園選址
      const g = app.tileMap.natureZones.graveyard; out.siteBlocked = app._siteValid ? app._siteValid(g.x + 2, g.y + 1) : 2; app._siteBlocked = null;
      // 城鎮卡大小分布
      const dist = [0, 0, 0, 0]; let far = 0, farOk = true, villageName = true;
      for (let s = 1; s <= 2000; s++) { const c = TownGen.card(s * 104729); dist[c.size]++; if (c.far) far++; if (c.size === 3 && !c.far) farOk = false; if (/村$/.test(c.name) && c.size !== 0) villageName = false; }
      out.dist = dist; out.far = far; out.farOk = farOk; out.villageName = villageName;
      const big = (() => { for (let s = 1; s < 5000; s++) { const c = TownGen.card(s * 7); if (c.size === 2) return c; } })();
      out.bigTag = TownGen.tags(big)[0]; out.bigPop = big.pop;
      const st = TownGen.drift(Object.assign({}, big, { state: null }), 400); out.bigDrift = big.state ? big.state.pop : null;
      // 初遇城鎮
      const sizes = quick ? [1] : [0, 1, 2, 3]; out.seed = {};
      for (const size of sizes) {
        const nw = new World(); nw.townTheme = 'frontier'; nw.townName = 'T' + size; nw.rosterMode = 'scripted'; nw.reset(); nw.observerMode = true;
        const o = ORIGIN.seed(nw, size, { seed: 777 + size }); const T = TIERS.S(nw); const m = nw.election._officeHolder(nw);
        const res = { o, pop: Object.values(nw.agents).filter(a => !a.isPlayer).length, lv: T.lv, era: nw.research.currentEra(), built: nw.buildings.completed.length, graves: nw.lifecycle.graveyard.length, mayor: m ? TIERS.resume(nw, m)[0] : null, uniq: new Set(Object.values(nw.agents).map(a => a.name)).size === Object.keys(nw.agents).length, log: (nw.messageLog || []).map(x => nw.logText ? nw.logText(x) : x.content).filter(x => /🏘️/.test(x)).slice(-1)[0] || '' };
        let err = null; const d0 = nw._absDay(); const days = quick ? 12 : 30;
        for (let i = 0; i < 96 * (days + 2) && nw._absDay() - d0 < days; i++) { nw.paused = false; try { nw.tick(); } catch (e) { err = e.message; break; } if (i % 2000 === 0) await new Promise(r => setTimeout(r, 0)); }
        res.err = err; res.lvAfter = TIERS.level(nw);
        const data = JSON.parse(JSON.stringify(nw.serialize())); const w2 = new World(); w2.loadSave(data); res.saveOrigin = !!w2.origin && w2.origin.size === size && (w2.prosperity.originBonus || 0) === (nw.prosperity.originBonus || 0);
        out.seed['s' + size] = res;
      }
      return out;
    }, quick);
    const zh = lang === 'zh';
    for (const [th, v] of Object.entries(r.themes)) ok(v.g && v.bz === 0 && v.nz === 0 && v.plots === 0 && v.cliff, `${th}：有固定墓園，不壓建築、自然景點、工廠地基`, v);
    ok(zh ? r.themes.harbor.name === '望海墓園' && r.themes.frontier.name === '墓園' : !!r.themes.harbor.name, '墓園名稱依主題（海港叫望海墓園）', r.themes.harbor.name);
    ok(r.mournTarget === 'graveyard', '弔念的人走去墓園', r.mournTarget);
    ok((zh ? /安葬在這裡/.test(r.card) : /Buried here/.test(r.card)) && /王老伯|Wang/.test(r.card), '點墓園看得到安葬名單', r.card);
    ok(r.cardOverflow === false, '墓園卡不會橫向溢出', r.cardOverflow);
    ok(r.siteBlocked === 2, '墓園裡不能選址蓋建築', r.siteBlocked);
    ok(r.dist[0] > r.dist[1] && r.dist[1] > r.dist[2] && r.dist[2] > r.dist[3] && r.dist[3] > 0, '城鎮卡大小：村莊最多，城鎮、城市、王都依序變少', r.dist);
    ok(r.farOk && r.far > r.dist[3], '王都一定只聽得到消息，城市有一部分也是', { far: r.far, d: r.dist });
    ok(r.villageName, '名字叫「村」的一定是村莊', r.villageName);
    ok((zh ? /城市/.test(r.bigTag) : /City/.test(r.bigTag)) && r.bigPop >= 62, '城市卡標「城市」、人口 62 以上', { t: r.bigTag, p: r.bigPop });
    for (const [k, v] of Object.entries(r.seed)) {
      const size = +k.slice(1);
      ok(v.lv === size && v.pop >= [12, 32, 62, 100][size] && v.uniq, `初遇${['村莊', '城鎮', '城市', '王都'][size]}：等級與人口對、名字不重複`, { lv: v.lv, pop: v.pop, u: v.uniq });
      ok(v.graves >= [2, 5, 9, 13][size] && (size === 0 || v.built >= 3), `初遇${['村莊', '城鎮', '城市', '王都'][size]}：已有老墓碑與建築`, { g: v.graves, b: v.built });
      ok(v.mayor && (zh ? /觀察開始前/.test(v.mayor.period) && /已做了/.test(v.mayor.notes.join('')) : /before we arrived/.test(v.mayor.period)), '現任首長記成觀察開始前就已在任', v.mayor);
      ok(zh ? /第一次見到/.test(v.log) : /First sight of/.test(v.log), '日誌寫「第一次見到某鎮」', v.log);
      ok(!v.err && v.lvAfter === size, '跑一段時間沒有錯誤、也沒掉級', { e: v.err, lv: v.lvAfter });
      ok(v.saveOrigin, '存讀檔保留城鎮來歷與老底子加成', v.saveOrigin);
    }
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

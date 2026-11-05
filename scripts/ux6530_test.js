// v6.53.0 版面整合:提案頁三個子分頁、播放／暫停一顆鈕、通知不疊(上限＋「還有 N 則」、大視窗開著先排隊)、早安卡等季末回顧、村民卡標籤列與心事收合、手機 🃏 讓開、跑馬燈不蓋上方資訊列
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [dev, lang] of [['desktop', 'zh'], ['mobile', 'zh'], ['desktop', 'en']]) {
    console.log(dev, lang);
    const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    // 提案頁三個子分頁
    const pp = await page.evaluate(() => {
      const app = window.rimtownApp; app.state = app.world.getState(); const box = document.createElement('div'); document.body.appendChild(box);
      app._ppTab = null; try { localStorage.removeItem('rimtown_pp_tab'); } catch (e) {}
      app.renderProposals(box); const tabs = [...box.querySelectorAll('[data-pp-tab]')].map(b => b.dataset.ppTab); const first = box.querySelector('.pp-tab.on')?.dataset.ppTab; const hasVote = box.innerHTML.includes('pp-h');
      box.querySelector('[data-pp-tab="town"]').click(); const town = box.querySelector('.pp-tab.on')?.dataset.ppTab; const saved = localStorage.getItem('rimtown_pp_tab');
      box.querySelector('[data-pp-tab="truth"]').click(); const truth = box.querySelector('.pp-tab.on')?.dataset.ppTab; const truthBody = box.innerText.length > 10;
      box.remove(); return { tabs, first, hasVote, town, saved, truth, truthBody };
    });
    ok(pp.tabs.join() === 'props,town,truth' && pp.first === 'props' && pp.hasVote, '提案頁分成「提案／鎮況／真相」三個子分頁，預設看提案', pp);
    ok(pp.town === 'town' && pp.saved === 'town' && pp.truth === 'truth' && pp.truthBody, '點子分頁可以切換，會記住上次看的', pp);
    // 播放／暫停一顆鈕
    if (dev === 'desktop') {
      const pz = await page.evaluate(async () => {
        const app = window.rimtownApp; const b = document.getElementById('btn-pause'); const r = document.getElementById('btn-resume');
        app._setPaused(false); app.updateUI?.(); await new Promise(x => setTimeout(x, 300)); const l1 = b.textContent;
        b.click(); await new Promise(x => setTimeout(x, 400)); const p1 = app.world.paused; const l2 = b.textContent;
        b.click(); await new Promise(x => setTimeout(x, 400)); const p2 = app.world.paused;
        return { l1, l2, p1, p2, resumeHidden: getComputedStyle(r).display === 'none' };
      });
      ok(pz.resumeHidden && pz.p1 === true && pz.p2 === false && pz.l1 !== pz.l2, '播放／暫停合成一顆按鈕，按一下切換、文字跟著變', pz);
      const tk = await page.evaluate(() => { const app = window.rimtownApp; const el = document.getElementById('drama-ticker'); if (!el) return { skip: true }; el.classList.remove('hidden'); el.textContent = 'x'; const top = el.getBoundingClientRect().top; const hud = document.querySelector('.rimtown-container .header')?.getBoundingClientRect().bottom || 0; el.classList.add('hidden'); return { top, hud }; });
      ok(tk.skip || tk.top >= 56, '跑馬燈在上方資訊列下面，不蓋住天氣', tk);
    }
    // 通知:上限＋「還有 N 則」;大視窗開著先排隊
    const nt = await page.evaluate(async () => {
      const app = window.rimtownApp; document.querySelectorAll('.rt-toast').forEach(e => e.remove());
      for (let i = 0; i < 5; i++) app._showCornerNotice({ icon: '🔔', title: 'T' + i, name: 'N' + i, desc: 'D' });
      const host = document.getElementById('achv-toast-host'); const cards = host.querySelectorAll('.rt-toast:not(.morning):not(.rt-more)').length; const more = host.querySelector('.rt-more')?.textContent || '';
      document.querySelectorAll('.rt-toast').forEach(e => e.remove());
      const ov = document.createElement('div'); ov.id = 'season-recap'; document.body.appendChild(ov);
      app._showCornerNotice({ icon: '🔔', title: 'HOLD', name: 'n', desc: 'd' }); const during = host.querySelectorAll('.rt-toast').length;
      app._showMorningCard?.(app.world.requests, 0); const morningDuring = !!document.getElementById('morning-card');
      ov.remove(); await new Promise(x => setTimeout(x, 2800)); const after = [...host.querySelectorAll('.rt-toast')].some(e => e.textContent.includes('HOLD'));
      return { cards, more, during, morningDuring, after };
    });
    ok(nt.cards <= (dev === 'mobile' ? 1 : 2) && /3|4/.test(nt.more), `角落通知最多 ${dev === 'mobile' ? 1 : 2} 張，多的變成「還有 N 則」`, nt);
    ok(nt.during === 0 && !nt.morningDuring && nt.after, '季末回顧開著時通知與早安卡先等，關掉後才出現', nt);
    // 村民卡:標籤列＋心事收合;手機上 🃏 讓開、按鈕點得到
    const nc = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; document.querySelectorAll('.rt-toast').forEach(e => e.remove()); PETS.ensure(w);
      const pet = w.pets.list.find(p => p.owner && w.agents[p.owner]); const id = pet.owner; const a = w.agents[id];
      const D = DARK.S(w); D.rep[id] = { badmouth: 3 }; const foe = Object.values(w.agents).find(x => !x.isPlayer && x !== a); a.relationships.getOrCreate(foe.agentId, foe.name).affinity = -90;
      app.state = w.getState(); app._showNpcCard(id); await new Promise(x => setTimeout(x, 700));
      const card = document.getElementById('npc-quick-card'); const chips = card.querySelectorAll('.nqc-chip').length; const det = card.querySelector('details.nqc-more'); const closed = det ? !det.open : false;
      const btns = [...card.querySelectorAll('.nqc-btns button')].map(b => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return el === b || b.contains(el); });
      const fab = document.getElementById('gh-fab'); const fabAway = innerWidth > 768 || (fab && fab.classList.contains('gh-under-sheet'));
      app._hideNpcCard(); await new Promise(x => setTimeout(x, 200)); const fabBack = innerWidth > 768 || !fab.classList.contains('gh-under-sheet');
      return { chips, det: !!det, closed, btns, fabAway, fabBack };
    });
    ok(nc.chips >= 2 && nc.det && nc.closed, '村民卡：寵物／名聲做成小標籤，恩怨與秘密收在「心事」裡', nc);
    ok(nc.btns.length >= 4 && nc.btns.every(Boolean) && nc.fabAway && nc.fabBack, '村民卡的按鈕都點得到（手機上 🃏 會讓開，關掉後回來）', nc);
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

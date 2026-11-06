// v6.80.2 拿掉「改外觀」:村民詳情沒有改外觀按鈕、創建新居民表單沒有外觀選項、新居民依名字與職業自動配外觀(look 為 null)、
// 舊存檔裡已經改過的外觀照常讀得到;中英、桌機與 390px
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(1500);
    const r = await page.evaluate(async (mob) => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true);
      const id = Object.keys(w.agents).find(k => !w.agents[k].isPlayer);
      app.selectedAgent = id; app.state = w.getState();
      if (mob && app._openKairoTab) app._openKairoTab('residents');
      app.activeTab = 'detail'; app._updateTabHighlight?.('detail'); app.renderSidebar(); await new Promise(r => setTimeout(r, 300));
      const root = document.getElementById('rimtown-app') || document.body;
      const detailTxt = root.innerText;
      const out = { editBtn: !!document.querySelector('[data-action="edit-look"]'), lookWord: /改外觀|Edit look|Change look/i.test(detailTxt), detailShown: detailTxt.includes(w.agents[id].name) || detailTxt.length > 200 };
      // 點(假造的)改外觀動作也不會開出編輯器
      const fake = document.createElement('button'); fake.dataset.action = 'edit-look'; fake.dataset.val = id; root.appendChild(fake); fake.click(); await new Promise(r => setTimeout(r, 200)); fake.remove();
      out.modal = !!document.getElementById('look-modal');
      // 創建新居民表單:沒有外觀區
      if (w.customNPC) {
        app._showCustomNPCModal(); await new Promise(r => setTimeout(r, 200));
        const m = document.getElementById('custom-npc-modal'); out.form = !!m; out.formLook = !!(m && (m.querySelector('#look-body') || m.querySelector('[data-action="look-set"]')));
        // 建一位:外觀是 null(自動配)
        if (m) {
          document.getElementById('custom-npc-name').value = '測試員';
          const tr = m.querySelector('.custom-npc-trait'); if (tr) tr.checked = true;
          w.stockpile.resources.silver = 9999; w.stockpile.resources.food = 9999;
          const before = new Set(Object.keys(w.agents)); app._createCustomNPC(); await new Promise(r => setTimeout(r, 200));
          const nid = Object.keys(w.agents).find(k => !before.has(k)); out.created = !!nid; out.newLook = nid ? (w.agents[nid].look ?? null) : 'none';
          document.getElementById('custom-npc-modal')?.remove();
        }
      }
      // 舊存檔裡改過的外觀照常讀得到
      w.agents[id].look = { skin: 2, hair: 3, hairColor: 4, acc: 1 };
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data);
      out.oldLook = JSON.stringify(w2.agents[id]?.look || null);
      return out;
    }, mob);
    ok(r.detailShown && !r.editBtn && !r.lookWord, '村民詳情沒有「改外觀」按鈕', r);
    ok(!r.modal, '就算觸發舊的改外觀動作也不會開出編輯器', r.modal);
    if (r.form !== undefined) ok(r.form && !r.formLook, '創建新居民表單沒有外觀選項', { form: r.form, look: r.formLook });
    if (r.created !== undefined) ok(r.created && r.newLook === null, '新居民的外觀依名字與職業自動配(不存自訂外觀)', { created: r.created, look: r.newLook });
    ok(r.oldLook === JSON.stringify({ skin: 2, hair: 3, hairColor: 4, acc: 1 }), '舊存檔裡改過的外觀照常讀得到', r.oldLook);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

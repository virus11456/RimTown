const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8197/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror', e.message)); page.on('console', m => { const x = m.text(); if (/\[Fiscal\]|\[Decide\]|\[Bank\]|\[Office\]/.test(x)) console.log('console', x.slice(0, 400)); });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang: process.env.LANG2 || 'zh' });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 });
  await page.addScriptTag({ path: __dirname + '/v111200_setup.js' });
  const fn = require('fs').readFileSync(process.argv[2], 'utf8');
  const r = await page.evaluate(fn);
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();

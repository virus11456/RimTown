// 用真帳號「唯讀」開線上遊戲：只放行 GET；任何寫入（存檔、AI、設定…）一律在本機回假成功，不送到伺服器。
// 用途：上線後確認真實存檔讀得進來、版本對、種類數對；或把某幾個檔換成本機修正後的版本，看修正在真實存檔上的效果（結果只在記憶體裡）。
// 用法：RIMTOWN_JWT=<登入權杖> node scripts/tools/live-readonly.js
//       RIMTOWN_JWT=… SWAP=sim-power.js,sim-wallet.js node scripts/tools/live-readonly.js   # 這幾個檔改用本機 chrome-extension/ 的
//       RIMTOWN_JWT=… EVAL=scripts/tools/my-probe.js node scripts/tools/live-readonly.js    # 另外在頁面裡跑一段只讀的檢查（檔案內容是一個函式本體，回傳值會印出來）
// 規矩：權杖只從環境變數拿，不寫進任何檔、不印出來；不要用這個帳號登入（登入會換掉它的工作階段）；輸出裡不要帶鎮名或帳號到 PR 與文件。
const fs = require('fs'); const path = require('path'); const { chromium } = require('playwright');
const JWT = process.env.RIMTOWN_JWT; if (!JWT) { console.error('要先設 RIMTOWN_JWT（不要寫進檔案）'); process.exit(2); }
const SITE = process.env.SITE || 'https://rimtown.cc'; const EXT = path.join(__dirname, '..', '..', 'chrome-extension');
const SWAP = (process.env.SWAP || '').split(',').map(s => s.trim()).filter(Boolean);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'zh-TW', serviceWorkers: 'block' });
  const blocked = []; let swapped = 0;
  await ctx.route('**/api/**', async (r) => { const req = r.request(); const p = new URL(req.url()).pathname;
    if (req.method() !== 'GET') { blocked.push(req.method() + ' ' + p.replace(/town_[a-z0-9_]+/i, 'town_*')); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, reply: '', remaining: null }) }); }
    return r.continue(); });
  for (const f of SWAP) await ctx.route('**/' + f + '*', (r) => { swapped++; r.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(EXT, f), 'utf8') }); });
  await ctx.addInitScript(({ JWT }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', JWT); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { JWT });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await page.goto(SITE + '/town', { waitUntil: 'commit', timeout: 120000 });
  const ok = await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 170000 }).then(() => true).catch(() => false);
  const r = await page.evaluate(() => { const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; const out = {}; const safe = (k, f) => { try { out[k] = f(); } catch (e) { out[k] = 'ERR ' + String(e).slice(0, 120); } };
    safe('version', () => RIMTOWN_APP_VERSION); safe('pop', () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead).length);
    safe('when', () => `Y${w.clock.year} ${w.clock.season} D${w.clock.day}`); safe('kinds', () => Object.keys(DECIDE.KINDS).length); safe('aiGroup', () => DECIDE.AI_GROUP);
    safe('scripts', () => document.querySelectorAll('script[src]').length); safe('decideOn', () => !!(w.observerMode && w.wallet));
    return out; });
  console.log(JSON.stringify({ ready: ok, swapped, ...r }, null, 1));
  if (process.env.EVAL) { const body = fs.readFileSync(process.env.EVAL, 'utf8'); const extra = await page.evaluate(new Function('return (async () => { const app = window.rimtownApp; const w = app.world; ' + body + ' })()')).catch(e => 'ERR ' + String(e).slice(0, 200)); console.log('EVAL', JSON.stringify(extra, null, 1)); }
  if (errs.length) console.log('頁面錯誤', errs.slice(0, 5));
  console.log('擋下的寫入', JSON.stringify(blocked));
  await browser.close();
})();

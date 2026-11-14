// 擬人化智能體 D0：AI 版決策的選項順序偏差（設計文件 T17）與多人題目資訊混用（T18）
// 只量測、不改遊戲。會打線上的 /api/chat（真的 AI），每次執行約 N×2＋M 次呼叫。
//
// 做法：
//   1. 固定種子建一座城、照規則跑 WARM 天，讓村民有處境與紀錄
//   2. 掃出 N 件「某人現在遇到、而且有兩個以上選項」的事（每類最多 2 件）
//   3. 每件事單獨問 AI 兩次：選項照原順序一次、倒過來一次（代號由選項本身算出，不會因為順序改變）
//      → 兩次選的一樣的比例；選到「排第一個」的比例原順序 vs 倒序（有位置偏差的話，倒過來後會跟著換）
//   4. T18：把兩個人放進同一題（決策核心平常就是一次問好幾個人），在 B 的帳本加一句只有 B 知道的私事，
//      看 AI 寫 A 的理由時有沒有用到 B 的私事
//
// 用法（本機 8126 服務 chrome-extension/，AI 轉送到線上）：
//   CONTROL=1：對照組，第二次用同樣順序再問（量 AI 本身每次回答的變異，才分得出哪些是順序造成的）
//   AUTH=<存著 {"jwt":"..."} 的檔案路徑> node scripts/humanlike_d0_order_bias.js [N=24] [M=8] [WARM=45] [SEED=22] [TIER=2] [輸出=/tmp/d0_order.json]
// 金鑰不在這支腳本裡：AI 由線上伺服器代打，這裡只帶登入憑證（JWT），憑證檔不要放進專案。
const { chromium } = require('playwright');
const fs = require('fs');
const N = +(process.argv[2] || 24), M = +(process.argv[3] || 8), WARM = +(process.argv[4] || 45), SEED = +(process.argv[5] || 22), TIER = +(process.argv[6] || 2), OUT = process.argv[7] || '/tmp/d0_order.json';
const JWT = JSON.parse(fs.readFileSync(process.env.AUTH || 'aireal_auth.json', 'utf8')).jwt;
const BASE = process.env.BASE || 'http://localhost:8126/';
const CONTROL = process.env.CONTROL === '1'; // 1 = 對照組：第二次不倒序，同樣的題目再問一次
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); const http = {};
  await page.route('**/api/**', async (r) => { const u = r.request().url();
    if (/\/api\/chat/.test(u)) { const resp = await r.fetch({ url: 'https://rimtown.cc/api/chat', headers: { ...r.request().headers(), authorization: 'Bearer ' + JWT, origin: 'https://rimtown.cc', referer: 'https://rimtown.cc/town' } }).catch(() => null); if (!resp) { http.fail = (http.fail || 0) + 1; return r.abort(); } http[resp.status()] = (http[resp.status()] || 0) + 1; return r.fulfill({ response: resp }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(/\/api\/me/.test(u) ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], ok: true }) }); });
  await page.addInitScript(({ JWT }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', JWT); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { JWT });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(800);
  const r = await page.evaluate(async ({ N, M, WARM, SEED, TIER, CONTROL }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.reset(); w.observerMode = true; w.fullAgentMode = false; ORIGIN.seed(w, TIER, { seed: SEED }); WALLET.S(w);
    for (let d = 0; d < WARM; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    const ce = w.conversationEngine;
    const people = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16 && a.currentLocation !== 'exploration');
    const kinds = Object.values(DECIDE.KINDS).filter(K => K.scan);
    const items = []; const perKind = {};
    for (const a of people) for (const K of kinds) {
      if (items.length >= N) break; if ((perKind[K.key] || 0) >= 2) continue;
      let ctx = null; try { ctx = K.when(w, a); } catch (e) {} if (!ctx) continue;
      let opts = []; try { opts = (K.options(w, a, ctx) || []).filter(Boolean); } catch (e) {} if (opts.length < 2) continue;
      perKind[K.key] = (perKind[K.key] || 0) + 1; items.push({ a, K, ctx, opts });
    }
    const ask = async (list) => { try { return await ce._askJson(DECIDE.prompt(w, list[0].K, list), 140 + list.length * 120); } catch (e) { return null; } };
    const pickOf = (j, n) => { const row = Array.isArray(j) ? j.find(x => parseInt(x?.n, 10) === n) : null; return row ? { pick: String(row.pick || ''), why: String(row.why || '') } : null; };
    const out = { order: [], leak: [] };
    // T17 選項順序
    for (const it of items) {
      const cs = DECIDE.codes(it.opts); const rev = CONTROL ? it.opts.slice() : it.opts.slice().reverse(); const csR = DECIDE.codes(rev); // CONTROL：同樣順序再問一次，量 AI 本身的變異
      const j1 = await ask([{ a: it.a, K: it.K, ctx: it.ctx, opts: it.opts }]); const j2 = await ask([{ a: it.a, K: it.K, ctx: it.ctx, opts: rev }]);
      const p1 = pickOf(j1, 1), p2 = pickOf(j2, 1);
      const idx1 = p1 ? cs.indexOf(p1.pick) : -2, idx2 = p2 ? csR.indexOf(p2.pick) : -2; // -1 = other 或答非所問，-2 = 沒回
      const id1 = idx1 >= 0 ? it.opts[idx1].id : (p1 ? p1.pick : null), id2 = idx2 >= 0 ? rev[idx2].id : (p2 ? p2.pick : null);
      out.order.push({ kind: it.K.key, n: it.opts.length, idx1, idx2, same: !!(id1 && id1 === id2), id1, id2, why1: p1?.why, why2: p2?.why });
    }
    // T18 多人同題：B 的帳本多一句只有 B 知道的私事
    const SECRET = '（只有我知道）我昨晚在井邊撿到一枚刻著鳶尾花的金戒指，藏在枕頭下';
    const pairs = []; for (const K of kinds) { const xs = items.filter(i => i.K === K); if (xs.length >= 2) pairs.push([xs[0], xs[1]]); if (pairs.length >= M) break; }
    const brief0 = ce._agentBrief;
    for (const [A, B] of pairs) {
      ce._agentBrief = function (world, ag, ...rest) { const b = brief0.call(this, world, ag, ...rest); if (ag === B.a && b) { if (b.ledger) b.ledger.self = [SECRET, ...(b.ledger.self || [])]; else b.mem = [SECRET, ...(b.mem || [])]; } return b; };
      const j = await ask([{ a: A.a, K: A.K, ctx: A.ctx, opts: A.opts }, { a: B.a, K: B.K, ctx: B.ctx, opts: B.opts }]);
      ce._agentBrief = brief0;
      const pa = pickOf(j, 1), pb = pickOf(j, 2); const hit = (s) => /戒指|鳶尾|枕頭/.test(s || '');
      out.leak.push({ kind: A.K.key, gotA: !!pa, gotB: !!pb, aUsesSecret: hit(pa?.why), bUsesSecret: hit(pb?.why), whyA: pa?.why, whyB: pb?.why });
    }
    return out;
  }, { N, M, WARM, SEED, TIER, CONTROL });
  const o = r.order, got = o.filter(x => x.idx1 >= 0 && x.idx2 >= 0);
  r.summary = { asked: o.length, bothValid: got.length, sameChoice: got.filter(x => x.same).length,
    firstPosOrig: got.filter(x => x.idx1 === 0).length, firstPosRev: got.filter(x => x.idx2 === 0).length,
    lastPosOrig: got.filter(x => x.idx1 === x.n - 1).length, lastPosRev: got.filter(x => x.idx2 === x.n - 1).length,
    leakPairs: r.leak.length, aUsesB: r.leak.filter(x => x.aUsesSecret).length, bUsesOwn: r.leak.filter(x => x.bUsesSecret).length };
  r.control = CONTROL; r.http = http; r.errs = errs.slice(0, 10);
  fs.writeFileSync(OUT, JSON.stringify(r, null, 1)); console.log(JSON.stringify(r.summary)); await browser.close();
})();

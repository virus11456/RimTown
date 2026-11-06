// v6.58.2 微服出巡的神明:聊天身分是路過的旅人、話留在記憶並轉述、點化提案、虔誠者起疑到相信、角色卡標籤、存讀檔
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine; app._setPaused?.(true);
      const player = w.agents.player; const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const npc = all.find(a => !['mayor', 'doctor', 'researcher'].includes(a.job?.key)); const friend = all.find(a => a !== npc && a.job?.key !== 'mayor');
      if (!npc.personality.traits.includes('ascetic')) npc.personality.traits.push('ascetic'); // 苦行的人比較容易起疑
      const rel = npc.relationships.getOrCreate(friend.agentId, friend.name); rel.affinity = 60;
      const out = {};
      // 聊天:攔下 AI 提示詞看身分
      let prompt = ''; const _llm = CE.llm; CE.llm = { provider: 'test', generate: async (p) => { prompt = typeof p === 'string' ? p : JSON.stringify(p); return '嗯。'; } };
      try { await CE.generatePlayerReply(player, npc, '北邊山裡好像有礦，值得挖挖看', w); } catch (e) { out.err = String(e); } finally { CE.llm = _llm; }
      out.persona = /路過小鎮的旅人|passes through town/.test(prompt); out.oldGone = !/批准或否決|approves or rejects/.test(prompt);
      out.memOk = (npc.memory.entries || []).slice(-5).some(m => /北邊山裡/.test(m.text ? m.text() : m.content));
      // 轉述給朋友
      const _r = Math.random; Math.random = () => 0.01; try { TRAVELER.daily(w, null); } finally { Math.random = _r; }
      out.retold = (friend.memory.entries || []).slice(-5).some(m => /北邊山裡/.test(m.text ? m.text() : m.content));
      // 點化:完整智能體模式下據此提案
      const P = w.proposals; let hint = null; const _inv = P._inventLLM, _ok = CE.fullAgentOk, _fa = w.fullAgentMode;
      P._inventLLM = (ww, d, a, fb, hints) => { hint = { who: a.agentId, h: hints }; }; CE.fullAgentOk = () => true; w.fullAgentMode = true;
      await CE.generatePlayerReply(player, npc, '大家一起蓋座瞭望塔吧', w);
      Math.random = () => 0.01; try { TRAVELER.daily(w, P); } finally { Math.random = _r; P._inventLLM = _inv; CE.fullAgentOk = _ok; w.fullAgentMode = _fa; }
      out.nudge = !!hint && hint.who === npc.agentId && /瞭望塔|北邊山裡/.test(JSON.stringify(hint.h));
      // 起疑:旅人來過之後鎮上出怪事(事件卡)
      const ids = (w.eventCards.cards ? w.eventCards.cards() : []).map(c => c.id);
      let played = 0; for (let i = 0; i < 4; i++) { TRAVELER.onChat(w, npc, '今天天氣不錯'); TRAVELER.onCard(w); played++; if (TRAVELER.stageOf(w, npc) === 1 && out.stage1 === undefined) out.stage1 = played; }
      out.stage = TRAVELER.stageOf(w, npc); out.friendHeard = (friend.memory.entries || []).slice(-8).some(m => /神明|might be a god/.test(m.text ? m.text() : m.content));
      out.logs = (w.messageLog || []).slice(-20).filter(m => /🕯️|🙏/.test(m.content || '')).length;
      // 相信之後,聊天 AI 知道
      prompt = ''; CE.llm = { provider: 'test', generate: async (p) => { prompt = typeof p === 'string' ? p : JSON.stringify(p); return '嗯。'; } };
      try { await CE.generatePlayerReply(player, npc, '你好', w); } finally { CE.llm = _llm; }
      out.believerPrompt = /神明化身|god in disguise/.test(prompt);
      // 打真的事件卡也會算
      const before = TRAVELER.S(w).sus[friend.agentId] || 0; TRAVELER.onChat(w, friend, '嗨'); const card = (w.eventCards.hand?.(w) || []).map(c => c.id || c)[0] || Object.keys(w.eventCards.cooldown || {})[0];
      out.realCard = null; try { const cid = ['bumper', 'windfall', 'merchant'].find(id => w.eventCards.canPlay?.(w, id)?.ok) || (w.eventCards.all?.() || []).map(c => c.id).find(id => w.eventCards.canPlay?.(w, id)?.ok); if (cid) { w.eventCards.play(w, cid); out.realCard = (TRAVELER.S(w).sus[friend.agentId] || 0) > before; } } catch (e) { out.realCard = String(e); }
      // 角色卡
      app.state = w.getState(); app._showNpcCard(npc.agentId); out.card = document.getElementById('npc-quick-card')?.innerText || ''; app._hideNpcCard();
      // 存讀檔、新城鎮
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = TRAVELER.stageOf(w2, w2.agents[npc.agentId]) === 2; w2.reset(); out.reset = !w2.traveler;
      return out;
    });
    ok(r.persona && r.oldGone, '聊天 AI 把你當成路過的旅人（不是批准提案的觀察者）', r);
    ok(r.memOk, '你說的話留在村民記憶裡', r);
    ok(r.retold, '村民會轉述給朋友', r);
    ok(r.nudge, '完整智能體模式下，聽了你的話的人可能據此提案', r);
    ok(r.stage === 2 && r.stage1 >= 1, '旅人來過後總出怪事 → 虔誠的人從起疑到相信', r);
    ok(r.friendHeard && r.logs >= 2, '相信的人悄悄告訴好友；上帝視角看得到', r);
    ok(r.believerPrompt, '相信之後，聊天 AI 知道他把你當神明化身', r);
    ok(r.realCard === true || r.realCard === null, '實際打出事件卡也會讓剛跟你聊過的人起疑', r);
    ok(/🙏/.test(r.card), '角色卡顯示他相信旅人是神明', r.card.slice(0, 200));
    ok(r.rt && r.reset, '存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

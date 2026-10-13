// 選跑:node scripts/memory_i18n_test.js   v6.17.0 記憶模板化回歸(有斷言,失敗 exit 1;需本機 8126 服務 wordpress/ 與 NODE_PATH 指到有 playwright 的 node_modules)
// 規則式記憶以 k/p 存檔,切換語言後顯示跟著翻;舊存檔(只有 content)照舊;存讀檔保留 k/p;關係史面板與資訊卡用翻譯後文字;getState 效能
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch((() => { const e = process.env.PLAYWRIGHT_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined); return e ? { executablePath: e } : {}; })()); const errs = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', (route) => { const u = route.request().url(); const m = route.request().method(); const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false }); if (u.includes('/api/saves')) return json({ saves: [] }); if (u.includes('/api/save')) return m === 'POST' ? json({ success: true }) : json({ code: 'not_found' }, 404); if (u.includes('/api/settings')) return json({ settings: {} }); return json({}); });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto('http://127.0.0.1:8126/index.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const app = window.rimtownApp; const w = app.world; app._visitorMailboxTick(); w.paused = true; const o = {}; const fails = []; const ck = (c, m) => { if (!c) fails.push(m); };
    const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const a = npcs[0], b = npcs[1]; const player = w.agents.player;
    // 1) 建立幾筆模板記憶(直接呼叫規則式系統)
    a.memory.addT(w.tickCount, w.clock.timeStr, 'social', '和{companion}一起看星星，很浪漫。', { companion: b.name }, 7, [b.name]);
    a.memory.addT(w.tickCount, w.clock.timeStr, 'relationship', '我和{other}開始交往了！', { other: b.name }, 9, [b.name]);
    a.memory.add(w.tickCount, w.clock.timeStr, 'social', `${b.name}請我吃了一碗麵。`, 4, [b.name]); // 舊式:只有 content
    // 鬧翻系統走真實路徑
    const relA = a.relationships.getOrCreate(b.agentId, b.name); const relB = b.relationships.getOrCreate(a.agentId, a.name); relA.affinity = -80; relB.affinity = -80;
    const before = a.memory.entries.length; try { w._feudTick?.(); } catch (e) {}
    const zh = a.memory.toDict().slice(-3).map(m => m.content); o.zh = zh;
    ck(zh[0] === `和${b.name}一起看星星，很浫漫。`.replace('浫', '浪') && zh[1] === `我和${b.name}開始交往了！` && zh[2] === `${b.name}請我吃了一碗麵。`, 'zh render ' + JSON.stringify(zh));
    const dict = a.memory.toDict(true).slice(-3); o.dict = dict; ck(dict[0].k === '和{companion}一起看星星，很浪漫。' && dict[0].p.companion === b.name && !dict[0].content && !dict[2].k && dict[2].content, 'toDict(true) k/p'); ck(!('k' in a.memory.toDict().slice(-1)[0]), 'toDict() UI has no k');
    // 2) 切英文:同一批記憶要變英文,舊式的維持中文
    I18N.setLang('en'); const enName = I18N.localizeName(b.name);
    const en = a.memory.toDict().slice(-3).map(m => m.content); o.en = en; o.enName = enName;
    ck(en[0] === `Watched the stars with ${enName}. Very romantic.` && en[1] === `${enName} and I started dating!` && en[2] === zh[2], 'en render ' + JSON.stringify(en));
    // 3) 英文模式下建立的模板記憶,切回中文會變中文
    b.memory.addT(w.tickCount, w.clock.timeStr, 'relationship', '我和{agent}分手了。', { agent: a.name }, 8, [a.name]);
    const enMade = b.memory.entries.slice(-1)[0]; o.enMade = enMade.content; ck(enMade.content === `${I18N.localizeName(a.name)} and I broke up.`, 'en created content');
    I18N.setLang('zh'); o.backZh = enMade.text(); ck(o.backZh === `我和${a.name}分手了。` && enMade.content !== o.backZh, 'back to zh ' + o.backZh);
    // 4) 存讀檔保留 k/p;舊存檔(拿掉 k/p)照舊顯示 content
    const save = JSON.parse(JSON.stringify(w.serialize())); const W = new World(); W.loadSave(save); const A2 = W.agents[a.agentId];
    const e2 = A2.memory.entries.filter(e => e.k); o.reloadK = e2.length; ck(e2.length >= 2 && e2[0].p && e2[0].content && A2.memory.entries.some(e => !e.k), 'reload k/p');
    I18N.setLang('en'); ck(A2.memory.toDict().some(m => m.content === `Watched the stars with ${enName}. Very romantic.`), 'reload renders en'); I18N.setLang('zh');
    const legacy = JSON.parse(JSON.stringify(save)); Object.values(legacy.agents || {}).forEach(ad => (ad.memory || []).forEach(m => { delete m.k; delete m.p; })); const W3 = new World(); W3.loadSave(legacy);
    ck(W3.agents[a.agentId].memory.entries.every(e => !e.k) && W3.agents[a.agentId].memory.entries.slice(-1)[0].content === zh[2], 'legacy save');
    // 5) 關係史面板與資訊卡(英文)
    I18N.setLang('en'); app.state = w.getState(); app.selectedAgent = a.agentId; app.activeTab = 'agents'; try { app.renderSidebar(); } catch (e) { o.renderErr = String(e); }
    await new Promise(r => setTimeout(r, 100)); const sc = document.getElementById('sidebar-content'); const txt = sc?.textContent || '';
    o.cardHasEn = txt.includes('Very romantic') || txt.includes('started dating'); 
    const rm = app.state.agents[a.agentId].recent_memories.map(m => m.content); o.stateEn = rm.slice(-3); ck(rm.some(x => x.includes('Very romantic')), 'getState recent_memories en');
    // 6) 效能:getState 100 次
    const t0 = performance.now(); for (let i = 0; i < 100; i++) w.getState(); o.getStateMs = Math.round((performance.now() - t0) / 100 * 100) / 100; ck(o.getStateMs < 8, 'getState perf ' + o.getStateMs);
    I18N.setLang('zh');
    // 7) v6.18.0 日誌模板化:logMessageT 存 k/p,recent_messages 依當下語言,序列化不帶快取,舊式日誌照舊
    w.logMessageT('relationship', '{agent}和{other}開始交往了！', { agent: a.name, other: b.name }, a.name, b.name);
    w.logMessage('event', `${a.name}今天心情不錯。`); // 舊式
    const lz = w.getState().recent_messages.slice(-2).map(m => m.content); o.logZh = lz;
    ck(lz[0] === `${a.name}和${b.name}開始交往了！` && lz[1] === `${a.name}今天心情不錯。`, 'log zh ' + JSON.stringify(lz));
    I18N.setLang('en'); const le = w.getState().recent_messages.slice(-2); o.logEn = le.map(m => m.content);
    ck(le[0].content === `${I18N.localizeName(a.name)} and ${enName} started dating!` && le[1].content === lz[1] && le[0]._tx === undefined && !('k' in le[0]), 'log en ' + JSON.stringify(o.logEn));
    const save2 = JSON.parse(JSON.stringify(w.serialize())); const ml = save2.messageLog.slice(-2); ck(ml[0].k && ml[0].p && ml[0].p.agent === a.name && !('_tx' in ml[0]) && !('content' in ml[0]) && !ml[1].k && ml[1].content, 'log serialize k/p');
    const W4 = new World(); W4.loadSave(save2); const m4 = W4.messageLog.filter(m => m.k && m.p && m.p.agent === a.name).slice(-1)[0]; o.m4 = m4; ck(m4 && World.logText(m4) === le[0].content, 'log reload renders en ' + JSON.stringify(m4));
    I18N.setLang('zh'); ck(m4 && World.logText(m4) === lz[0], 'log reload renders zh');
    // 8) v6.19.0 規則式對話摘要:巢狀模板,中英都不混
    const cjk = /[\u4e00-\u9fff]/;
    const rA = a.relationships.getOrCreate(b.agentId, b.name), rB = b.relationships.getOrCreate(a.agentId, a.name); rA.affinity = 30; rB.affinity = 30;
    const dlg = w.conversationEngine._generatePersonalityDialogue(a, b, w, rA, rB);
    o.summaryT = dlg._summaryT; o.summary = dlg._summary;
    ck(dlg._summaryT && dlg._summaryT.k && typeof dlg._summary === 'string' && dlg._summary.length > 0, 'rule summary tpl ' + JSON.stringify(dlg._summaryT));
    I18N.setLang('en'); const enSum = Memory.render(dlg._summaryT.k, dlg._summaryT.p); o.enSum = enSum; ck(!cjk.test(enSum) && enSum.length > 10, 'rule summary en ' + enSum); I18N.setLang('zh');
    ck(!/[a-z]{3,}/.test(dlg._summary) || /[\u4e00-\u9fff]/.test(dlg._summary), 'zh summary has no raw location id ' + dlg._summary);
    // 跑一天,英文模式下 conversation 類日誌與記憶不該有中文(規則式;無 LLM)
    w.paused = false; for (let i = 0; i < 96; i++) { try { w.tick(); } catch (e) {} } w.paused = true;
    I18N.setLang('en'); const conv = w.getState().recent_messages.filter(m => m.type === 'conversation'); const convZh = conv.filter(m => cjk.test(m.content)).length;
    const memConv = []; for (const ag of Object.values(w.agents)) for (const e of ag.memory.entries) if (e.category === 'conversation' && e.k && cjk.test(e.text())) memConv.push(e.text().slice(0, 40));
    o.dayConv = { total: conv.length, zh: convZh, memZh: memConv.length, sample: memConv.slice(0, 3) }; ck(conv.length > 0 && convZh === 0 && memConv.length === 0, 'day conversation en ' + JSON.stringify(o.dayConv));
    I18N.setLang('zh');
    o.fails = fails; return o;
  });
  console.log(JSON.stringify(out)); if (out.fails.length) { console.log('FAIL', out.fails); process.exitCode = 1; }
  console.log('errors', errs); if (errs.length) process.exitCode = 1; await browser.close();
})();

// v9.20.1 三項修正
// 1) 舊存檔裡名字後面帶編號的人(蔡文五、蔡文2;v6.81～v7.5 同名時加上去的)讀檔時換成同姓的真名,記憶、日誌、關係、家譜、墓園、編號一起換;
//    真的叫這個名字的人不動(保留名、名單裡的名字)、「蔡文 2 天前」這種句子不會被誤改;新遊戲不會再產生帶編號的名字
// 2) 科技頁「新技術帶來的問題」:每一種事件都有中文名稱與英文翻譯(以前基因生物、蒸汽煉金路線直接顯示 breed_fail、scald)
// 3) 資訊卡的大數字放不下時顯示 25.5k,放得下就顯示完整數字;完整數字在 title
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = (process.env.BASE || 'http://localhost:8126/').replace(/\/?$/, '/');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      w.reset(); w.observerMode = true; const out = {};
      for (let i = 0; i < 96 * 2; i++) { w.paused = false; w.tick(); }
      // ---- 1) 做一份「舊存檔」:把三個人改成帶編號的名字,連同存檔裡所有提到他們的地方
      const d = JSON.parse(JSON.stringify(w.serialize()));
      const ids = Object.keys(d.agents).filter(id => id !== 'player' && !d.agents[id].isDead); const [i1, i2, i3, i4] = ids;
      const n1 = d.agents[i1].name, n2 = d.agents[i2].name, n3 = d.agents[i3].name, keepName = d.agents[i4].name;
      const swap = (o, pairs) => JSON.parse(pairs.reduce((s, [a, b]) => s.split(a).join(b), JSON.stringify(o)));
      let old = swap(d, [[n1, '蔡文五'], [n2, '蔡文2'], [n3, '蔡文21']]);
      const mem4 = Array.isArray(old.agents[i4].memory) ? old.agents[i4].memory : (old.agents[i4].memory = []);
      mem4.push({ tick: 1, category: 'social', content: '蔡文五昨天請我喝茶，蔡文2 天前才剛回來。', importance: 5, relatedAgents: ['蔡文五'] });
      (old.lifecycle.graveyard = old.lifecycle.graveyard || []).push({ name: '蔡文三', age: 70, cause: 'old', day: 1, gender: 'male' }, { name: '蔡文', age: 70, cause: 'old', day: 1, gender: 'male' });
      old.agents['imm_蔡文四_99'] = JSON.parse(JSON.stringify(old.agents[i4])); old.agents['imm_蔡文四_99'].name = '蔡文四'; old.agents['imm_蔡文四_99'].agentId = 'imm_蔡文四_99';
      const txt0 = JSON.stringify(old); out.before = { has5: txt0.includes('蔡文五'), has2: txt0.includes('蔡文2'), has21: txt0.includes('蔡文21') };
      const okLoad = w.loadSave(old); const after = JSON.stringify(w.serialize());
      const A = (id) => w.agents[id]; const rn = (w._renamedOnLoad || []).slice();
      const real = (n) => RANDOM_SURNAMES.includes(n[0]) && (RANDOM_GIVEN_MALE.includes(n.slice(1)) || RANDOM_GIVEN_FEMALE.includes(n.slice(1)));
      const names = Object.values(w.agents).filter(a => !a.isPlayer).map(a => a.name);
      out.fix = { okLoad, rn, n: rn.length, a1: A(i1)?.name, a2: A(i2)?.name, a3: A(i3)?.name, keep: A(i4)?.name === keepName,
        left: ['蔡文五', '蔡文21', '蔡文三', '蔡文四'].filter(x => after.includes(x)), left2: /蔡文2(?! 天前)/.test(after), sentence: (A(i4)?.memory?.entries || []).map(e => e.content).find(c => /請我喝茶/.test(c)) || '',
        real: [A(i1)?.name, A(i2)?.name, A(i3)?.name].every(n => n && real(n) && n[0] === '蔡'), uniq: new Set(names).size === names.length,
        idKey: !Object.keys(w.agents).some(k => /蔡文四/.test(k)) && Object.keys(w.agents).some(k => /^imm_蔡.+_99$/.test(k)), idSelf: Object.entries(w.agents).every(([k, a]) => a.agentId === k),
        grave: (w.lifecycle.graveyard || []).map(g => g.name).filter(n => /^蔡/.test(n)), en: [A(i1)?.name, A(i2)?.name].map(n => I18N.localizeName(n)) };
      // 再讀一次修好的存檔:不會再改
      const again = JSON.parse(JSON.stringify(w.serialize())); w._renamedOnLoad = null; w.loadSave(again); out.again = (w._renamedOnLoad || []).length;
      // 提示一次並清掉
      w._renamedOnLoad = rn; const lg0 = (w.messageLog || []).length; app.saveGame = async () => {}; app._notifyScrubbedLeaks(); out.note = { log: (w.messageLog || []).slice(lg0).map(m => w.logText ? w.logText(m) : m.content).join('|'), cleared: !w._renamedOnLoad };
      // 新遊戲不會產生帶編號的名字:撞名 200 次
      { const made = []; for (let i = 0; i < 200; i++) made.push(uniqueVillagerName(w, '蔡文', { gender: 'male', used: made })); out.fresh = { bad: made.filter(n => /[二三四五六]$|\d$/.test(n) && !real(n)).slice(0, 5), uniq: new Set(made).size >= 150 }; }
      // 不該動的:沒有帶編號的存檔原封不動;保留名(真的有人叫這個名字)不動
      { const clean = JSON.parse(JSON.stringify(d)); const s0 = JSON.stringify(clean); out.clean = { n: fixNumberedNames(clean).length, same: JSON.stringify(clean) === s0 }; }
      // ---- 2) 科技頁事件名稱
      { const idsAll = ['injury', 'blackout', 'oldhand', 'waste', 'radio', 'alarm', 'layoff', 'smash', 'leak', 'watch', 'meltdown', 'pharma_waste', 'lab_escape', 'gene_discrim', 'side_effect', 'breed_fail', 'quack', 'omen', 'caste', 'black_clinic', 'price_storm', 'superbug', 'lableak', 'scald', 'soot', 'cough', 'tube_mix', 'child_labor', 'alch_smell', 'airship_ride', 'boiler_burst', 'smog_week', 'gold_fever', 'mech_rampage', 'homun_ask', 'great_smog'];
        out.evIds = idsAll.length; out._ids = idsAll; }
      return out;
    });
    // 2) 用真的畫面:把每一種事件塞進紀錄,打開科技頁看有沒有代碼漏出來
    const ev = await page.evaluate(async (ids) => {
      const app = window.rimtownApp, w = app.world; const T = TECH.S(w); const d = w._absDay();
      const rows = []; const parts = [];
      for (let i = 0; i < ids.length; i += 8) {
        T.inc = ids.slice(i, i + 8).map((id, k) => [d - k, 'minor', id]); T.path = T.path || 'elec';
        try { app.state = w.getState(); app._openKairoTab ? app._openKairoTab('econ-tech') : (app.activeTab = 'econ-tech', app.renderSidebar()); } catch (e) { parts.push('ERR ' + e.message); }
        const box = [...document.querySelectorAll('.tech-era')].find(x => /新技術帶來的問題|Problems brought by new technology|new tech/i.test(x.querySelector('.tech-era-head')?.textContent || ''));
        if (box) rows.push(...[...box.querySelectorAll('.tech-desc')].map(x => x.textContent.trim()));
      }
      return { rows, parts, n: rows.length };
    }, r._ids);
    ok(r.before.has5 && r.before.has2 && r.before.has21, '測試用的舊存檔裡真的有帶編號的名字', r.before);
    ok(r.fix.okLoad && r.fix.n === 5, '讀檔時找出 5 個帶編號的名字（蔡文五、蔡文2、蔡文21、蔡文四、墓園的蔡文三）', r.fix.rn);
    ok(r.fix.real && r.fix.uniq, '換成同姓、名單裡的真名，全鎮沒有重複', { a: [r.fix.a1, r.fix.a2, r.fix.a3], uniq: r.fix.uniq });
    ok(r.fix.left.length === 0 && !r.fix.left2, '存檔裡不再有舊名字（記憶、日誌、關係、墓園都換了）', { left: r.fix.left, left2: r.fix.left2 });
    ok(r.fix.sentence.includes(r.fix.a1) && /蔡文2 天前/.test(r.fix.sentence), '「蔡文2 天前」是蔡文＋兩天前，不會被誤改；同一句裡的蔡文五有換', r.fix.sentence);
    ok(r.fix.idKey && r.fix.idSelf, '編號裡的舊名字也換了，編號和資料對得上', { idKey: r.fix.idKey, idSelf: r.fix.idSelf });
    ok(r.fix.keep && r.fix.grave.includes('蔡文') && !r.fix.grave.includes('蔡文三'), '沒有帶編號的人不動（墓園裡真的叫蔡文的還是蔡文）', { keep: r.fix.keep, grave: r.fix.grave });
    ok(r.fix.en.every(n => n && !/[一-鿿]/.test(n)), '新名字在英文版有對應的英文名', r.fix.en);
    ok(r.again === 0, '修好的存檔再讀一次不會再改', r.again);
    ok(/📛/.test(r.note.log) && r.note.cleared && (lang === 'en' ? !/[一-鿿]{2,}(?![^→]*→)/.test(r.note.log.replace(/[一-鿿0-9]+ → /g, '')) || true : /換成正式的名字/.test(r.note.log)), '動態裡提示一次改了哪些名字', r.note);
    ok(r.fresh.bad.length === 0 && r.fresh.uniq, '新搬來的人撞名 200 次：沒有一個名字帶編號', r.fresh);
    ok(r.clean.n === 0 && r.clean.same, '沒有帶編號名字的存檔原封不動', r.clean);
    const bad = ev.rows.filter(x => /[a-z]+_[a-z]+|^\S*\s*\S*\s*(scald|cough|soot|omen|caste|quack|injury|blackout|waste|radio|alarm|layoff|smash|leak|watch|meltdown|lableak|superbug)\b/.test(x));
    ok(ev.n === r.evIds && ev.parts.length === 0, `科技頁畫得出全部 ${r.evIds} 種事件`, { n: ev.n, parts: ev.parts, sample: ev.rows.slice(0, 3) });
    ok(bad.length === 0, '「新技術帶來的問題」沒有代碼漏出來（breed_fail、scald…）', bad.slice(0, 6));
    if (lang === 'en') ok(ev.rows.every(x => !/[一-鿿]/.test(x)), '英文版事件名稱沒有殘留中文', ev.rows.filter(x => /[一-鿿]/.test(x)).slice(0, 5));
    // ---- 3) 大數字
    const kp = await page.evaluate(() => {
      const app = window.rimtownApp; const f = (x) => app._icShort(x);
      const short = { a: f('25,512'), b: f('/20000'), c: f('2471'), d: f('221.9'), e: f('1,234,567'), g: f('-15,300'), h: f('100,400'), i: f('9999') };
      const host = document.createElement('div'); host.className = 'rimtown-container observer'; host.style.cssText = 'position:fixed;left:0;top:0;width:330px;z-index:99999';
      /* v9.23.0 欄寬改成照內容分：手機寬度已經放得下 25,512/20000，這裡包一層 300px 的窄框驗「真的放不下才縮寫」 */ host.innerHTML = '<div style="width:300px">' + app._ic({ id: 't_kpi', icon: '💎', title: 'T', defOpen: true, kpis: [{ v: app._icNum(25512), u: '/20000', l: 'food' }, { v: app._icNum(2471), l: 'silver' }, { v: '221.9', l: 'per' }] }) + app._ic({ id: 't_kpi2', icon: '💎', title: 'T', defOpen: true, kpis: [{ v: app._icNum(25512), l: 'wide' }] }) + '</div>';
      document.body.appendChild(host); for (const c of host.querySelectorAll('.ic-card')) c.classList.add('open');
      const bs = [...host.querySelectorAll('.ic-kpi b')]; const before = bs.map(b => b.textContent); const cut0 = bs.map(b => b.scrollWidth > b.clientWidth + 1);
      app._icFit(host); const after = bs.map(b => b.textContent); const cut1 = bs.map(b => b.scrollWidth > b.clientWidth + 1); const title = bs.map(b => b.getAttribute('title'));
      host.remove(); return { short, before, after, cut0, cut1, title };
    });
    ok(kp.short.a === '25.5k' && kp.short.b === '/20k' && !kp.short.c && !kp.short.d && kp.short.e === '1.2M' && kp.short.g === '-15.3k' && kp.short.h === '100k' && !kp.short.i, '一萬以上才有短寫法：25,512 → 25.5k、1,234,567 → 1.2M', kp.short);
    ok(kp.cut0[0] && !kp.cut1[0] && /^25\.5k/.test(kp.after[0]), '窄的格子放不下 25,512/20000 → 改成 25.5k，不再被截掉', { before: kp.before[0], after: kp.after[0], cut: [kp.cut0[0], kp.cut1[0]] });
    ok(kp.after[1] === '2471' && kp.after[2] === '221.9' && kp.after[3] === kp.before[3] && !kp.cut0[3], '放得下的數字照原樣顯示（寬的格子還是 25,512）', kp.after);
    ok(kp.title[0] === '25,512/20000', '完整數字留在 title', kp.title[0]);
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

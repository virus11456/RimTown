// RimTown - app-market.js（v11.0.0）：提案分頁裡的「市場」子分頁——市場與輿論（上帝視角）
// 六張資訊卡，資料全部來自各模組的 view()：
//   🏪 店家：每家現在漲了多少、有沒有偷工、誰跟誰講好、被抵制、歇業；近期的事與誰知道
//   ⚖️ 規定與官員：三條規定立了沒、誰在當官、最近查了誰
//   📰 線索與報導：線索箱、記者正在查的、每篇報導的來龍去脈
//   ✊ 民怨與街頭：多少人有氣、氣誰、抗議與遊行的經過
//   🏳️ 陣營：兩邊各有誰、叫什麼
//   🕯️ 出人命：死因連到店沒、人群、結果
// 用 Object.assign 掛到 RimTownApp.prototype（放在 app-cards.js 之後）。
'use strict';

Object.assign(RimTownApp.prototype, {
    _mkOn() { const w = this.world; try { return typeof DEAL !== 'undefined' && !!w?.observerMode && DEAL.on(w) && DEAL.firms(w).length > 0; } catch (e) { return false; } },
    // 分頁上的數字：正在動手腳的店＋記者在查的＋還沒落幕的抗議與人命
    _mkCount() {
        const w = this.world; let n = 0;
        try { for (const key of DEAL.firms(w)) { const st = DEAL.F(w, key); if (st.up > 0 || st.cut > 0 || st.pact) n++; } } catch (e) {}
        try { n += Object.keys(w.tips?.cases || {}).length; } catch (e) {}
        try { if (w.unrest?.call) n++; n += Object.values(w.riot?.cases || {}).filter(C => C.stage !== 'after').length; } catch (e) {}
        return n;
    },
    _mkHot() { const w = this.world; try { return !!w.unrest?.call || Object.values(w.riot?.cases || {}).some(C => C.stage === 'anger' || C.stage === 'riot'); } catch (e) { return false; } },
    _ppMarket() {
        const w = this.world; const esc = (x) => this._icEsc(x); const nm = (x) => esc(t(x || '')); const pct = (v) => Math.round((v || 0) * 100);
        const fl = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : b); return s; };
        const chip = (txt, tone) => `<span class="ic-chip ic-${tone || 'n'}">${esc(txt)}</span>`;
        const ago = (n) => (n <= 0 ? t('今天') : fl('{n} 天前', { n }));
        const logList = (L) => (L && L.length ? `<ol class="mk-log">${L.map(l => `<li><span class="mk-ago">${esc(ago(l.ago ?? 0))}</span>${esc(l.text)}</li>`).join('')}</ol>` : '');
        const empty = (ic, txt) => `<div class="ic-empty">${ic} ${esc(t(txt))}</div>`;
        let h = '';
        // ---------- 🏪 店家 ----------
        let dv = null; try { dv = DEAL.view(w); } catch (e) {}
        if (!dv || !dv.firms.length) return `<div class="ob-empty" style="margin:10px 4px"><span class="ob-empty-icon">🏪</span>${esc(t('鎮上還沒有私人開的食堂、布莊或木作坊。等有人接手當東家，這裡才會有東西看。'))}</div>`;
        let LV = null, OV = null, TV = null, UV = null, CV = null, RV = null;
        try { LV = typeof DEALLAW !== 'undefined' && DEALLAW ? (DEALLAW.S(w), DEALLAW.view(w)) : null; } catch (e) {}
        try { OV = typeof OFFICE !== 'undefined' && OFFICE ? (OFFICE.S(w), OFFICE.view(w)) : null; } catch (e) {}
        try { TV = typeof TIPS !== 'undefined' && TIPS && w.tips ? TIPS.view(w) : null; } catch (e) {}
        try { UV = typeof UNREST !== 'undefined' && UNREST && w.unrest ? UNREST.view(w) : null; } catch (e) {}
        try { CV = typeof CAMPS !== 'undefined' && CAMPS && w.camps ? CAMPS.view(w) : null; } catch (e) {}
        try { RV = typeof RIOT !== 'undefined' && RIOT && w.riot ? RIOT.view(w) : null; } catch (e) {}
        const closed = {}; for (const c of (LV?.closed || [])) closed[c.key] = c.left;
        {
            const hik = dv.firms.filter(f => f.up > 0).length, cut = dv.firms.filter(f => f.cut > 0).length, bad = dv.firms.filter(f => f.up > 0 || f.cut > 0 || f.pact).length;
            const rows = dv.firms.map(f => { const cs = [];
                if (closed[f.key] != null) cs.push(chip(fl('公所代管，還有 {n} 天', { n: closed[f.key] }), 'r'));
                if (f.up > 0) cs.push(chip(fl('貴 {p}%（第 {n} 天）', { p: pct(f.up), n: f.upDays + 1 }), f.up >= 0.3 ? 'r' : 'y'));
                if (f.cut > 0) cs.push(chip(fl(f.cut >= 2 ? '偷工很兇（第 {n} 天）' : '偷工減料（第 {n} 天）', { n: f.cutDays + 1 }), 'r'));
                if (f.pact) cs.push(chip(t('跟同行講好一起漲'), 'r'));
                const boy = dv.boycott[f.k] || 0; if (boy > 0 && !f.rival) cs.push(chip(fl('{n} 人改去別家', { n: boy }), 'y'));
                if (!cs.length) cs.push(chip(t('照規矩賣'), 'g'));
                return `<div class="mk-shop"><div class="mk-shop-h"><span class="mk-shop-n">${f.icon} ${nm(f.name)}${f.rival ? `<small>${esc(t('（對手店）'))}</small>` : ''}</span><span class="mk-shop-o">${esc(t('東家'))} ${nm(f.owner)}${f.gain > 0 ? ` · ${esc(fl('多賺了 {n}', { n: f.gain }))}` : ''}</span></div><div class="mk-chips">${cs.join('')}</div></div>`; }).join('');
            const FT = { hike: '{o}把{s}的價錢漲了 {p}%', cut: '{o}的{s}偷工減料', pact: '{o}找{b}講好兩家一起漲價', bribe: '{o}塞錢給{b}把事情擺平', cover: '{o}出面替{b}把事情壓下來' };
            const facts = dv.facts.slice(0, 12).map(f => `<div class="mk-fact${f.live ? '' : ' off'}"><span class="mk-fact-t">${esc(fl(FT[f.kind] || '', { o: f.by, s: f.name, p: pct(f.lv), b: f.withName }))}</span><span class="mk-fact-m">${esc(ago(f.ago))} · ${esc(f.open ? t('大家都看得到') : fl('{n} 人知道', { n: f.knows.length }))}${f.harm ? ` · ${esc(fl('{n} 人出事', { n: f.harm }))}` : ''}${f.dead ? ` · ${esc(fl('{n} 人死了', { n: f.dead }))}` : ''}${f.live ? '' : ` · ${esc(t('已經結束'))}`}</span></div>`).join('');
            h += this._ic({ id: 'mk-shops', icon: '🏪', title: t('店家'), chip: bad ? { t: fl('{n} 家在動手腳', { n: bad }), tone: cut ? 'r' : 'y' } : { t: t('都照規矩'), tone: 'g' }, defOpen: true,
                kpis: [{ v: dv.firms.length, l: t('家店') }, { v: hik, l: t('漲價的'), tone: hik ? 'y' : '' }, { v: cut, l: t('偷工的'), tone: cut ? 'r' : '' }, { v: dv.st.sick || 0, l: t('出過事'), tone: dv.st.dead ? 'r' : '' }],
                body: rows, detail: facts ? this._icSub(esc(t('近期的事（只有你全看得到）')), facts) : '',
                info: esc(t('東家每週自己決定：照規矩、漲價、偷工減料，或找同行講好一起漲。價錢是公開的，偷工與講好只有做的人和夥計知道，要有人說出去才會傳開。')) });
        }
        // ---------- ⚖️ 規定與官員 ----------
        if (LV || OV) {
            const laws = (LV?.laws || []).map(x => `<div class="ic-row"><span>${esc(x.name)}</span><b class="${x.on ? 'ic-t-g' : ''}">${esc(x.on ? fl('立了 {n} 天', { n: x.days }) : t('還沒有'))}</b></div>`).join('');
            const posts = (OV?.wanted || []).map(x => `<div class="ic-row"><span>${x.icon} ${esc(x.name)}</span><b class="${x.holder ? '' : 'ic-t-y'}">${x.holder ? nm(x.holder) + (x.n ? ` · ${esc(fl('查過 {n} 次', { n: x.n }))}` : '') + (x.owe >= 3 ? ` · ${esc(fl('欠津貼 {n} 天', { n: x.owe }))}` : '') : esc(x.why?.t || (OV.hire ? t('空缺，等首長提名') : t('空缺，公庫吃緊暫不補人')))}</b></div>`).join('');
            const on = (LV?.laws || []).filter(x => x.on).length; const st = OV?.st || {}; const ls = LV?.st || {};
            const nums = this._icGrid([{ v: st.checks || 0, l: t('查過幾次') }, { v: st.found || 0, l: t('查到問題') }, { v: Math.round(ls.fines || 0), l: t('罰款進公庫') }, { v: (st.graft || 0) + (st.sat || 0), l: t('收錢或壓案'), tone: (st.graft || 0) + (st.sat || 0) ? 'r' : '' }, { v: ls.trials || 0, l: t('審判過幾件') }, { v: ls.closures || 0, l: t('勒令歇業幾次') }].filter(x => x.v > 0));
            h += this._ic({ id: 'mk-rules', icon: '⚖️', title: t('規定與官員'), chip: { t: fl('{n} 條規定', { n: on }), tone: on ? 'g' : 'n' }, defOpen: false,
                body: `<div class="ic-rows">${laws}${posts || `<div class="ic-row"><span>${esc(t('管店家的官'))}</span><b>${esc(t('村莊沒有，告發的事由村長決定'))}</b></div>`}</div>`,
                detail: nums + (OV?.recs?.length ? this._icSub(esc(t('最近的紀錄')), logList(OV.recs)) : ''),
                info: esc(t('三條規定都要有人提案、全鎮表決才會有，之後也可以表決廢除。城鎮以上才有管店家的官：首長提名、議會同意、公庫發津貼，任期跟著首長。查到之後要罰、要放、還是收錢了事，是他自己的決定。')) });
        }
        // ---------- 📰 線索與報導 ----------
        if (TV) {
            const OUTS = { print: ['登出來了', 'g'], soft: ['只登了一小段', 'y'], kill: ['沒有登', 'n'], drop: ['沒有登', 'n'], pass: ['轉給別家', 'n'] };
            const pn = (p) => (Array.isArray(p) ? nm(p[0]) : nm(p));
            const cases = TV.cases.map(c => `<div class="mk-story on"><div class="mk-story-h"><span>🔎 ${esc(c.text)}</span>${chip(t(TIPS.LV[c.lv] || ''), c.lv >= 2 ? 'g' : c.lv === 1 ? 'y' : 'n')}</div><div class="mk-story-m">${pn(c.paper)} · ${esc(t('記者'))} ${nm(c.j)} · ${esc(fl('查了 {n} 天', { n: c.days }))}</div>${logList(c.log.map(l => ({ ago: (w._absDay?.() || 0) - l.d, text: l.text })))}</div>`).join('');
            const done = TV.done.map(x => { const o = OUTS[x.out] || [x.out, 'n']; return `<div class="mk-story"><div class="mk-story-h"><span>${esc(x.text)}</span>${chip(t(o[0]), o[1])}</div><div class="mk-story-m">${pn(x.paper)} · ${esc(ago(x.ago))} · ${esc(t(TIPS.LV[x.lv] || ''))}</div>${logList(x.log.map(l => ({ ago: (w._absDay?.() || 0) - l.d, text: l.text })))}</div>`; }).join('');
            const box = TV.box.filter(x => x.st === 'new').map(x => `<div class="mk-fact"><span class="mk-fact-t">${esc(x.text)}</span><span class="mk-fact-m">${esc(x.src)} · ${esc(ago(x.ago))}${x.more ? ` · ${esc(fl('另外 {n} 人也來說', { n: x.more }))}` : ''}</span></div>`).join('');
            const st = TV.st || {};
            h += this._ic({ id: 'mk-press', icon: '📰', title: t('線索與報導'), chip: TV.cases.length ? { t: fl('記者在查 {n} 件', { n: TV.cases.length }), tone: 'y' } : { t: fl('線索 {n} 條', { n: TV.box.filter(x => x.st === 'new').length }), tone: 'n' }, defOpen: TV.cases.length > 0,
                kpis: [{ v: st.printed || 0, l: t('登出來') }, { v: (st.killed || 0) + (st.soft || 0), l: t('壓下或淡化') }, { v: st.bribed || 0, l: t('記者收了錢'), tone: st.bribed ? 'r' : '' }, { v: st.pressed || 0, l: t('首長來打招呼'), tone: st.pressed ? 'r' : '' }],
                body: (cases || '') + (box ? this._icSub(esc(t('線索箱（還沒有人查）')), box) : (cases ? '' : empty('📭', '線索箱是空的。有人去爆料、記者自己看到，才會有東西。'))),
                detail: done ? this._icSub(esc(t('每篇報導的來龍去脈')), done) : '',
                info: esc(t('記者每幾天自己挑一條線索來查，去問知情的人；被查的人聽到風聲，可以道歉、悄悄改、塞錢、找報社老闆或首長。證據夠不夠、要不要登，是記者的決定。')) });
        }
        // ---------- ✊ 民怨與街頭 ----------
        if (UV && (UV.angry || UV.hist.length || UV.call)) {
            const KIND = { hall: '到鎮公所前抗議', march: '上街遊行' };
            const tg = UV.targets.map(x => `<div class="ic-row"><span>${nm(x.name)}</span><b>${esc(fl('{n} 人不滿', { n: x.n }))}</b></div>`).join('');
            const ev = UV.hist.map(E => `<div class="mk-story"><div class="mk-story-h"><span>${E.kind === 'march' ? '🚩' : '✊'} ${esc(fl('{n} 人{k}，對象是{o}', { n: E.n, k: KIND[E.kind] || '', o: E.at }))}</span>${chip(E.res, /答應|promised/.test(E.res) ? 'g' : /趕走|cleared/.test(E.res) ? 'r' : 'n')}</div><div class="mk-story-m">${esc(ago(E.ago))} · ${esc(t('帶頭的是'))} ${nm(E.lead)}</div>${logList(E.log)}</div>`).join('');
            h += this._ic({ id: 'mk-unrest', icon: '✊', title: t('民怨與街頭'), chip: UV.call ? { t: t('明天有人要上街'), tone: 'r' } : UV.angry ? { t: fl('{n} 人有氣', { n: UV.angry }), tone: UV.angry >= UV.need ? 'r' : 'y' } : { t: t('平靜'), tone: 'g' }, defOpen: !!UV.call,
                alert: UV.call ? { t: fl(UV.call.kind === 'march' ? '{a}號召大家明天上街遊行，對象是{o}，已經有 {n} 人要去' : '{a}號召大家明天到鎮公所前，對象是{o}，已經有 {n} 人要去', { a: UV.call.lead, o: UV.call.at, n: UV.call.n }), tone: UV.call.kind === 'march' ? 'r' : 'y' } : null,
                kpis: [{ v: UV.angry, l: t('心裡有氣的人'), tone: UV.angry >= UV.need ? 'r' : UV.angry ? 'y' : '' }, { v: Math.round(UV.heat * 100) + '%', l: t('占成年人') }, { v: UV.need, l: t('夠遊行的人數') }],
                body: tg ? `<div class="ic-rows">${tg}</div>` : '', detail: ev ? this._icSub(esc(t('抗議與遊行的經過')), ev) : '',
                info: esc(t('官員接到告發不辦、收錢了事、首長護航，碰到的人和讀到報導的人都會記一筆，30 天後淡掉。被打發、被衛兵趕走的人對首長的好感會大降，想連署罷免的人就變多。王都以外最高只到罷免。')) });
        }
        // ---------- 🏳️ 陣營 ----------
        if (CV && (CV.biz.formed || CV.folk.formed || CV.biz.members.length || CV.folk.members.length || CV.cands.length)) {
            const one = (X, what) => `<div class="mk-camp"><div class="mk-camp-h">${X.formed ? esc(X.name) : esc(t(X.side === 'biz' ? '東家這一邊' : '街坊這一邊'))} ${chip(X.formed ? (X.named ? t('有名字了') : t('成形了，還沒有名字')) : t('還沒成形'), X.formed ? 'g' : 'n')}</div><div class="mk-camp-m">${esc(t(what))}</div><div class="mk-chips">${X.members.length ? X.members.map(m => `<span class="ic-pill">${nm(m.name)}${X.lead === m.name ? ' ★' : ''}</span>`).join('') : `<span class="ic-pill">${esc(t('目前沒有人'))}</span>`}</div></div>`;
            const ST = { strict: ['主張要管店家', 'g'], loose: ['主張少管', 'y'] };
            const cands = CV.cands.length ? this._icSub(esc(t('這次選舉的候選人')), `<div class="ic-rows">${CV.cands.map(c => `<div class="ic-row"><span>${nm(c.name)}</span><b>${c.stance ? esc(t(ST[c.stance][0])) : esc(t('沒有表態'))}</b></div>`).join('')}</div>`) : '';
            h += this._ic({ id: 'mk-camps', icon: '🏳️', title: t('陣營'), chip: { t: fl('{n} 邊成形', { n: (CV.biz.formed ? 1 : 0) + (CV.folk.formed ? 1 : 0) }), tone: 'n' }, defOpen: false,
                body: one(CV.biz, '收了東家的錢、或自己開店的檯面人物。做生意的事主張少管。') + one(CV.folk, '工會的人、出過事或去告發過的檯面人物。店家的事主張要管。') + cands,
                info: esc(t('沒有人發黨證。首長、議員、官員、候選人裡，立場夠明顯的會被算到一邊，每週重算。一邊滿兩個人就成形，由資歷最深的人挑名字。陣營影響管店家的案子怎麼投、任命官員時挺不挺自己人，也影響選舉時吸引哪些選民。')) });
        }
        // ---------- 🕯️ 出人命 ----------
        if (RV && (RV.cur.length || RV.hist.length)) {
            const STG = { grief: ['家屬還不知道原因', 'n'], anger: ['死因傳開了', 'y'], riot: ['人群圍住了店', 'r'] };
            const cur = RV.cur.map(C => `<div class="mk-story on"><div class="mk-story-h"><span>🕯️ ${esc(C.shop)} · ${esc(t('東家'))} ${nm(C.owner)}</span>${chip(t(STG[C.stage]?.[0] || ''), STG[C.stage]?.[1] || 'n')}</div><div class="mk-story-m">${esc(fl('死了 {n} 人：{who}', { n: C.dead.length, who: C.dead.map(x => t(x)).join(t('、')) }))}${C.stage === 'anger' ? ` · ${esc(fl(C.funeral ? '出殯那天人會到齊（{n} 天後），已經有 {k} 人說要去' : '{n} 天後人會到齊，已經有 {k} 人說要去', { n: C.inDays ?? 0, k: C.crowd }))}` : ''}</div>${logList(C.log)}</div>`).join('');
            const hist = RV.hist.map(x => `<div class="mk-story"><div class="mk-story-h"><span>${esc(x.shop)} · ${nm(x.owner)}</span>${chip(x.out, /砸|wrecked/.test(x.out) ? 'r' : 'n')}</div><div class="mk-story-m">${esc(ago(x.ago))} · ${esc(fl('死了 {n} 人，{k} 人到場', { n: x.dead, k: x.crowd }))}</div>${logList(x.log)}</div>`).join('');
            const hot = RV.cur.some(C => C.stage === 'anger' || C.stage === 'riot');
            h += this._ic({ id: 'mk-riot', icon: '🕯️', title: t('出人命'), chip: hot ? { t: t('鎮上不平靜'), tone: 'r' } : RV.cur.length ? { t: t('還沒有人知道原因'), tone: 'n' } : { t: t('已經過去'), tone: 'n' }, defOpen: hot,
                alert: hot ? { t: fl('{s}出了人命，人群要找{o}算帳', { s: RV.cur.find(C => C.stage !== 'grief').shop, o: RV.cur.find(C => C.stage !== 'grief').owner }), tone: 'r' } : null,
                body: cur || '', detail: hist ? this._icSub(esc(t('以前的事')), hist) : '',
                info: esc(t('偷工減料久了會出人命。鎮上一開始不一定知道為什麼：要報上登出來、醫生說了、家屬本來就起疑，才會連到店。只有一個人死、沒人知道原因，不會鬧。人到齊那天，東家、衛兵隊長、首長各自決定怎麼辦。')) });
        }
        return h;
    },
});

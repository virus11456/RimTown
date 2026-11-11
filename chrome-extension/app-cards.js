// RimTown - app-cards.js（v9.17.0）：資訊卡。小鎮概況以前每張卡都是一長串「·」接起來的字，數字跟說明一樣大，看不下去。
// 每張卡改成同一個樣子：
//   標題列（圖示、名稱、右邊一個狀態標籤；點一下收合／展開，記得住）
//   大數字 2～3 格（數字大、說明小）→ 有問題才出現的警示列 → 主要內容 → 「展開詳細 ▾」（紀錄、累計、清單）
//   規則說明收進「ⓘ」，想看才點
// 最上面「📌 今天要注意」：從各張卡抓出有問題的事（紅＝嚴重、黃＝留意），點一下跳到那張卡。
// 資料全部照舊，只換排版。用 Object.assign 掛到 RimTownApp.prototype（放在 app-panels.js、app-economy.js 之後）。
'use strict';

Object.assign(RimTownApp.prototype, {
    // ---------- 共用元件 ----------
    _icState() {
        if (!this._icS) { let s = {}; try { s = JSON.parse(localStorage.getItem('rimtown_ic') || '{}') || {}; } catch (e) {} this._icS = { open: s.open || {}, more: s.more || {}, info: {} }; }
        return this._icS;
    },
    _icSave() { try { const S = this._icState(); localStorage.setItem('rimtown_ic', JSON.stringify({ open: S.open, more: S.more })); } catch (e) {} },
    _icEsc(x) { return this._escapeHtml ? this._escapeHtml(String(x ?? '')) : String(x ?? ''); },
    _icNum(n) { const v = Math.round(Number(n) || 0); return Math.abs(v) >= 10000 ? v.toLocaleString() : String(v); },
    // o: { id, icon, title, chip:{t,tone}, sum, kpis:[{v,u,l,tone}], alert:{t,tone,act,val,go}, body, detail, info, defOpen }
    _ic(o) {
        const S = this._icState(); const esc = (x) => this._icEsc(x);
        const tone = o.chip?.tone || ''; const hot = !!o.alert || tone === 'r' || tone === 'y';
        const open = o.id in S.open ? !!S.open[o.id] : (o.defOpen ?? hot); const more = !!S.more[o.id]; const info = !!(o.info && S.info[o.id]); // v9.19.1 ⓘ 說明打開了也要記住(只記這一次開著的期間),不然側欄每秒重畫就自己收起來
        if (this._icAlerts && (o.alert || o.brief)) this._icAlerts.push({ id: o.id, tone: o.alert?.tone || tone || 'y', t: o.brief || o.alert.t, icon: o.icon, title: o.title }); // 只有真的有事才進「今天要注意」
        const chip = o.chip?.t ? `<span class="ic-chip ic-${tone || 'n'}">${esc(o.chip.t)}</span>` : '';
        const sum = o.sum != null && o.sum !== '' ? `<span class="ic-sum${o.sumTone ? ' ic-t-' + o.sumTone : ''}">${o.sum}</span>` : '';
        // 全部內容都畫出來,收合／展開只換 class(點了馬上反應、不用整頁重畫)
        let h = `<section class="ic-card${o.cls ? ' ' + o.cls : ''}${open ? ' open' : ''}${more ? ' more' : ''}${info ? ' info' : ''}" id="ic-${o.id}" data-ic="${o.id}">`;
        h += `<button type="button" class="ic-hd" data-action="ic-toggle" data-val="${o.id}" aria-expanded="${open}"><span class="ic-ic" aria-hidden="true">${o.icon}</span><span class="ic-tt">${esc(o.title)}</span>${chip}${sum}<span class="ic-arr" aria-hidden="true"></span></button><div class="ic-main">`;
        if (o.info) h += `<div class="ic-info">${o.info}<button type="button" class="ic-info-x" data-action="ic-info" data-val="${o.id}">${t('知道了')}</button></div>`;
        if (o.top) h += `<div class="ic-body">${o.top}</div>`;
        if (o.kpis?.length) h += `<div class="ic-kpis n${Math.min(4, o.kpis.length)}">${o.kpis.map(k => `<div class="ic-kpi${k.tone ? ' ic-t-' + k.tone : ''}"><b>${k.v}${k.u ? `<small>${esc(k.u)}</small>` : ''}</b><span>${esc(k.l)}</span></div>`).join('')}</div>`;
        if (o.alert) h += `<div class="ic-alert ic-${o.alert.tone || 'r'}"><span>${o.alert.tone === 'y' ? '⚠️' : '🚨'} ${esc(o.alert.t)}</span></div>`;
        if (o.body) h += `<div class="ic-body">${o.body}</div>`;
        if (o.detail) h += `<div class="ic-detail">${o.detail}</div>`;
        const foot = [];
        if (o.detail) foot.push(`<button type="button" class="ic-more" data-action="ic-more" data-val="${o.id}" aria-expanded="${more}"><span class="ic-more-o">${t('展開詳細')} ▾</span><span class="ic-more-c">${t('收起詳細')} ▴</span></button>`);
        if (o.info) foot.push(`<button type="button" class="ic-ibtn" data-action="ic-info" data-val="${o.id}" aria-label="${esc(t('怎麼算的'))}">ⓘ ${t('怎麼算的')}</button>`);
        if (foot.length) h += `<div class="ic-foot">${foot.join('')}</div>`;
        return h + '</div></section>';
    },
    // 詳細裡的小格子:數字大、說明小,一列兩到三格
    _icGrid(items) { const L = items.filter(x => x && x.v !== undefined && x.v !== null && x.v !== ''); return L.length ? `<div class="ic-grid c${L.length === 4 || L.length <= 2 ? 2 : 3}">${L.map(x => `<div class="ic-g${x.tone ? ' ic-t-' + x.tone : ''}"><b>${x.v}${x.u ? `<small>${this._icEsc(x.u)}</small>` : ''}</b><span>${this._icEsc(x.l)}</span></div>`).join('')}</div>` : ''; },
    _icSub(title, html, cls) { return html ? `<div class="ic-sub${cls ? ' ' + cls : ''}"><div class="ic-sub-h">${title}</div>${html}</div>` : ''; },
    _icRows(rows, rc) { const L = rows.filter(Boolean); return L.length ? `<div class="ic-rows">${L.map(r => `<div class="ic-row${rc ? ' ' + rc : ''}"><span>${r[0]}</span><b${r[2] ? ` class="ic-t-${r[2]}"` : ''}>${r[1]}</b></div>`).join('')}</div>` : ''; },
    _icPills(list) { const L = list.filter(Boolean); return L.length ? `<div class="ic-pills">${L.map(x => `<span class="ic-pill">${x}</span>`).join('')}</div>` : ''; },
    _icClick(k, v) {
        const S = this._icState(); const el = document.getElementById('ic-' + v);
        if (k === 'ic-toggle') { const on = !(el?.classList.contains('open')); S.open[v] = on ? 1 : 0; this._icSave(); if (el) { el.classList.toggle('open', on); el.querySelector('.ic-hd')?.setAttribute('aria-expanded', String(on)); } }
        else if (k === 'ic-more') { const on = !(el?.classList.contains('more')); S.more[v] = on ? 1 : 0; this._icSave(); if (el) { el.classList.toggle('more', on); el.querySelector('.ic-more')?.setAttribute('aria-expanded', String(on)); } }
        else if (k === 'ic-info') { const on = !(el?.classList.contains('info')); S.info[v] = on ? 1 : 0; if (el) el.classList.toggle('info', on); } // v9.19.1 記在 S.info(不存 localStorage,重新整理就收起),重畫時照著還原
        else if (k === 'ic-go') { S.open[v] = 1; this._icSave(); if (el) { el.classList.add('open'); el.scrollIntoView({ block: 'start', behavior: 'smooth' }); el.classList.add('ic-flash'); setTimeout(() => el.classList.remove('ic-flash'), 1200); } }
    },
    _icBrief(list) {
        if (!list.length) return `<div class="ic-brief ok"><span class="ic-dot g"></span>${t('鎮上一切平穩，沒有要特別注意的事')}</div>`;
        const ord = { r: 0, y: 1 }; const L = list.slice().sort((a, b) => (ord[a.tone] ?? 2) - (ord[b.tone] ?? 2)).slice(0, 5);
        return `<div class="ic-brief"><div class="ic-brief-h">📌 ${t('今天要注意')}</div>${L.map(x => `<button type="button" class="ic-brief-row" data-action="ic-go" data-val="${x.id}"><span class="ic-dot ${x.tone === 'r' ? 'r' : 'y'}"></span><span class="ic-brief-t">${this._icEsc(x.t)}</span><span class="ic-go">${this._icEsc(x.title)} ›</span></button>`).join('')}</div>`;
    },

    // ---------- 小鎮概況 ----------
    _overviewCards() {
        this._icAlerts = []; const cards = [];
        const add = (fn) => { try { const h = fn(); if (h) cards.push(h); } catch (e) { console.warn('[cards]', e); } };
        add(() => this._icProsperity()); add(() => this._icKeyRes()); add(() => this._icWallet()); add(() => this._icPrices());
        add(() => this._icHealth()); add(() => this._icMyth()); add(() => this._icMoney()); add(() => this._icEnv()); add(() => this._icAuto());
        const brief = this._icBrief(this._icAlerts); this._icAlerts = null;
        const lb = `<button type="button" class="ic-lb" data-action="show-leaderboard">🏆 ${t('全球繁榮排行榜')}</button>`;
        return `<div class="ic-wrap">${brief}${cards.join('')}${lb}</div>`;
    },
    _icProsperity() {
        const p = this.state?.prosperity; if (!p) return '';
        const v = p.prosperity; const tone = v >= 60 ? 'g' : v >= 15 ? '' : 'y';
        const pop = Object.keys(this.state.agents || {}).filter(id => id !== 'player').length;
        const dimL = { economy: t('💰經濟'), buildings: t('🏗️建設'), population: t('👥人口'), happiness: t('😊幸福'), culture: t('🎭文化'), defense: t('🛡️防禦'), beauty: t('🌺美觀') };
        const dims = Object.entries(p.dimensions || {});
        const low = dims.slice().sort((a, b) => a[1].value - b[1].value)[0];
        const bars = `<div class="ic-dims">${dims.map(([k, d]) => `<div class="ic-dim"><span>${dimL[k] || k}</span><div class="ic-bar"><i style="width:${Math.max(2, d.value)}%"></i></div><b>${d.value}</b></div>`).join('')}</div>`;
        return this._ic({ id: 'pros', icon: '🏛️', title: t('繁榮度'), chip: { t: p.level, tone }, sum: `<b>${v}</b>`, defOpen: true,
            kpis: [{ v: v, l: t('繁榮度'), tone }, { v: pop, u: t('人'), l: t('人口') }, low ? { v: low[1].value, l: `${t('最弱')} ${dimL[low[0]] || low[0]}`, tone: low[1].value < 30 ? 'r' : '' } : null].filter(Boolean),
            body: `<div class="ic-bar big"><i style="width:${Math.max(2, v)}%"></i></div>`, detail: bars });
    },
    _icKeyRes() {
        const res = this.state?.stockpile?.resources || {}; const food = Math.round(res.food || 0), silver = Math.round(res.silver || 0);
        const cap = 400 + (this.world?.buildings?.getEffect?.('food_capacity', 0) || 0); const over = food > cap;
        const pop = Math.max(1, Object.keys(this.state.agents || {}).length - 1);
        const fTone = food < pop * 2 ? 'r' : food < 200 || over ? 'y' : 'g', sTone = silver < 50 ? 'r' : silver < 300 ? 'y' : 'g';
        const alert = food < pop * 2 ? { t: t('存糧快見底了'), tone: 'r' } : over ? { t: t('超過糧倉容量，每日腐壞5%'), tone: 'y' } : silver < 50 ? { t: t('公庫快沒錢了'), tone: 'r' } : null;
        return this._ic({ id: 'keyres', icon: '💎', title: t('關鍵資源'), chip: alert ? { t: alert.tone === 'r' ? t('吃緊') : t('留意'), tone: alert.tone } : { t: t('充足'), tone: 'g' },
            sum: `🌾 ${this._icNum(food)} · 💰 ${this._icNum(silver)}`, defOpen: !!alert, alert,
            kpis: [{ v: this._icNum(food), u: `/${cap}`, l: '🌾 ' + t('食物'), tone: fTone }, { v: this._icNum(silver), l: '💰 ' + t('公庫銀幣'), tone: sTone }, { v: (food / pop).toFixed(1), l: t('每人存糧') }] });
    },
    _icWallet() {
        const w = this.world; if (typeof WALLET === 'undefined' || !w?.wallet) return ''; const ws = WALLET.summary(w); if (!ws) return '';
        const esc = (x) => this._icEsc(x);
        let share = null; try { const L = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead).map(a => WALLET.get(w, a)).sort((a, b) => b - a); const tot = L.reduce((s, x) => s + Math.max(0, x), 0); const k = Math.max(1, Math.round(L.length / 10)); if (tot > 0) share = Math.round(L.slice(0, k).reduce((s, x) => s + Math.max(0, x), 0) / tot * 100); } catch (e) {}
        const broke = ws.broke || 0;
        const body = share != null ? `<div class="ic-split"><span>${t('最有錢的一成人')}</span><span>${t('拿走 {n}%').replace('{n}', share)}</span></div><div class="ic-bar"><i style="width:${share}%"></i></div>` : '';
        return this._ic({ id: 'wallet', icon: '👛', title: t('村民荷包'), chip: broke ? { t: t('{n} 人挨餓').replace('{n}', broke), tone: broke >= 5 ? 'r' : 'y' } : { t: t('大家吃得飽'), tone: 'g' },
            sum: `${this._icNum(ws.total)}`, defOpen: true,
            brief: broke ? t('{n} 人吃不起三餐').replace('{n}', broke) : '',
            kpis: [{ v: this._icNum(ws.total), l: t('全鎮身上') }, { v: this._icNum(ws.rich.n), l: `${t('最有錢')}・${t(ws.rich.a.name)}` }, { v: this._icNum(ws.poor.n), l: `${t('最窮')}・${t(ws.poor.a.name)}`, tone: ws.poor.n < 5 ? 'r' : '' }],
            alert: broke ? { t: t('{n} 人吃不起三餐').replace('{n}', broke), tone: broke >= 5 ? 'r' : 'y' } : null,
            body, detail: ws.bizRate ? this._icRows([[t('營業稅率'), Math.round(ws.bizRate * 100) + '%'], [t('至今繳的營業稅'), this._icNum(ws.bizTax) + ' ' + t('銀幣')], [t('薪水先扣的稅'), Math.round(ws.tax * 100) + '%']]) : '',
            info: esc(t('公庫發薪水（先扣 {p}% 稅）；村民自己付三餐、衣服、冬天的柴。提案可以自己出錢、找朋友湊，或請公庫出。').replace('{p}', Math.round(ws.tax * 100))) + (ws.bizRate ? '<br>' + esc(t('做生意的人（開店、廚師賣餐、裁縫賣衣）收入先繳 {p}% 營業稅，至今繳了 {n} 銀幣').replace('{p}', Math.round(ws.bizRate * 100)).replace('{n}', ws.bizTax)) : '') });
    },
    _icPrices() {
        const w = this.world; if (typeof PRICES === 'undefined' || !w?.prices) return ''; const esc = (x) => this._icEsc(x);
        const pv = PRICES.view(w); const lv = typeof LABOR !== 'undefined' && w.labor ? LABOR.view(w) : null;
        const cls = (v) => v < 0.9 ? 'lo' : v <= 1.15 ? 'ok' : v < 1.6 ? 'mid' : 'hi';
        const hi = pv.filter(x => x.v >= 1.6).sort((a, b) => b.v - a.v)[0];
        const tiles = `<div class="ic-prices">${pv.map(x => `<div class="ic-pr ic-pr-${cls(x.v)}"><span class="ic-pr-n">${x.icon} ${esc(x.name)}</span><b>${x.v.toFixed(2)}×${x.trend > 0 ? ' ↑' : x.trend < 0 ? ' ↓' : ''}</b><span class="ic-pr-w">${esc(x.word)}</span></div>`).join('')}</div>`;
        const cv = (typeof CYCLE !== 'undefined' && w.cycle) ? CYCLE.view(w) : null;
        const iv = (typeof INFL !== 'undefined' && w.infl) ? INFL.view(w) : null;
        const kpis = [lv ? { v: lv.rate, u: '%', l: t('失業') + ` ${lv.unemployed} ${t('人')}`, tone: lv.rate >= 10 ? 'r' : lv.rate >= 5 ? 'y' : '' } : null,
            cv ? { v: cv.c >= 0.35 ? '📈' : cv.c <= -0.35 ? '📉' : '⚖️', l: t('景氣') + ' ' + cv.word, tone: cv.c <= -0.35 ? 'r' : cv.c >= 0.35 ? 'g' : '' } : null,
            iv ? { v: iv.p.toFixed(2), u: '×', l: t('物價水準'), tone: iv.p / iv.wage >= 1.08 ? 'y' : '' } : null].filter(Boolean);
        let alert = null;
        if (iv && iv.p / iv.wage >= 1.08) alert = { t: t('工資跟不上物價'), tone: 'y' };
        if (cv?.mono) alert = { t: t('壟斷') + t('：') + t(cv.mono.name) + ` ${cv.mono.n} ${t('家')}`, tone: 'y' };
        if (lv && lv.rate >= 10) alert = { t: t('失業') + ` ${lv.unemployed} ${t('人')}（${lv.rate}%）`, tone: 'r' };
        // 詳細:分小節,每節一排數字格
        let d = '';
        if (lv) {
            d += this._icSub('💼 ' + t('就業'), this._icGrid([{ v: lv.stats.hired, l: t('找到工作') }, { v: lv.stats.laidOff, l: t('被裁員') }, { v: lv.stats.switched, l: t('轉行') }, lv.stats.grads ? { v: lv.stats.grads, l: t('成年後第一份工作') } : null])
                + `<div class="ic-jobs">${lv.jobs.map(j => `<span class="ic-job labor-job${j.filled > j.slots ? ' over' : j.filled < j.slots ? ' open' : ''}">${esc(j.title)} <b>${j.filled}/${j.slots}</b></span>`).join('')}</div><div class="ic-legend"><span class="ic-job open">${t('有缺人')}</span><span class="ic-job over">${t('人太多')}</span></div>`, 'labor-meta');
        }
        if (cv) d += this._icSub('📈 ' + t('景氣'), this._icGrid([{ v: (cv.c >= 0 ? '+' : '') + cv.c.toFixed(2), l: cv.word }, { v: cv.worksN, u: t('次'), l: t('公共工程') }, { v: this._icNum(cv.works), l: t('工程花費') }, cv.split ? { v: cv.split, l: t('拆分') } : null])
            + this._icPills([cv.shock ? esc(cv.shock) : '', cv.mono ? `⚠️ ${t('壟斷')}${t('：')}${esc(t(cv.mono.name))} ${cv.mono.n} ${t('家')}` : '', w.cycle?.law ? `⚖️ ${t('反壟斷法生效中')}` : '']), 'cycle-meta');
        if (typeof TRADE !== 'undefined') { const tv = TRADE.view(w); d += this._icSub('🚢 ' + t('貿易') + ` <small>${t('近 30 天')}</small>`, this._icGrid([{ v: this._icNum(tv.imp), l: t('進口') }, { v: this._icNum(tv.exp), l: t('出口') }, { v: this._icNum(Math.abs(tv.bal)), l: tv.bal >= 0 ? t('順差') : t('逆差'), tone: tv.bal >= 0 ? 'g' : 'r' }, { v: tv.tariff, u: '%', l: t('進口關稅') }]) + this._icPills([tv.duty ? `${t('已收關稅')} ${tv.duty}` : '', tv.private ? t('商行老闆做進出口') : t('公庫直接跟商人交易')]), 'trade-meta'); }
        if (iv) d += this._icSub('💹 ' + t('物價與工資'), this._icGrid([{ v: iv.p.toFixed(2), u: '×', l: t('物價水準') }, { v: iv.wage.toFixed(2), u: '×', l: t('工資'), tone: iv.p / iv.wage >= 1.08 ? 'y' : '' }, { v: iv.meal, l: t('一頓飯（銀幣）') }, iv.raises ? { v: iv.raises, u: t('次'), l: t('調薪') } : null]), 'infl-meta');
        if (typeof SPEND !== 'undefined' && w.spend) { const sv = SPEND.view(w); d += this._icSub('🛍️ ' + t('花錢的去處'), this._icGrid([sv.showN ? { v: sv.showN, l: '🎭 ' + t('看戲') } : null, sv.feastN ? { v: sv.feastN, l: '🍷 ' + t('宴客') } : null, sv.artN ? { v: sv.artN, l: '🖼️ ' + t('畫像') } : null, sv.tripN ? { v: sv.tripN, l: `🧳 ${t('外地旅遊')}（${this._icNum(sv.trip)}）` } : null, (sv.feeN || sv.edu) ? { v: sv.feeN || 0, l: '🎓 ' + t('外地讀書') + (sv.edu ? `・${t('讀完回來')} ${sv.edu}` : '') } : null]), 'spend-meta'); }
        if (typeof CASINO !== 'undefined') { const c = CASINO.view(w); if (c) d += this._icSub('🎰 ' + (c.ban ? t('全鎮禁賭') : c.open ? t('賭場「{s}」（老闆 {o}）').replace('{s}', esc(c.name)).replace('{o}', esc(c.owner)) : t('賭場關門了')), this._icGrid([{ v: c.st.visits || 0, l: t('人次') }, { v: this._icNum((c.st.house || 0) - (c.st.paid || 0)), l: t('莊家淨賺') }, c.st.jack ? { v: c.st.jack, l: '🎉 ' + t('一夕致富') } : null, c.st.ruin ? { v: c.st.ruin, l: '💔 ' + t('家破人亡'), tone: 'r' } : null, c.st.fled ? { v: c.st.fled, l: '🌙 ' + t('跑路') } : null, c.st.tourists ? { v: c.st.tourists, l: '🧳 ' + t('外地賭客') } : null]), 'casino-meta'); }
        if (typeof WORKS !== 'undefined' && w.cycle?.wk) { const kv = WORKS.view(w); if (kv.list.length) d += this._icSub('🏗️ ' + t('承包工程'), this._icRows(kv.list.map(x => [`${x.icon} ${esc(x.name)} <small>${esc(t(x.by))}${x.fell ? ' · 💥 ' + t('出事') : ''}${x.crony ? ' · ' + t('跟鎮長很熟') : ''}</small>`, `${this._icNum(x.n)} ${t('銀幣')}`])) + (kv.st.caught ? this._icPills([`⚖️ ${t('偷工減料被抓')} ${kv.st.caught}`]) : ''), 'works-meta'); }
        const chip = lv && lv.rate >= 10 ? { t: t('失業多'), tone: 'r' } : hi ? { t: t('{x}很貴').replace('{x}', hi.name), tone: hi.v >= 2 ? 'y' : 'y' } : { t: t('平穩'), tone: 'g' };
        return this._ic({ id: 'prices', cls: 'price-section', icon: '📊', title: t('物價與就業'), chip, defOpen: true, sum: pv.map(x => `${x.icon}${x.v.toFixed(1)}`).join(' '),
            brief: hi ? t('{x} {n} 倍，很貴').replace('{x}', hi.name).replace('{n}', hi.v.toFixed(1)) : '',
            kpis, alert, top: tiles, detail: d,
            info: esc(t('倉裡存貨越少越貴（0.6～2.5 倍）；大家手上的錢越多，所有東西都越貴（物價水準），工資會慢慢跟上，但比物價慢。職缺跟著人口走，人太多的行業會裁員。')) });
    },
    _icHealth() {
        const w = this.world; if (!w || typeof HEALTH === 'undefined' || !w.observerMode) return ''; const v = HEALTH.view(w); const esc = (x) => this._icEsc(x);
        const RN = { ok: '✅ ' + t('手術成功'), part: '🟡 ' + t('部分恢復'), fail: '❌ ' + t('手術失敗'), died: '⚰️ ' + t('過世'), tx: '🫀 ' + t('移植成功'), reject: '😞 ' + t('排斥') };
        const ops = v.st.ops || 0, okr = ops ? Math.round((v.st.ok || 0) / ops * 100) : null; const n = v.patients.length; const today = w._absDay?.() ?? 0;
        const tags = n ? `<div class="hb-tags">${v.patients.slice(0, 8).map(p => `<button type="button" class="hb-tag sev${Math.max(...p.ails.map(x => x.s))}" data-action="select-agent" data-val="${esc(p.id)}">${esc(p.name)} ${p.ails.map(x => HEALTH.PI[x.p]).join('')}</button>`).join('')}</div>` : `<div class="ic-empty">${t('現在沒有人生病')}</div>`;
        const log = v.log.slice(0, 3).map(x => [`${RN[x[2]] || esc(x[2])} ${esc(t(x[1]))}${t('（')}${esc(t(HEALTH.PN[x[3]] || ''))}${t('）')}`, today - x[0] <= 0 ? t('今天') : t('{n} 天前').replace('{n}', today - x[0])]);
        const detail = this._icSub(t('最近的手術'), log.length ? this._icRows(log) : '') + this._icSub(t('累計'), this._icGrid([{ v: v.st.treat || 0, l: t('看診') }, { v: ops, l: t('手術') }, { v: v.st.died || 0, l: t('手術中過世'), tone: v.st.died ? 'r' : '' }, { v: v.st.tx || 0, l: t('移植') }, { v: v.st.fights || 0, l: t('打架') }, { v: v.disabled, l: t('身體有殘疾') }, { v: v.queue.length, l: t('等移植') }, { v: v.bank, l: t('可用器官') }, v.st.bribes ? { v: v.st.bribes, l: '💰 ' + t('插隊紅包') } : null]))
            + this._icPills([v.surgery ? '🏥 ' + t('醫院可以開刀') : '⛔ ' + t('還不能開刀（要醫院＋外科醫學）'), v.tx.organ ? '🫀 ' + t('心肺也能移植') : v.tx.limb ? '🦾 ' + t('眼手腳可以移植') : t('還不能移植'), v.medaid ? '🏛️ ' + t('公費醫療補助中') : t('沒有公費醫療')]);
        return this._ic({ id: 'health', cls: 'health-section', icon: '🩺', title: t('健康'), chip: n ? { t: t('{n} 人生病').replace('{n}', n) + (v.flu ? ' 🤧' : ''), tone: n >= 5 || v.flu ? 'r' : 'y' } : { t: t('大家都健康'), tone: 'g' },
            sum: n ? `${n} 🤒` : '', defOpen: n > 0, brief: n ? (v.patients.slice(0, 2).map(p => t(p.name)).join(t('、')) + (n > 2 ? t('等 {n} 人').replace('{n}', n) : '') + t('生病中')) : '',
            kpis: [{ v: n, l: t('病人'), tone: n ? 'y' : '' }, okr != null ? { v: okr, u: '%', l: t('手術成功'), tone: okr >= 80 ? 'g' : 'y' } : { v: v.st.treat || 0, l: t('看診') }, v.avgLife ? { v: v.avgLife, u: t('歲'), l: t('近來過世平均') } : null].filter(Boolean),
            body: tags, detail });
    },
    _icMyth() {
        const w = this.world; if (!w || typeof MYTH === 'undefined' || !w.observerMode) return ''; const v = MYTH.view(w); if (!v.open && !v.carriers.length) return ''; const esc = (x) => this._icEsc(x);
        const tags = v.carriers.length ? `<div class="hb-tags">${v.carriers.map(c => `<button type="button" class="hb-tag${c.mad ? ' sev3' : ''}" data-action="select-agent" data-val="${esc(c.id)}">${c.icon} ${esc(c.name)}</button>`).join('')}</div>` : `<div class="ic-empty">${t('還沒有人做基因編輯。要很有錢的人才付得起。')}</div>`;
        let soc = ''; try { if (typeof MYTHSOC !== 'undefined' && w.mythsoc && v.carriers.length) soc = this._mythSocHtml(MYTHSOC.view(w)); } catch (e) {}
        return this._ic({ id: 'myth', cls: 'myth-section', icon: '🧿', title: t('神話基因'), chip: v.ban ? { t: '🚫 ' + t('已禁止'), tone: '' } : v.carriers.length ? { t: t('{n} 位神裔').replace('{n}', v.carriers.length), tone: '' } : null, sum: v.carriers.length || '', defOpen: false,
            kpis: [{ v: v.carriers.length, l: t('神裔') }, { v: v.st.edits || 0, l: t('編輯') }, { v: v.st.deaths || 0, l: t('死亡'), tone: v.st.deaths ? 'r' : '' }],
            body: tags, detail: this._icGrid([{ v: v.st.fails || 0, l: t('失敗') }, { v: v.st.attacks || 0, l: t('傷人') }, { v: v.st.bites || 0, l: t('吸血') }, { v: v.st.fires || 0, l: t('失火') }, { v: v.st.revived || 0, l: t('復活') }, { v: v.st.exiled || 0, l: t('驅逐') }, v.st.under ? { v: v.st.under, l: '🕳️ ' + t('地下診所') } : null]) + soc });
    },
    _icMoney() {
        const w = this.world; if (!w || typeof MONEY === 'undefined' || !w.observerMode || !w.money) return ''; const v = MONEY.view(w); if (v.days < 2) return '';
        const fmt = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n)).toLocaleString()}`;
        const rows = (L) => L.length ? this._icRows(L.map(([c, n]) => [t(v.label(c)), fmt(n), n >= 0 ? 'g' : 'r']), 'mf-row') : `<div class="ic-empty">${t('沒有')}</div>`;
        const detail = this._icSub('⬇️ ' + t('外地流入'), rows(v.ins)) + this._icSub('⬆️ ' + t('流出鎮外'), rows(v.outs)) + (Math.abs(v.other) >= 1 ? this._icRows([[t(v.label('other')), fmt(v.other), v.other >= 0 ? 'g' : 'r']]) : '');
        return this._ic({ id: 'money', cls: 'money-section', icon: '💱', title: t('錢從哪來、往哪去'), chip: { t: t('近 {n} 天').replace('{n}', v.days), tone: '' }, sum: fmt(v.net), sumTone: v.net >= 0 ? 'g' : 'r', defOpen: false,
            kpis: [{ v: fmt(v.net), l: t('淨變化'), tone: v.net >= 0 ? 'g' : 'r' }, { v: this._icNum(v.total), l: t('全鎮的錢') }, { v: v.per, l: v.perOld != null ? `${t('每人平均')}（${t('原本')} ${v.perOld}）` : t('每人平均') }], detail });
    },
    _icEnv() {
        const s = this.state; const wt = s?.weather; if (!wt) return ''; const esc = (x) => this._icEsc(x);
        const E = this._eventPieces(['festival', 'mods']); const farm = Math.round((wt.farmModifier || 0) * 100), mood = wt.moodModifier || 0;
        const dis = wt.activeDisaster, warn = wt.disasterWarning;
        const alert = dis ? { t: `${t(dis.name)}${t('（')}${t('剩餘')} ${dis.daysLeft} ${t('天')}${t('）')}`, tone: 'r' } : warn ? { t: `${t('災害預警')}${t('：')}${warn.type === 'drought_severe' ? t('嚴重乾旱') : warn.type === 'blizzard_severe' ? t('極端暴風雪') : t('洪水')}${warn.daysUntil > 0 ? ` (${warn.daysUntil} ${t('天後')})` : ''}`, tone: 'y' } : null;
        const fest = s.festivals?.activeFestival;
        const body = (wt.forecast?.length ? `<div class="ic-forecast"><span>${t('預報')}</span>${wt.forecast.map(f => `<span title="${esc(t(f.name))}">${f.icon}</span>`).join('')}</div>` : '') + E.festival;
        return this._ic({ id: 'env', icon: wt.icon || '🌤️', title: t('天氣與加成'), chip: alert ? { t: alert.tone === 'r' ? t('災害中') : t('預警'), tone: alert.tone } : fest ? { t: `${fest.icon} ${t(fest.name)}`, tone: 'g' } : null,
            sum: `${esc(t(wt.name))} · ${wt.temperature}°`, defOpen: false, alert,
            kpis: [{ v: wt.temperature, u: '°C', l: `${t(wt.name)}・💧${wt.humidity}%` }, { v: (farm >= 0 ? '+' : '') + farm, u: '%', l: '🌾 ' + t('農業'), tone: farm > 0 ? 'g' : farm < 0 ? 'r' : '' }, { v: (mood >= 0 ? '+' : '') + mood, l: '😊 ' + t('心情'), tone: mood > 0 ? 'g' : mood < 0 ? 'r' : '' }],
            body, detail: (wt.desc ? `<div class="ic-note">${esc(wt.desc)}</div>` : '') + E.mods });
    },
    _icAuto() {
        const alog = (this.state?.autonomy?.log || []).slice(-6).reverse(); const esc = (x) => this._icEsc(x);
        const li = (L) => L.map(e => `<div class="ic-log">${esc(e.text || '')}</div>`).join('');
        return this._ic({ id: 'auto', icon: '👐', title: t('村民自己做的事'), chip: null, sum: alog.length ? t('{n} 件').replace('{n}', alog.length) : '', defOpen: false,
            body: alog.length ? li(alog.slice(0, 3)) : `<div class="ic-empty">${t('今天還沒有紀錄，村民通常在換日時動手。')}</div>`, detail: alog.length > 3 ? li(alog.slice(3)) : '',
            info: esc(t('農夫種收、工坊出貨、商人談生意、缺什麼去補——都不用你操心。要蓋什麼、研究什麼、買賣大宗，看「提案」。')) });
    },
});

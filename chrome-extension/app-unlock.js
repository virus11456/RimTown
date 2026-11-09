// RimTown - app-unlock.js(v8.8.0 漸進解鎖)
// 一開始只看得到基本的分頁(概況、物資、村民、聊天、提案、日報、設定、事件卡手牌),
// 隨著小鎮的時間、時代與發生的事慢慢解鎖其他分頁;解鎖時角落跳一則「🔓 解鎖了新分頁」。
// 解鎖狀態存在 world.uiUnlock(跟著存檔、換鎮各自算);玩超過 30 天的舊存檔直接全部打開、不跳提示。
// 設定裡可以勾「一開始就顯示全部功能」(rimtown_ui_all,熟手用)。
// 用 Object.assign 掛到 RimTownApp.prototype;必須在 app.js 之後載入。
'use strict';
const doneN = (w) => Object.values(w.research?.projects || {}).filter(p => p.status === 'complete').length; // 已完成的研究數
const bizN = (w) => Object.values(w.market?.owners || {}).filter(Boolean).length + (w.biz?.shops || []).length; // 私人老闆＋店家數
const UI_UNLOCKS = [
    // key: 分頁代號;why: 解鎖時的說明;ok(w, d): 條件(d = 第幾天)
    { key: 'econ-build', icon: '🏗️', label: '建設', why: '鎮上開始蓋房子了：在這裡看誰在蓋什麼、還缺什麼材料。', ok: (w, d) => d >= 2 || (w.buildings?.projects || []).length > 0 },
    { key: 'econ-tech', icon: '🔬', label: '科技', why: '研究員開始研究了：在這裡看研究進度、走哪條科技路線。', ok: (w, d, U) => d >= 4 || doneN(w) > (U.__tb ?? Infinity) },
    { key: 'relmap', icon: '💞', label: '關係', why: '大家開始有交情和心結了：在這裡看誰跟誰要好、誰跟誰不合。', ok: (w, d) => d >= 6 },
    { key: 'pp-town', icon: '🏘️', label: '鎮況', why: '鎮上開始有急事和小團體：在提案頁的「鎮況」看大家在煩什麼。', ok: (w, d) => d >= 8 },
    { key: 'pp-truth', icon: '🕵️', label: '真相', why: '有人開始說謊、設局了：只有你看得到的「真相」打開了。', ok: (w, d) => d >= 15 || (d >= 6 && (w.dark?.secrets || []).some(s => s.found)) },
    { key: 'industry', icon: '🏭', label: '產業', why: '鎮上出現了老闆和店家：在這裡看產業、股東、店鋪和銀行。', ok: (w, d, U) => d >= 20 || (w.research?.currentEra?.() || 1) >= 2 || (d >= 8 && bizN(w) > (U.__bz ?? Infinity)) }, // 開局幾天就會有人合股買下公營產業,太早打開反而看不懂,至少等一週
    { key: 'gh-track', icon: '🔭', label: '反應追蹤', why: '你打出了第一張事件卡：在這裡看村民怎麼反應、七天後變成怎樣。', ok: (w) => (w.eventCards?.stats?.played || 0) >= 1 || (w.eventCards?.played || []).length > 0 },
    { key: 'gh-lab', icon: '🧪', label: '災厄工坊', why: '小鎮撐過一季了：你可以在災厄工坊親手設計一場災難。', ok: (w, d) => d >= 28 || !!w.calamity?.cur || (w.calamity?.hist || []).length > 0 || !!w.worldcal?.cur || (w.worldcal?.hist || []).length > 0 },
];
Object.assign(RimTownApp.prototype, {
    _uiAll() { try { return localStorage.getItem('rimtown_ui_all') === '1'; } catch (e) { return false; } },
    // 這個分頁現在看得到嗎(沒有列在 UI_UNLOCKS 的分頁一律看得到)
    _uiOn(key) {
        if (this.observerMode === false || this._uiAll()) return true;
        const def = UI_UNLOCKS.find(u => u.key === key); if (!def) return true;
        const U = this.world?.uiUnlock; return !!(U && U[key] != null);
    },
    // 每天檢查一次:新解鎖的跳提示
    _uiCheck() {
        const w = this.world; if (!w || this.observerMode === false) return; const d = (w._absDay?.() ?? 0);
        if (this._uiLastDay === d && w.uiUnlock) return; this._uiLastDay = d;
        const fresh = !w.uiUnlock; if (fresh) w.uiUnlock = { __tb: doneN(w), __bz: bizN(w) }; // 開局就有的研究和老闆不算
        const U = w.uiUnlock; const quiet = fresh && d >= 30; // 舊存檔:直接全部打開,不吵
        const news = [];
        for (const u of UI_UNLOCKS) { if (U[u.key] != null) continue; let ok = false; try { ok = quiet || !!u.ok(w, d, U); } catch (e) {} if (ok) { U[u.key] = d; if (!quiet && !this._uiAll()) news.push(u); } }
        for (const u of news.slice(0, 2)) { try { this._showCornerNotice?.({ icon: '🔓', title: t('解鎖了新分頁'), name: `${u.icon} ${t(u.label)}`, desc: t(u.why) }); } catch (e) {} }
    },
    // 給設定頁:還沒解鎖的有哪些、怎麼解鎖
    _uiPending() { const U = this.world?.uiUnlock || {}; return UI_UNLOCKS.filter(u => U[u.key] == null).map(u => ({ key: u.key, icon: u.icon, label: t(u.label) })); },
});
if (typeof World !== 'undefined') {
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.uiUnlock) d.uiUnlock = this.uiUnlock; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.uiUnlock = (data?.uiUnlock && typeof data.uiUnlock === 'object') ? data.uiUnlock : null; } catch (e) {} return r; };
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.uiUnlock = null; return r; };
}
if (typeof window !== 'undefined') window.UI_UNLOCKS = UI_UNLOCKS;

// v6.92.0 3D 人物依年齡與貧富換外觀
// - 年齡:小孩(12 歲以下)個子小、青少年(13～17)稍矮、老人(60 以上)頭髮花白、75 以上全白
// - 貧富依社會階層(CLASS 六階):底層穿褪色舊衣、打補丁;士紳布料鮮亮、白領、金扣;貴族披風、金項鍊;王族紅披風白毛邊;國王戴王冠
// - 睡廣場的無家可歸者衣服更破舊
// - 每個村民在 getState 多帶一個 appear(小物件),3D 只在它改變時才重建人物網格
const LOOK = (() => {
    const band = (age) => (age == null ? 'a' : age <= 12 ? 'c' : age <= 17 ? 't' : age >= 75 ? 'o' : age >= 60 ? 'e' : 'a');
    function of(w, a) {
        if (!a || a.isPlayer) return null;
        let cls = 1, king = false, homeless = false;
        try { if (typeof CLASS !== 'undefined' && w.classes) cls = CLASS.level(w, a); } catch (e) {}
        try { if (typeof CROWN !== 'undefined') { const k = CROWN.king(w); king = !!k && k.agentId === a.agentId; } } catch (e) {}
        try { if (typeof ESTATE !== 'undefined' && w.estate) homeless = a.homeLocation === ESTATE.HOMELESS_AT; } catch (e) {} // 被趕出來的人住處改成廣場(便宜判斷,不用每次重算一戶)
        const b = band(a.age);
        if (b === 'c' && cls > 3) cls = 3; // 小孩不穿披風,最多穿得體面
        return { b, cls: Math.max(0, Math.min(5, cls | 0)), king, hl: homeless };
    }
    const sig = (p) => (p ? p.b + p.cls + (p.king ? 'K' : '') + (p.hl ? 'H' : '') : '');
    return { band, of, sig };
})();

if (typeof World !== 'undefined') {
    const _gs = World.prototype.getState;
    World.prototype.getState = function (...args) {
        const st = _gs.apply(this, args);
        try { if (st && st.agents) for (const [id, d] of Object.entries(st.agents)) { const a = this.agents[id]; if (a && d) d.appear = LOOK.of(this, a); } } catch (e) {}
        return st;
    };
}

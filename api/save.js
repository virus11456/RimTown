const L = require('./_lib');

// v5.64.1 存檔保護:
// (1) 進度單調:雲端已有較新(tickCount 較大)的存檔時,不讓較舊的存檔蓋過去
//     (舊分頁/舊裝置晚一步存檔、開機備援 reset 出的 Day1 世界…都不再抹掉真實進度);
//     回 200 + stale:true 讓前端不當成錯誤。body.force=true 可強制覆寫(匯入存檔等玩家明確意圖)。
// (2) 前一版備份:覆寫前把原本的存檔留一份在 saves_prev/(讀取端找不到主檔時退回用)。
//     僅在 Postgres 後端啟用,Blob 模式不多花 put 額度。
function tickOf(saveData) {
    const m = /"tickCount"\s*:\s*(\d+)/.exec(String(saveData || '').slice(0, 4000)) || /"tickCount"\s*:\s*(\d+)/.exec(String(saveData || ''));
    return m ? parseInt(m[1], 10) : 0;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return L.err(res, 405, 'method_not_allowed', 'POST only');
    const payload = L.authUser(req);
    if (!payload) return L.err(res, 401, 'unauthorized', '請先登入');
    if (await L.isBanned(payload.u)) return L.err(res, 403, 'banned', '此帳號已被停用'); // v5.63.0
    const b = req.body || {};
    const townId = L.sanitizeTownId(b.town_id);
    if (!townId) return L.err(res, 400, 'missing_town_id', 'Missing town_id');
    const uname = payload.u.toLowerCase();
    const updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const meta = {
        town_id: townId,
        town_name: String(b.town_name || '').slice(0, 100),
        season: String(b.season || '').slice(0, 20),
        year: parseInt(b.year, 10) || 1,
        day: parseInt(b.day, 10) || 1,
        population: parseInt(b.population, 10) || 0,
        updated_at: updatedAt,
    };
    const mainPath = `saves/${uname}/${townId}.json`;
    const prevPath = `saves_prev/${uname}/${townId}.json`;
    const incoming = b.save_data || '';

    let existing = null;
    try { existing = await L.readJson(mainPath); } catch (e) { existing = null; }
    if (existing && !b.force) {
        const oldTick = tickOf(existing.save_data), newTick = tickOf(incoming);
        if (newTick < oldTick) {
            // 較舊的進度想蓋較新的:不覆寫主檔,只更新 meta 的時間戳以外的欄位也不動
            return res.status(200).json({ success: true, stale: true, cloud_tick: oldTick, incoming_tick: newTick });
        }
    }
    // 備份前一版(僅 Postgres,寫入不計額度)
    try {
        if (existing) {
            const info = await L.storageInfo();
            if (info.backend === 'postgres') await L.writeJson(prevPath, existing);
        }
    } catch (e) {}

    await L.writeJson(mainPath, { ...meta, save_data: incoming });
    await L.writeJson(`savemeta/${uname}/${townId}.json`, meta);
    return res.status(200).json({ success: true });
};

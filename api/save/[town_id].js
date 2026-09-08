const L = require('../_lib');

module.exports = async (req, res) => {
    const payload = L.authUser(req);
    if (!payload) return L.err(res, 401, 'unauthorized', '請先登入');
    const townId = L.sanitizeTownId(req.query.town_id);
    if (!townId) return L.err(res, 400, 'missing_town_id', 'Missing town_id');
    const uname = payload.u.toLowerCase();

    if (req.method === 'GET') {
        let save = await L.readJson(`saves/${uname}/${townId}.json`);
        // v5.64.1 主檔不見(誤刪/寫入中斷)→ 退回前一版備份,存檔不會憑空消失
        if (!save) { try { save = await L.readJson(`saves_prev/${uname}/${townId}.json`); } catch (e) { save = null; } }
        if (!save) return L.err(res, 404, 'not_found', 'Save not found');
        return res.status(200).json({ save_data: save.save_data });
    }
    if (req.method === 'DELETE') {
        await L.deleteBlob(`saves/${uname}/${townId}.json`);
        await L.deleteBlob(`savemeta/${uname}/${townId}.json`);
        try { await L.deleteBlob(`saves_prev/${uname}/${townId}.json`); } catch (e) {}
        return res.status(200).json({ success: true });
    }
    return L.err(res, 405, 'method_not_allowed', 'GET/DELETE only');
};

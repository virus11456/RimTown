const L = require('./_lib');

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
    await L.writeJson(`saves/${uname}/${townId}.json`, { ...meta, save_data: b.save_data || '' });
    await L.writeJson(`savemeta/${uname}/${townId}.json`, meta);
    return res.status(200).json({ success: true });
};

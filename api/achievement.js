const L = require('./_lib');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return L.err(res, 405, 'method_not_allowed', 'POST only');
    const payload = L.authUser(req);
    if (!payload) return L.err(res, 401, 'unauthorized', '請先登入');
    const key = String((req.body || {}).key || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
    if (!key) return L.err(res, 400, 'missing_key', 'Missing key');
    const uname = payload.u.toLowerCase();
    const path = `ach/${uname}.json`;
    const ach = (await L.readJson(path)) || {};
    if (!ach[key]) {
        ach[key] = {
            unlocked_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
            town_id: L.sanitizeTownId((req.body || {}).town_id) || '',
        };
        await L.writeJson(path, ach);
    }
    return res.status(200).json({ success: true });
};

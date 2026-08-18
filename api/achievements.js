// 成就:GET 清單 / POST 解鎖(v5.33.1 合併原 achievement.js — Hobby 方案 12 個 Functions 上限)
// vercel.json 以 rewrite 把 /api/achievement 導到這裡,前端合約不變
const L = require('./_lib');

module.exports = async (req, res) => {
    const payload = L.authUser(req);
    if (!payload) return L.err(res, 401, 'unauthorized', '請先登入');
    const uname = payload.u.toLowerCase();
    const path = `ach/${uname}.json`;

    if (req.method === 'GET') {
        const ach = await L.readJson(path);
        return res.status(200).json({ achievements: ach || {} });
    }

    if (req.method === 'POST') {
        const key = String((req.body || {}).key || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
        if (!key) return L.err(res, 400, 'missing_key', 'Missing key');
        const ach = (await L.readJson(path)) || {};
        if (!ach[key]) {
            ach[key] = {
                unlocked_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
                town_id: L.sanitizeTownId((req.body || {}).town_id) || '',
            };
            await L.writeJson(path, ach);
        }
        return res.status(200).json({ success: true });
    }

    return L.err(res, 405, 'method_not_allowed', 'GET/POST only');
};

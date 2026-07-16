// 全球繁榮排行榜:GET 取前 20 名;POST(需登入)提交自己的繁榮度
const L = require('./_lib');

module.exports = async (req, res) => {
    if (req.method === 'POST') {
        const payload = L.authUser(req);
        if (!payload) return L.err(res, 401, 'unauthorized', '請先登入');
        const b = req.body || {};
        const entry = {
            username: payload.u,
            town_name: String(b.town_name || '').slice(0, 40),
            prosperity: Math.max(0, Math.min(100000, parseInt(b.prosperity, 10) || 0)),
            level: String(b.level || '').slice(0, 20),
            population: Math.max(0, Math.min(9999, parseInt(b.population, 10) || 0)),
            updated_at: new Date().toISOString(),
        };
        await L.writeJson(`lb/${payload.u.toLowerCase()}.json`, entry);
        return res.status(200).json({ success: true });
    }
    // GET:彙整排行(小規模玩家數,逐檔讀取即可)
    const paths = (await L.listPaths('lb/')).slice(0, 200);
    const entries = [];
    for (const p of paths) {
        const e = await L.readJson(p);
        if (e && e.username) entries.push(e);
    }
    entries.sort((a, b) => (b.prosperity || 0) - (a.prosperity || 0));
    return res.status(200).json({ entries: entries.slice(0, 20) });
};

const L = require('./_lib');

module.exports = async (req, res) => {
    const payload = await L.requireSession(req, res); // v10.2.0
    if (!payload) return;
    const uname = payload.u.toLowerCase();
    const paths = await L.listPaths(`savemeta/${uname}/`);
    const saves = [];
    for (const p of paths) {
        const meta = await L.readJson(p);
        if (meta) saves.push(meta);
    }
    saves.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return res.status(200).json({ saves });
};

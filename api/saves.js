const L = require('./_lib');

module.exports = async (req, res) => {
    const payload = L.authUser(req);
    if (!payload) return L.err(res, 401, 'unauthorized', '請先登入');
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

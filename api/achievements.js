const L = require('./_lib');

module.exports = async (req, res) => {
    const payload = L.authUser(req);
    if (!payload) return L.err(res, 401, 'unauthorized', '請先登入');
    const ach = await L.readJson(`ach/${payload.u.toLowerCase()}.json`);
    return res.status(200).json({ achievements: ach || {} });
};

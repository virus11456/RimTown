const L = require('./_lib');

module.exports = async (req, res) => {
    const payload = L.authUser(req);
    if (payload) {
        // v5.63.0 帳號被管理員刪除/封鎖後,舊 token 立即失效
        if (await L.isBanned(payload.u)) return res.status(200).json({ logged_in: false, banned: true });
        return res.status(200).json({ logged_in: true, user: { id: payload.id, username: payload.u }, is_admin: L.isAdmin(payload) });
    }
    return res.status(200).json({ logged_in: false });
};

const L = require('./_lib');

module.exports = async (req, res) => {
    const payload = L.authUser(req);
    if (payload) return res.status(200).json({ logged_in: true, user: { id: payload.id, username: payload.u } });
    return res.status(200).json({ logged_in: false });
};

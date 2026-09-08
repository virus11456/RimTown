const L = require('./_lib');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return L.err(res, 405, 'method_not_allowed', 'POST only');
    const { username: rawU, password } = req.body || {};
    const username = L.sanitizeUsername(rawU);
    if (!username || !password) return L.err(res, 400, 'missing_fields', '請輸入帳號和密碼');
    if (!L.rateLimit('login_' + L.clientIp(req), 5, 300)) return L.err(res, 429, 'rate_limited', '登入嘗試過多，請稍後再試');

    const user = await L.readJson(L.userPath(username));
    if (!user || !L.verifyPassword(String(password), user.salt, user.passHash)) {
        return L.err(res, 401, 'login_failed', '帳號或密碼錯誤');
    }
    if (await L.isBanned(username)) return L.err(res, 403, 'banned', '此帳號已被管理員停用'); // v5.63.0
    return res.status(200).json({ success: true, nonce: L.makeToken(user), user: { id: user.id, username: user.username } });
};

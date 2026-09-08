const crypto = require('crypto');
const L = require('./_lib');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return L.err(res, 405, 'method_not_allowed', 'POST only');
    const { username: rawU, password, email } = req.body || {};
    const username = L.sanitizeUsername(rawU);
    if (!username || !password) return L.err(res, 400, 'missing_fields', '請填寫帳號和密碼');
    if (String(password).length < 6) return L.err(res, 400, 'weak_password', '密碼至少6個字元');
    if (!L.rateLimit('register_' + L.clientIp(req), 5, 300)) return L.err(res, 429, 'rate_limited', '註冊嘗試過多，請稍後再試');

    if (await L.readJson(L.userPath(username))) return L.err(res, 409, 'username_exists', '此帳號已被使用');
    if (await L.isBanned(username)) return L.err(res, 403, 'banned', '此帳號名稱無法使用'); // v5.63.0
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (cleanEmail) {
        if (await L.readJson(L.emailPath(cleanEmail))) return L.err(res, 409, 'email_exists', '此 Email 已被使用');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const user = {
        id: Date.now() % 2147483647,
        username,
        email: cleanEmail,
        salt,
        passHash: L.hashPassword(String(password), salt),
        createdAt: new Date().toISOString(),
    };
    await L.writeJson(L.userPath(username), user);
    if (cleanEmail) await L.writeJson(L.emailPath(cleanEmail), { username });

    return res.status(200).json({ success: true, nonce: L.makeToken(user), user: { id: user.id, username } });
};

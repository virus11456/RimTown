const crypto = require('crypto');
const L = require('./_lib');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return L.err(res, 405, 'method_not_allowed', 'POST only');
    const { username: rawU, email, new_password } = req.body || {};
    const username = L.sanitizeUsername(rawU);
    if (!username || !email || !new_password) return L.err(res, 400, 'missing_fields', '請填寫所有欄位');
    if (String(new_password).length < 6) return L.err(res, 400, 'weak_password', '新密碼至少6個字元');
    if (!L.rateLimit('reset_' + L.clientIp(req), 3, 600)) return L.err(res, 429, 'rate_limited', '重設嘗試過多，請稍後再試');

    const user = await L.readJson(L.userPath(username));
    if (!user || !user.email || user.email !== String(email).trim().toLowerCase()) {
        return L.err(res, 404, 'not_found', '帳號或 Email 不正確');
    }
    user.salt = crypto.randomBytes(16).toString('hex');
    user.passHash = L.hashPassword(String(new_password), user.salt);
    await L.writeJson(L.userPath(username), user);
    return res.status(200).json({ success: true });
};

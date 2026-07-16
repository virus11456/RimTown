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
    // 帳號或 Email 不符:一律回相同訊息(不洩漏帳號是否存在)
    const emailOk = user && user.email && user.email === String(email).trim().toLowerCase();

    // 每個帳號的重設冷卻(存 blob,跨 lambda 實例有效),失敗也記數避免暴力猜 Email
    const now = Date.now();
    const attemptPath = `resetlock/${username.toLowerCase()}.json`;
    const lock = (await L.readJson(attemptPath)) || { fails: 0, since: now, lastReset: 0 };
    if (now - lock.since > 3600000) { lock.fails = 0; lock.since = now; } // 每小時重置計數
    if (lock.fails >= 5) return L.err(res, 429, 'account_locked', '此帳號重設嘗試過多，請一小時後再試');

    if (!emailOk) {
        lock.fails += 1;
        await L.writeJson(attemptPath, lock).catch(() => {});
        return L.err(res, 404, 'not_found', '帳號或 Email 不正確');
    }

    user.salt = crypto.randomBytes(16).toString('hex');
    user.passHash = L.hashPassword(String(new_password), user.salt);
    user.lastPasswordReset = new Date().toISOString();
    await L.writeJson(L.userPath(username), user);
    await L.writeJson(attemptPath, { fails: 0, since: now, lastReset: now }).catch(() => {});
    return res.status(200).json({ success: true });
};

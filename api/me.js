const crypto = require('crypto');
const L = require('./_lib');

// v5.66.0 帳號自救:持有效 token 的玩家,若 users/<帳號>.json 已遺失(Blob 停權/搬遷缺漏),
// 可用 action=repair 設定新密碼重建帳號紀錄。存檔/成就/設定都以帳號名為 key,不受影響。
// token 由伺服器密鑰簽章、30 天有效;紀錄仍存在時一律拒絕(不能拿來改別人的密碼)。
module.exports = async (req, res) => {
    const payload = L.authUser(req);
    if (!payload) return res.status(200).json({ logged_in: false });
    // v5.63.0 帳號被管理員刪除/封鎖後,舊 token 立即失效
    if (await L.isBanned(payload.u)) return res.status(200).json({ logged_in: false, banned: true });

    if (req.method === 'POST' && req.body?.action === 'repair') {
        if (!L.rateLimit('repair_' + payload.u.toLowerCase(), 5, 600)) return L.err(res, 429, 'rate_limited', '操作太頻繁');
        const pw = String(req.body.new_password || '');
        if (pw.length < 6) return L.err(res, 400, 'weak_password', '新密碼至少6個字元');
        let existing = null;
        try { existing = await L.readJson(L.userPath(payload.u)); } catch (e) { existing = null; }
        if (existing) return L.err(res, 409, 'record_exists', '帳號紀錄仍在,不需要修復');
        const salt = crypto.randomBytes(16).toString('hex');
        const user = {
            id: payload.id || (Date.now() % 2147483647),
            username: payload.u,
            email: '',
            salt,
            passHash: L.hashPassword(pw, salt),
            createdAt: new Date().toISOString(),
            repairedAt: new Date().toISOString(),
        };
        await L.writeJson(L.userPath(payload.u), user);
        return res.status(200).json({ success: true, nonce: L.makeToken(user), user: { id: user.id, username: user.username } });
    }

    let recordMissing = false;
    try { recordMissing = !(await L.readJson(L.userPath(payload.u))); } catch (e) { recordMissing = false; } // 讀取失敗不誤判
    return res.status(200).json({ logged_in: true, user: { id: payload.id, username: payload.u }, is_admin: L.isAdmin(payload), record_missing: recordMissing });
};

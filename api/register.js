const crypto = require('crypto');
const L = require('./_lib');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return L.err(res, 405, 'method_not_allowed', 'POST only');
    const { username: rawU, password, email } = req.body || {};
    const username = L.sanitizeUsername(rawU);
    if (!username || !password) return L.err(res, 400, 'missing_fields', '請填寫帳號和密碼');
    if (String(password).length < 6) return L.err(res, 400, 'weak_password', '密碼至少6個字元');
    if (!L.rateLimit('register_' + L.clientIp(req), 5, 300)) return L.err(res, 429, 'rate_limited', '註冊嘗試過多，請稍後再試');

    // v5.68.0 推薦碼必填(INVITE_REQUIRED=0 可關閉):由管理員在遊戲內建立;有次數上限與停用
    const inviteRequired = String(process.env.INVITE_REQUIRED ?? '1') !== '0';
    const inviteCode = L.normalizeInvite(req.body?.invite);
    let invite = null;
    if (inviteRequired || inviteCode) {
        if (!inviteCode) return L.err(res, 400, 'invite_required', '請輸入推薦碼');
        if (inviteCode.length < 4) return L.err(res, 403, 'invite_invalid', '推薦碼無效');
        invite = await L.readJson(L.invitePath(inviteCode));
        if (!invite || invite.disabled) return L.err(res, 403, 'invite_invalid', '推薦碼無效或已停用');
        if (invite.maxUses > 0 && (invite.uses || 0) >= invite.maxUses) return L.err(res, 403, 'invite_exhausted', '這組推薦碼已經用完了');
    }
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
        invite: invite ? invite.code : '',
    };
    await L.writeJson(L.userPath(username), user);
    if (invite) {
        invite.uses = (invite.uses || 0) + 1;
        invite.usedBy = [...(invite.usedBy || []).slice(-199), { u: username, at: user.createdAt }];
        await L.writeJson(L.invitePath(invite.code), invite).catch(() => {});
    }
    if (cleanEmail) await L.writeJson(L.emailPath(cleanEmail), { username });

    return res.status(200).json({ success: true, nonce: L.makeToken(user), user: { id: user.id, username } });
};

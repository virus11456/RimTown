// v5.63.0 管理員端點:列出玩家、刪除帳號(連同所有雲端資料)、封鎖/解封
// 管理員身分由環境變數 ADMIN_USERS 決定(見 _lib.isAdmin)
const L = require('./_lib');

// 一個帳號在 Blob 裡的所有資料前綴
function userPrefixes(uname) {
    return [`saves/${uname}/`, `savemeta/${uname}/`];
}
function userSingles(uname) {
    return [L.userPath(uname), `ach/${uname}.json`, `settings/${uname}.json`, `lb/${uname}.json`];
}

module.exports = async (req, res) => {
    const payload = L.authUser(req);
    if (!payload) return L.err(res, 401, 'unauthorized', '請先登入');
    if (!L.isAdmin(payload)) return L.err(res, 403, 'forbidden', '沒有管理員權限');
    if (!L.rateLimit('admin_' + payload.u.toLowerCase(), 60, 60)) return L.err(res, 429, 'rate_limited', '操作太頻繁');

    const action = String((req.method === 'GET' ? req.query?.action : req.body?.action) || '');

    if (req.method === 'GET' && action === 'users') {
        const paths = (await L.listPaths('users/')).slice(0, 500);
        const banned = new Set((await L.listPaths('bans/')).map(p => p.slice('bans/'.length).replace(/\.json$/, '')));
        const users = [];
        for (const p of paths) {
            const u = await L.readJson(p);
            if (!u || !u.username) continue;
            const uname = u.username.toLowerCase();
            let saves = 0;
            try { saves = (await L.listPaths(`savemeta/${uname}/`)).length; } catch {}
            users.push({
                username: u.username,
                email: u.email ? u.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') : '',
                created_at: u.createdAt || '',
                saves,
                banned: banned.has(uname),
                is_admin: L.isAdmin({ u: u.username }),
            });
        }
        // 只在名單上、帳號已刪除的封鎖名字也列出來,方便解封
        for (const b of banned) {
            if (!users.some(x => x.username.toLowerCase() === b)) users.push({ username: b, email: '', created_at: '', saves: 0, banned: true, deleted: true });
        }
        users.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return res.status(200).json({ users });
    }

    if (req.method !== 'POST') return L.err(res, 405, 'method_not_allowed', 'POST only');
    const target = L.sanitizeUsername(req.body?.username);
    if (!target) return L.err(res, 400, 'missing_username', '缺少帳號');
    const tl = target.toLowerCase();
    if (tl === payload.u.toLowerCase()) return L.err(res, 400, 'self_target', '不能對自己操作');
    if (L.isAdmin({ u: target })) return L.err(res, 400, 'admin_target', '不能對其他管理員操作');

    if (action === 'ban') {
        await L.writeJson(L.banPath(tl), { username: target, by: payload.u, at: new Date().toISOString() });
        return res.status(200).json({ success: true });
    }
    if (action === 'unban') {
        await L.deleteBlob(L.banPath(tl));
        return res.status(200).json({ success: true });
    }
    if (action === 'delete') {
        const user = await L.readJson(L.userPath(tl));
        let removed = 0;
        for (const prefix of userPrefixes(tl)) {
            for (const p of await L.listPaths(prefix)) { await L.deleteBlob(p); removed++; }
        }
        for (const p of userSingles(tl)) { await L.deleteBlob(p); removed++; }
        if (user?.email) await L.deleteBlob(L.emailPath(user.email));
        // 刪除預設同時封鎖:名字不能再註冊,舊 token 也失效(各端點會查封鎖名單);傳 ban:false 可只刪不封
        if (req.body?.ban !== false) {
            await L.writeJson(L.banPath(tl), { username: target, by: payload.u, at: new Date().toISOString(), deleted: true });
        }
        return res.status(200).json({ success: true, removed });
    }
    return L.err(res, 400, 'bad_action', '未知操作');
};

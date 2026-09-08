// RimTown Serverless API 共用函式庫(Vercel Functions + Vercel Blob)
// 鏡像 wordpress/rimtown.php 的 REST 合約,前端 RimTownAuth 幾乎零改動即可切換
const crypto = require('crypto');
const { put, list, del } = require('@vercel/blob');

const JWT_SECRET = process.env.JWT_SECRET || '';
const TOKEN_TTL = 30 * 24 * 3600; // 30 天

// ---------- Blob JSON 存取(AES-256-GCM 加密,避免公開 URL 洩漏雜湊/信箱) ----------
function _key() { return crypto.createHash('sha256').update('rimtown-blob:' + JWT_SECRET).digest(); }

function _encrypt(plain) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', _key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return JSON.stringify({ __enc: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: enc.toString('base64') });
}

function _decrypt(raw) {
    const obj = JSON.parse(raw);
    if (!obj || obj.__enc !== 1) return obj; // 未加密的舊資料直接回傳
    const decipher = crypto.createDecipheriv('aes-256-gcm', _key(), Buffer.from(obj.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(obj.tag, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(obj.data, 'base64')), decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
}

// v5.63.2 Blob 額度止血:Hobby 方案每月只有 2K 次 advanced operations(list/put),
// 原本每次「讀」都先 list() 找 blob,讀一次就燒一次額度。改為直接打公開 URL
// (addRandomSuffix:false 時路徑固定,直接 GET 只算流量不算 operation);
// 公開網址的 base 從 put/list 的回傳學來並快取在 lambda 記憶體,cold start
// 先用 token 裡的 store id 猜,猜錯才退回 list 一次。
let _blobBase = process.env.BLOB_BASE_URL || '';
let _blobBaseGuessed = false;
if (!_blobBase) {
    const m = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(process.env.BLOB_READ_WRITE_TOKEN || '');
    if (m) { _blobBase = `https://${m[1].toLowerCase()}.public.blob.vercel-storage.com`; _blobBaseGuessed = true; }
}
function _learnBase(url, pathname) {
    if (!url) return;
    const i = url.indexOf('/' + pathname);
    if (i > 0) { _blobBase = url.slice(0, i); _blobBaseGuessed = false; }
}

async function findBlob(pathname) {
    const { blobs } = await list({ prefix: pathname, limit: 10 });
    const b = blobs.find(b => b.pathname === pathname) || null;
    if (b) _learnBase(b.url, pathname);
    return b;
}

async function readJson(pathname) {
    if (_blobBase) {
        const res = await fetch(`${_blobBase}/${pathname}?nc=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) return _decrypt(await res.text());
        // base 是學來的(可靠)→ 404 就是真的不存在;base 是猜的 → 退回 list 確認一次
        if (!_blobBaseGuessed) return null;
    }
    const b = await findBlob(pathname);
    if (!b) return null;
    const res = await fetch(`${b.url}?nc=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return _decrypt(await res.text());
}

async function writeJson(pathname, obj) {
    const r = await put(pathname, _encrypt(JSON.stringify(obj)), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json', cacheControlMaxAge: 60,
    });
    if (r?.url) _learnBase(r.url, pathname);
}

async function deleteBlob(pathname) {
    if (_blobBase && !_blobBaseGuessed) {
        try { await del(`${_blobBase}/${pathname}`); return; } catch (e) {}
    }
    const b = await findBlob(pathname);
    if (b) await del(b.url);
}

async function listPaths(prefix) {
    const out = [];
    let cursor;
    do {
        const r = await list({ prefix, limit: 100, cursor });
        out.push(...r.blobs.map(b => b.pathname));
        cursor = r.hasMore ? r.cursor : null;
    } while (cursor);
    return out;
}

// ---------- 密碼雜湊 ----------
function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, expectedHex) {
    const got = crypto.scryptSync(password, salt, 64);
    const exp = Buffer.from(expectedHex, 'hex');
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
}

// ---------- JWT(HMAC-SHA256) ----------
function b64url(buf) { return Buffer.from(buf).toString('base64url'); }

function makeToken(user) {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = b64url(JSON.stringify({ u: user.username, id: user.id, iat: now, exp: now + TOKEN_TTL }));
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
}

function verifyToken(token) {
    if (!token || !JWT_SECRET) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const expect = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
    const a = Buffer.from(parts[2]), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (!payload.u || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch { return null; }
}

// 從請求取出登入者(Authorization: Bearer 或 X-WP-Nonce 皆可)
function authUser(req) {
    const h = req.headers['authorization'] || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : (req.headers['x-wp-nonce'] || '');
    return verifyToken(token);
}

// ---------- 工具 ----------
function sanitizeUsername(u) {
    return String(u || '').trim().replace(/[^a-zA-Z0-9_\-一-鿿]/g, '').slice(0, 20);
}

function sanitizeTownId(t) {
    return /^[a-zA-Z0-9_-]+$/.test(String(t || '')) ? String(t) : '';
}

function userPath(username) { return `users/${username.toLowerCase()}.json`; }
function emailPath(email) { return `emails/${crypto.createHash('sha1').update(email.toLowerCase()).digest('hex')}.json`; }
function banPath(username) { return `bans/${username.toLowerCase()}.json`; }

// ---------- v5.63.0 管理員與封鎖 ----------
// 管理員名單來自環境變數 ADMIN_USERS(逗號分隔的帳號,不分大小寫)
function isAdmin(payload) {
    if (!payload || !payload.u) return false;
    const admins = String(process.env.ADMIN_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return admins.includes(String(payload.u).toLowerCase());
}

// 封鎖名單:bans/<帳號>.json 存在即為封鎖(帳號被刪除後名字也留在名單裡,不能再註冊)
// v5.63.2 lambda 記憶體快取 60 秒:每個請求都查一次太傷 Blob 額度
const _banCache = new Map();
async function isBanned(username) {
    if (!username) return false;
    const k = String(username).toLowerCase();
    const c = _banCache.get(k);
    if (c && Date.now() - c.at < 60000) return c.v;
    let v = false;
    try { v = !!(await readJson(banPath(k))); } catch { v = false; }
    _banCache.set(k, { v, at: Date.now() });
    return v;
}

function err(res, status, code, message) { return res.status(status).json({ code, message }); }

// 簡易速率限制(單一 lambda 實例內存,聊勝於無)
const _rl = new Map();
function rateLimit(key, max, windowSec) {
    const now = Date.now();
    let d = _rl.get(key);
    if (!d || now - d.start > windowSec * 1000) d = { count: 0, start: now };
    d.count++;
    _rl.set(key, d);
    return d.count <= max;
}

function clientIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

module.exports = {
    readJson, writeJson, deleteBlob, listPaths,
    hashPassword, verifyPassword, makeToken, verifyToken, authUser,
    sanitizeUsername, sanitizeTownId, userPath, emailPath, banPath,
    isAdmin, isBanned,
    err, rateLimit, clientIp,
};

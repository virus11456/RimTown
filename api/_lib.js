// RimTown Serverless API 共用函式庫(Vercel Functions + Neon Postgres)
// v5.82.0 移除 Vercel Blob 回退:Blob 已停權、資料早已搬進 Postgres,存取層只剩 rimtown_kv 一條路
// 鏡像 wordpress/rimtown.php 的 REST 合約,前端 RimTownAuth 幾乎零改動即可切換
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || '';
const TOKEN_TTL = 30 * 24 * 3600; // 30 天

// ---------- 值的相容解碼 ----------
// 早期 Blob 時代的值是 AES-256-GCM 加密後的 JSON({__enc:1,...}),搬進 Postgres 時原樣複製;
// 現在一律寫純 JSON,但讀取仍要認得舊格式,所以 _decrypt 保留。
function _key() { return crypto.createHash('sha256').update('rimtown-blob:' + JWT_SECRET).digest(); }

function _decrypt(raw) {
    const obj = JSON.parse(raw);
    if (!obj || obj.__enc !== 1) return obj; // 純 JSON 直接回傳
    const decipher = crypto.createDecipheriv('aes-256-gcm', _key(), Buffer.from(obj.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(obj.tag, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(obj.data, 'base64')), decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
}

// ---------- v5.64.0 Postgres(Neon)後端 ----------
// 表 rimtown_kv(path 主鍵、value 文字)。路徑規範(users/、saves/、savemeta/、ach/、settings/、
// lb/、bans/、invites/、saves_prev/)不變——這是存檔保護規範的第 1 條。
const PG_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

let _sql = null;
function pgClient() {
    if (!PG_URL) throw new Error('DATABASE_URL not set');
    if (!_sql) {
        const { neon } = require('@neondatabase/serverless');
        _sql = neon(PG_URL); // tagged-template 查詢函式
    }
    return _sql;
}

// 每個 lambda 實例只建一次表;結果 promise 快取,失敗時清掉快取讓下次重試
let _pgInit = null;
function pgInit() {
    if (!_pgInit) {
        _pgInit = pgClient()`CREATE TABLE IF NOT EXISTS rimtown_kv (path TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`
            .catch(e => { _pgInit = null; throw e; });
    }
    return _pgInit;
}

// 轉義 LIKE 萬用字元,避免帳號含 _ 造成前綴越界比對(search 時另帶 ESCAPE '\')
function _likePrefix(prefix) { return String(prefix).replace(/([\\%_])/g, '\\$1') + '%'; }

async function readJson(pathname) {
    await pgInit();
    const rows = await pgClient()`SELECT value FROM rimtown_kv WHERE path = ${pathname} LIMIT 1`;
    if (rows && rows.length) return _decrypt(rows[0].value);
    return null;
}

async function writeJson(pathname, obj) {
    await pgInit();
    const value = JSON.stringify(obj); // 存純 JSON 字串(_decrypt 相容)
    await pgClient()`INSERT INTO rimtown_kv (path, value) VALUES (${pathname}, ${value}) ON CONFLICT (path) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// 名字沿用 deleteBlob(各 API 呼叫點不變),實際是刪 Postgres 一列
async function deleteBlob(pathname) {
    await pgInit();
    await pgClient()`DELETE FROM rimtown_kv WHERE path = ${pathname}`;
}

async function listPaths(prefix) {
    await pgInit();
    const rows = await pgClient()`SELECT path FROM rimtown_kv WHERE path LIKE ${_likePrefix(prefix)} ESCAPE '\\'`;
    return (rows || []).map(r => r.path);
}

// 給管理端顯示目前的儲存後端狀態(只剩 Postgres;migrated 固定 true 讓舊前端不再顯示搬遷按鈕)
async function storageInfo() {
    return { backend: PG_URL ? 'postgres' : 'none', migrated: true };
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
// v5.68.0 推薦碼:invites/<CODE>.json(大寫英數與 -,4~24 字)
function normalizeInvite(code) { return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24); }
function invitePath(code) { return `invites/${normalizeInvite(code)}.json`; }

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
    readJson, writeJson, deleteBlob, listPaths, storageInfo,
    normalizeInvite, invitePath,
    hashPassword, verifyPassword, makeToken, verifyToken, authUser,
    sanitizeUsername, sanitizeTownId, userPath, emailPath, banPath,
    isAdmin, isBanned,
    err, rateLimit, clientIp,
};

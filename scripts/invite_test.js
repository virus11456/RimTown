// 推薦碼測試:註冊必填/無效/用完/成功計數;管理員建立/列出/停用/刪除
const path = require('path');
const libReal = require(path.join(__dirname, '..', 'api', '_lib.js'));
const store = {};
const lib = Object.assign({}, libReal, {
  authUser: () => ({ u: 'Admin', id: 1 }), isAdmin: () => true, isBanned: async () => false, rateLimit: () => true, clientIp: () => '1.1.1.1',
  readJson: async p => (p in store ? JSON.parse(JSON.stringify(store[p])) : null), writeJson: async (p, v) => { store[p] = v; }, deleteBlob: async p => { delete store[p]; },
  listPaths: async prefix => Object.keys(store).filter(k => k.startsWith(prefix)),
  err: (res, code, c, m) => { res.status(code); res.json({ code: c, message: m }); }, makeToken: u => 'tok_' + u.username,
});
const libPath = require.resolve(path.join(__dirname, '..', 'api', '_lib.js'));
require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: lib };
const register = require(path.join(__dirname, '..', 'api', 'register.js'));
const admin = require(path.join(__dirname, '..', 'api', 'admin.js'));
function mkRes() { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
async function reg(body) { const res = mkRes(); await register({ method: 'POST', headers: {}, body }, res); return res; }
async function adm(method, body, query) { const res = mkRes(); await admin({ method, headers: {}, body, query }, res); return res; }
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
(async () => {
  let r = await reg({ username: 'alice', password: 'secret123' });
  ok(r.code === 400 && r.body.code === 'invite_required', 'register without code → 400');
  r = await reg({ username: 'alice', password: 'secret123', invite: 'NOPE1234' });
  ok(r.code === 403 && r.body.code === 'invite_invalid', 'unknown code → 403');
  r = await adm('POST', { action: 'invite_create', max_uses: 2 });
  ok(r.code === 200 && /^[A-Z2-9]{8}$/.test(r.body.code), 'admin creates random 8-char code (' + (r.body && r.body.code) + ')');
  const code = r.body.code;
  r = await adm('POST', { action: 'invite_create', code: 'friends-2026', max_uses: 0 });
  ok(r.code === 200 && r.body.code === 'FRIENDS-2026', 'custom code normalized to uppercase');
  r = await adm('POST', { action: 'invite_create', code: 'friends-2026' });
  ok(r.code === 409, 'duplicate custom code → 409');
  r = await reg({ username: 'alice', password: 'secret123', invite: code.toLowerCase() });
  ok(r.code === 200 && r.body.nonce === 'tok_alice' && store['users/alice.json'].invite === code, 'register with valid code (case-insensitive) → ok, invite recorded');
  r = await reg({ username: 'bob', password: 'secret123', invite: code });
  ok(r.code === 200, 'second use ok');
  r = await reg({ username: 'carol', password: 'secret123', invite: code });
  ok(r.code === 403 && r.body.code === 'invite_exhausted', 'third use → exhausted');
  ok(store['invites/' + code + '.json'].uses === 2 && store['invites/' + code + '.json'].usedBy.length === 2, 'uses counted');
  r = await adm('GET', null, { action: 'invites' });
  ok(r.code === 200 && r.body.invites.length === 2, 'list invites');
  r = await adm('POST', { action: 'invite_toggle', code: 'FRIENDS-2026' });
  ok(r.code === 200 && r.body.disabled === true, 'toggle → disabled');
  r = await reg({ username: 'dave', password: 'secret123', invite: 'friends-2026' });
  ok(r.code === 403 && r.body.code === 'invite_invalid', 'disabled code rejected');
  r = await adm('POST', { action: 'invite_toggle', code: 'FRIENDS-2026' });
  r = await reg({ username: 'dave', password: 'secret123', invite: 'friends-2026' });
  ok(r.code === 200, 're-enabled unlimited code works');
  r = await adm('POST', { action: 'invite_delete', code: 'FRIENDS-2026' });
  ok(r.code === 200 && !store['invites/FRIENDS-2026.json'], 'delete code');
  process.env.INVITE_REQUIRED = '0';
  r = await reg({ username: 'erin', password: 'secret123' });
  ok(r.code === 200, 'INVITE_REQUIRED=0 → optional');
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

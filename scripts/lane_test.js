const path = require('path');
const libPath = path.join(__dirname, '..', 'api', '_lib.js');
const store = {};
const lib = {
  authUser: () => ({ u: 'Tester', id: 7 }), isBanned: async () => false, isAdmin: () => false,
  readJson: async p => (p in store ? store[p] : null), writeJson: async (p, v) => { store[p] = v; },
  err: (res, code, c, m) => { res.status(code); res.json({ code: c, message: m }); }, clientIp: () => '1.1.1.1', rateLimit: () => true,
  userPath: u => `users/${u.toLowerCase()}.json`, hashPassword: (p, s) => 'h_' + p + s, makeToken: u => 'tok_' + u.username,
};
require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: lib };
process.env.LLM_BASE_URL = 'https://relay.example'; process.env.LLM_API_KEY = 'k'; process.env.GROQ_API_KEY = 'gsk';
let groqMode = 'ok', relayMode = 'ok'; const calls = [];
global.fetch = async (url, opts) => {
  if (url.includes('groq.com') && url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'llama-3.3-70b-versatile' }] }) };
  if (url.includes('groq.com')) { calls.push('groq'); if (groqMode === 'ok') return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'G' } }] }) }; return { ok: false, status: groqMode === '429' ? 429 : 500 }; }
  if (url.includes('relay.example')) { calls.push('relay'); if (relayMode === 'ok') return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'R' }] }) }; return { ok: false, status: 500 }; }
  throw new Error('unexpected ' + url);
};
const chat = require(require('path').join(__dirname, '..', 'api', 'chat.js'));
const me = require(require('path').join(__dirname, '..', 'api', 'me.js'));
function mkRes() { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
async function ask(lane) { calls.length = 0; const res = mkRes(); await chat({ method: 'POST', headers: {}, body: { prompt: 'hi', lane } }, res); return res; }
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m, JSON.stringify(calls)); } };
(async () => {
  let r = await ask('chat'); ok(r.body.provider === 'groq' && calls[0] === 'groq' && r.body.reply === 'G', 'chat → groq first');
  r = await ask('background'); ok(r.body.provider === 'relay' && calls[0] === 'relay', 'background → relay first');
  r = await ask(undefined); ok(r.body.provider === 'relay', 'no lane → background');
  groqMode = '429'; r = await ask('chat'); ok(r.body.provider === 'relay' && calls.join() === 'groq,relay', 'chat: groq 429 → relay');
  groqMode = 'ok'; r = await ask('chat'); ok(r.body.provider === 'relay' && calls.join() === 'relay', 'chat: groq in 5-min cooldown → relay directly');
  relayMode = 'fail'; r = await ask('chat'); ok(r.body.provider === 'groq' && calls.join() === 'relay,groq', 'chat: relay fails → groq still last resort');
  r = await ask('background'); ok(r.body.provider === 'groq' && calls.join() === 'groq', 'background: relay in cooldown → groq directly');
  relayMode = 'ok'; groqMode = 'fail'; r = await ask('background'); ok(r.body.provider === 'relay' && calls.join() === 'groq,relay', 'background: groq fails, relay tried as last resort even in cooldown');
  r = await ask('background'); ok(r.body.provider === 'relay' && calls.join() === 'relay', 'relay recovered → cooldown cleared');
  groqMode = '429'; relayMode = 'fail'; r = await ask('chat'); ok(r.code === 502 || r.code === 429, 'both fail → error ' + r.code);
  groqMode = 'ok'; relayMode = 'ok';
  delete process.env.GROQ_API_KEY; r = await ask('chat'); ok(r.body.provider === 'relay' && calls.join() === 'relay', 'no groq key → relay only');
  process.env.GROQ_API_KEY = 'gsk';
  ok(r.body.remaining !== undefined && r.body.lane === 'chat', 'response carries lane');
  // ---- me.js ----
  let res = mkRes(); await me({ method: 'GET', headers: {} }, res); ok(res.body.logged_in && res.body.record_missing === true, 'GET record_missing when absent');
  res = mkRes(); await me({ method: 'POST', headers: {}, body: { action: 'repair', new_password: '123' } }, res); ok(res.code === 400, 'repair weak pw → 400');
  res = mkRes(); await me({ method: 'POST', headers: {}, body: { action: 'repair', new_password: 'abcdef' } }, res); ok(res.code === 200 && res.body.nonce === 'tok_Tester' && store['users/tester.json']?.username === 'Tester' && store['users/tester.json'].id === 7, 'repair creates record + token');
  res = mkRes(); await me({ method: 'POST', headers: {}, body: { action: 'repair', new_password: 'abcdef' } }, res); ok(res.code === 409, 'repair when record exists → 409');
  res = mkRes(); await me({ method: 'GET', headers: {} }, res); ok(res.body.record_missing === false, 'GET record present');
  res = mkRes(); await me({ method: 'POST', headers: {}, body: {} }, res); ok(res.code === 200 && res.body.logged_in === true, 'POST without action (logout rewrite) still ok');
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

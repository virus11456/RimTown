// v6.42.1 沒登入的人不能用 /api/chat(v7.7.1 起沒有訪客模式,AI_GUEST_DAILY 也開不了);回應絕不帶任何金鑰
const path = require('path');
const libPath = path.join(__dirname, '..', 'api', '_lib.js');
let user = null; const store = {};
require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: {
  authUser: () => user, isBanned: async () => false, isAdmin: () => false, readJson: async p => store[p] || null, writeJson: async (p, v) => { store[p] = v; },
  err: (res, code, c, m) => { res.status(code); res.json({ code: c, message: m }); }, clientIp: () => '1.2.3.4', rateLimit: () => true } };
process.env.LLM_BASE_URL = 'https://api.anthropic.com'; process.env.LLM_API_KEY = 'sk-ant-SECRET-relay'; process.env.GROQ_API_KEY = 'gsk_SECRET_groq'; process.env.OPENAI_API_KEY = 'sk-SECRET-openai';
delete process.env.AI_GUEST_DAILY;
global.fetch = async (url) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => (url.includes('anthropic') ? { content: [{ type: 'text', text: '你好' }] } : { choices: [{ message: { content: '你好' } }] }) });
const load = () => { delete require.cache[require.resolve(path.join(__dirname, '..', 'api', 'chat.js'))]; return require(path.join(__dirname, '..', 'api', 'chat.js')); };
function mkRes() { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log('FAIL ' + m, JSON.stringify(x)); } };
(async () => {
  let chat = load(); let res = mkRes(); await chat({ method: 'POST', headers: {}, body: { prompt: 'hi', lane: 'chat' } }, res);
  ok(res.code === 401 && res.body.code === 'login_required', 'guest blocked by default', res.body);
  user = { u: 'Tester', id: 1 }; res = mkRes(); await chat({ method: 'POST', headers: {}, body: { prompt: 'hi', lane: 'chat' } }, res);
  ok(res.code === 200 && res.body.reply === '你好', 'logged-in user works', res.body);
  ok(!/SECRET/.test(JSON.stringify(res.body)), 'response never contains a key', res.body);
  user = null; process.env.AI_GUEST_DAILY = '3'; chat = load(); res = mkRes(); await chat({ method: 'POST', headers: {}, body: { prompt: 'hi' } }, res);
  ok(res.code === 401, 'no guest AI even if AI_GUEST_DAILY is set (v7.7.1)', res.body);
  global.fetch = async () => ({ ok: false, status: 401, headers: { get: () => null }, json: async () => ({ error: { message: 'invalid x-api-key sk-ant-SECRET-relay' } }) });
  user = { u: 'Tester', id: 1 }; chat = load(); res = mkRes(); await chat({ method: 'POST', headers: {}, body: { prompt: 'hi', lane: 'background' } }, res);
  ok(res.code >= 400 && !/SECRET/.test(JSON.stringify(res.body)), 'upstream error text with key is not echoed', res.body);
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

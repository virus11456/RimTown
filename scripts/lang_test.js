// /api/chat 對話語言測試(v5.73.0):lang=en 改用英文系統指示、跳過簡轉繁、回應帶 lang;未帶/zh 維持中文
const path = require('path');
const libPath = path.join(__dirname, '..', 'api', '_lib.js');
require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: {
  authUser: () => null, isBanned: async () => false, isAdmin: () => false, readJson: async () => null, writeJson: async () => {},
  err: (res, code, c, m) => { res.status(code); res.json({ code: c, message: m }); }, clientIp: () => '1.1.1.1', rateLimit: () => true } };
process.env.LLM_BASE_URL = 'https://relay.example'; process.env.LLM_API_KEY = 'k'; process.env.GROQ_API_KEY = 'gsk';
let groqText = '你好，我是村民。', relayText = 'Hi there, neighbor.'; let relayBody = null, groqBody = null; const calls = [];
global.fetch = async (url, opts) => {
  if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'llama-3.3-70b-versatile' }] }) };
  if (url.includes('groq.com')) { calls.push('groq'); groqBody = JSON.parse(opts.body); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: groqText } }] }) }; }
  if (url.includes('relay.example')) { calls.push('relay'); relayBody = JSON.parse(opts.body); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: relayText }] }) }; }
};
const chat = require(path.join(__dirname, '..', 'api', 'chat.js'));
function mkRes() { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
async function ask(lane, lang) { calls.length = 0; const res = mkRes(); await chat({ method: 'POST', headers: {}, body: { prompt: '你正在扮演「王麗」…', lane, lang, max_tokens: 200 } }, res); return res; }
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
(async () => {
  let r = await ask('chat', 'en');
  ok(r.body.lang === 'en' && r.body.provider === 'groq', 'en chat → groq, response carries lang=en');
  ok(/natural English/.test(groqBody.messages[0].content) && !/繁體中文/.test(groqBody.messages[0].content), 'en: groq system prompt is English');
  r = await ask('background', 'en');
  ok(r.body.provider === 'relay' && relayBody.messages[0].content.startsWith('[System instructions] ') && /natural English/.test(relayBody.messages[0].content), 'en: relay inline prefix is English');
  r = await ask('chat', undefined);
  ok(r.body.lang === 'zh' && /繁體中文/.test(groqBody.messages[0].content) && !/natural English/.test(groqBody.messages[0].content), 'no lang → zh system prompt');
  r = await ask('background', 'zh');
  ok(relayBody.messages[0].content.startsWith('【系統指示】'), 'zh: relay inline prefix is Chinese');
  groqText = '这是简体字的回复';
  r = await ask('chat', 'en'); ok(r.body.reply === '这是简体字的回复', 'en: no simplified→traditional conversion');
  r = await ask('chat', 'zh'); ok(r.body.reply === '這是簡體字的回覆' || r.body.reply !== '这是简体字的回复', 'zh: simplified converted (or converter unavailable)');
  r = await ask('chat', 'fr'); ok(r.body.lang === 'zh', 'unknown lang → zh');
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

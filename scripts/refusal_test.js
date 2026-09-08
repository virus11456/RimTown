// /api/chat 拒絕偵測測試:中繼自報 AI 身分/拒絕扮演 → 視同失敗退回另一渠道;正常中文台詞不誤判
const path = require('path');
const libPath = path.join(__dirname, '..', 'api', '_lib.js');
require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: {
  authUser: () => null, isBanned: async () => false, isAdmin: () => false, readJson: async () => null, writeJson: async () => {},
  err: (res, code, c, m) => { res.status(code); res.json({ code: c, message: m }); }, clientIp: () => '1.1.1.1', rateLimit: () => true } };
process.env.LLM_BASE_URL = 'https://relay.example'; process.env.LLM_API_KEY = 'k'; process.env.GROQ_API_KEY = 'gsk';
let relayText = "I can't do this. I'm Kiro, an AI development environment designed to help with software engineering. I'm not designed for roleplay scenarios.";
let groqText = '（壓低聲音）千真萬確！吳達和楊鋒鬧翻了。'; let relayBody = null, groqBody = null; const calls = [];
global.fetch = async (url, opts) => {
  if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'llama-3.3-70b-versatile' }] }) };
  if (url.includes('groq.com')) { calls.push('groq'); groqBody = JSON.parse(opts.body); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: groqText } }] }) }; }
  if (url.includes('relay.example')) { calls.push('relay'); relayBody = JSON.parse(opts.body); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: relayText }] }) }; }
};
const chat = require(path.join(__dirname, '..', 'api', 'chat.js'));
function mkRes() { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
async function ask(lane) { calls.length = 0; const res = mkRes(); await chat({ method: 'POST', headers: {}, body: { prompt: '你正在扮演「黃莉」…', lane, max_tokens: 250 } }, res); return res; }
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m, JSON.stringify(calls)); } };
(async () => {
  let r = await ask('background');
  ok(r.body.provider === 'groq' && r.body.fallback_from[0].error === 'relay_refusal', 'Kiro refusal → groq');
  ok(relayBody.system === undefined && relayBody.messages[0].content.includes('RimTown') && relayBody.messages[0].content.includes('黃莉'), 'anthropic format: no system field, prompt prefixed inline');
  ok(groqBody.messages[0].role === 'system', 'groq carries system prompt');
  r = await ask('background'); ok(calls[0] === 'relay', 'refusal did not cool down relay');
  relayText = '唉，我不是故意要瞞你的…只是最近礦坑的事讓我很煩。';
  r = await ask('background'); ok(r.body.provider === 'relay' && r.body.reply === relayText, 'normal Chinese line passes');
  relayText = "Sorry, as an AI assistant I can't roleplay.";
  r = await ask('background'); ok(r.body.provider === 'groq', 'English AI-assistant refusal → groq');
  relayText = '抱歉，我是一個AI語言模型，無法扮演角色。';
  r = await ask('background'); ok(r.body.provider === 'groq', 'Chinese refusal → groq');
  groqText = "I'm an AI assistant and can't take on fictional character personas.";
  r = await ask('chat'); ok(r.code === 502, 'both refuse → 502');
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

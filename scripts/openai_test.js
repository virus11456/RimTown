// v6.40.2 官方 OpenAI 渠道測試:分流順序、新參數寫法、400 自動調整、模型不存在換下一個、冷卻、拒絕偵測
const path = require('path');
const libPath = path.join(__dirname, '..', 'api', '_lib.js');
const store = {};
const lib = {
  authUser: () => ({ u: 'Tester', id: 7 }), isBanned: async () => false, isAdmin: () => false,
  readJson: async p => (p in store ? store[p] : null), writeJson: async (p, v) => { store[p] = v; },
  err: (res, code, c, m) => { res.status(code); res.json({ code: c, message: m }); }, clientIp: () => '1.1.1.1', rateLimit: () => true,
};
require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: lib };
process.env.LLM_BASE_URL = 'https://api.anthropic.com'; process.env.LLM_API_KEY = 'k'; process.env.LLM_MODEL = 'claude-haiku-5-5';
process.env.GROQ_API_KEY = 'gsk'; process.env.OPENAI_API_KEY = 'sk-test';
let relayMode = 'ok', openaiMode = 'ok', groqMode = 'ok'; const calls = []; const bodies = [];
const resp = (status, obj, headers = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => obj, headers: { get: k => headers[k.toLowerCase()] } });
global.fetch = async (url, opts) => {
  if (url.includes('groq.com') && url.endsWith('/models')) return resp(200, { data: [{ id: 'llama-3.3-70b-versatile' }] });
  if (url.includes('groq.com')) { calls.push('groq'); return groqMode === 'ok' ? resp(200, { choices: [{ message: { content: 'G' } }] }) : resp(500, {}); }
  if (url.includes('api.anthropic.com')) { calls.push('relay'); return relayMode === 'ok' ? resp(200, { content: [{ type: 'text', text: 'C' }] }) : resp(500, {}); }
  if (url === 'https://api.openai.com/v1/chat/completions') {
    const b = JSON.parse(opts.body); bodies.push(b); calls.push('openai:' + b.model);
    if (openaiMode === 'ok') return resp(200, { choices: [{ message: { content: 'O' } }] });
    if (openaiMode === 'notemp' && b.temperature !== undefined) return resp(400, { error: { message: "Unsupported value: 'temperature' does not support 0.9 with this model.", param: 'temperature' } });
    if (openaiMode === 'notemp') return resp(200, { choices: [{ message: { content: 'O2' } }] });
    if (openaiMode === 'gone' && b.model === 'gpt-4.1-mini') return resp(404, { error: { code: 'model_not_found', message: 'The model `gpt-4.1-mini` does not exist' } });
    if (openaiMode === 'gone') return resp(200, { choices: [{ message: { content: 'O3' } }] });
    if (openaiMode === 'refuse') return resp(200, { choices: [{ message: { content: '我是 ChatGPT，一個由 OpenAI 開發的 AI 助理。' } }] });
    if (openaiMode === 'empty') return resp(200, { choices: [{ message: { content: '' }, finish_reason: 'length' }] });
    if (openaiMode === '429') return resp(429, { error: { message: 'rate' } }, { 'retry-after': '20' });
    return resp(500, {});
  }
  throw new Error('unexpected ' + url);
};
const chat = require(path.join(__dirname, '..', 'api', 'chat.js'));
function mkRes() { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
async function ask(lane) { calls.length = 0; bodies.length = 0; const res = mkRes(); await chat({ method: 'POST', headers: {}, body: { prompt: 'hi', lane, temperature: 0.9, max_tokens: 200 } }, res); return res; }
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m, JSON.stringify(calls)); } };
(async () => {
  let r = await ask('background'); ok(r.body.provider === 'relay' && calls.join() === 'relay', 'background → Claude first');
  r = await ask('chat'); ok(r.body.provider === 'groq' && calls.join() === 'groq', 'chat → Groq first');
  relayMode = 'fail';
  r = await ask('background'); ok(r.body.provider === 'openai' && calls.join() === 'relay,openai:gpt-4.1-mini' && r.body.reply === 'O' && r.body.model === 'gpt-4.1-mini', 'background: Claude fails → GPT');
  const b0 = bodies[0]; ok(b0 && b0.max_completion_tokens === 200 && b0.max_tokens === undefined && b0.temperature === 0.9 && b0.messages[0].role === 'system', 'gpt-4.1 body: max_completion_tokens + temperature + system');
  r = await ask('background'); ok(r.body.provider === 'openai' && calls.join() === 'openai:gpt-4.1-mini', 'background: Claude cooling → GPT directly');
  groqMode = 'fail'; r = await ask('chat'); ok(r.body.provider === 'openai' && calls.join() === 'groq,relay,openai:gpt-4.1-mini', 'chat: Groq + Claude fail → GPT');
  groqMode = 'ok';
  openaiMode = 'refuse'; r = await ask('background'); ok(r.body.provider === 'groq' && calls.join() === 'openai:gpt-4.1-mini,groq', 'GPT identity reply rejected → Groq');
  openaiMode = 'empty'; r = await ask('background'); ok(r.body.provider === 'groq', 'GPT empty → Groq');
  openaiMode = 'ok'; r = await ask('background'); ok(r.body.provider === 'openai', 'refusal/empty do not cool GPT down');
  openaiMode = 'gone'; r = await ask('background'); ok(r.body.provider === 'openai' && calls.join() === 'openai:gpt-4.1-mini,openai:gpt-5-mini' && r.body.reply === 'O3', 'default model missing → next model');
  const b5 = bodies[1]; ok(b5 && b5.temperature === undefined && b5.reasoning_effort === 'minimal' && b5.max_completion_tokens >= 800, 'gpt-5-mini body: no temperature, minimal reasoning, room for thinking');
  r = await ask('background'); ok(calls.join() === 'openai:gpt-5-mini' && r.body.model === 'gpt-5-mini', 'switched model remembered');
  openaiMode = '429'; r = await ask('background'); ok(r.body.provider === 'groq', 'GPT 429 → Groq');
  openaiMode = 'ok'; r = await ask('background'); ok(calls[0] !== 'openai:gpt-5-mini' || r.body.provider === 'groq', 'GPT cooling after 429');
  ok(store[`usage/${new Date().toISOString().slice(0, 10)}.json`].openai > 0, 'usage counts openai');
  // OpenAI-format relay pointed at the official API(LLM_FORMAT=openai + LLM_BASE_URL=https://api.openai.com)
  delete require.cache[require.resolve(path.join(__dirname, '..', 'api', 'chat.js'))];
  process.env.LLM_BASE_URL = 'https://api.openai.com/v1'; process.env.LLM_FORMAT = 'openai'; process.env.LLM_MODEL = 'gpt-5.1';
  delete process.env.OPENAI_API_KEY;
  const chat2 = require(path.join(__dirname, '..', 'api', 'chat.js'));
  const ask2 = async () => { calls.length = 0; bodies.length = 0; const res = mkRes(); await chat2({ method: 'POST', headers: {}, body: { prompt: 'hi', lane: 'background', temperature: 0.9, max_tokens: 200 } }, res); return res; };
  openaiMode = 'ok'; r = await ask2(); ok(r.body.provider === 'relay' && r.body.reply === 'O' && bodies[0].reasoning_effort === 'none' && bodies[0].temperature === undefined, 'LLM_FORMAT=openai official: gpt-5.1 uses reasoning none, no temperature');
  process.env.LLM_MODEL = 'gpt-4o';
  delete require.cache[require.resolve(path.join(__dirname, '..', 'api', 'chat.js'))];
  const chat3 = require(path.join(__dirname, '..', 'api', 'chat.js'));
  openaiMode = 'notemp'; calls.length = 0; bodies.length = 0; let res3 = mkRes(); await chat3({ method: 'POST', headers: {}, body: { prompt: 'hi', lane: 'background', temperature: 0.9, max_tokens: 200 } }, res3);
  ok(res3.body.reply === 'O2' && bodies.length === 2 && bodies[0].temperature === 0.9 && bodies[1].temperature === undefined, '400 on temperature → resend without it');
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

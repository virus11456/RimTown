// v6.55.0 伺服器:壓縮存檔('gz:')用一起送來的 tick_count 判斷新舊,舊格式照常;不讓舊進度蓋掉新進度
const path = require('path');
const zlib = require('zlib');
const libReal = require(path.join(__dirname, '..', 'api', '_lib.js'));
const store = {};
const lib = Object.assign({}, libReal, {
  authUser: () => ({ u: 'Tester', id: 1 }), isBanned: async () => false,
  readJson: async p => (p in store ? JSON.parse(JSON.stringify(store[p])) : null), writeJson: async (p, v) => { store[p] = v; },
  storageInfo: async () => ({ backend: 'postgres' }),
  err: (res, code, c, m) => { res.status(code); res.json({ code: c, message: m }); },
});
const libPath = require.resolve(path.join(__dirname, '..', 'api', '_lib.js'));
require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: lib };
const save = require(path.join(__dirname, '..', 'api', 'save.js'));
function mkRes() { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
async function post(body) { const res = mkRes(); await save({ method: 'POST', headers: {}, body }, res); return res; }
const gz = (s) => 'gz:' + zlib.gzipSync(Buffer.from(s)).toString('base64');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const key = 'saves/tester/town_a.json';
  // 舊格式(沒壓縮、沒 tick_count)
  let r = await post({ town_id: 'town_a', save_data: JSON.stringify({ tickCount: 500, agents: {} }) });
  ok(r.code === 200 && store[key] && !store[key].tick_count, '舊格式存檔照常寫入', r.body);
  // 壓縮＋tick_count,比較新 → 寫入,並記住 tick_count
  const big = JSON.stringify({ tickCount: 900, agents: { a: 'x'.repeat(1000) } });
  r = await post({ town_id: 'town_a', save_data: gz(big), tick_count: 900 });
  ok(r.code === 200 && !r.body.stale && store[key].save_data.startsWith('gz:') && store[key].tick_count === 900, '壓縮存檔寫入，記住 tick_count', r.body);
  ok(zlib.gunzipSync(Buffer.from(store[key].save_data.slice(3), 'base64')).toString() === big, '存進去的壓縮內容解得回原文');
  ok(store['saves_prev/tester/town_a.json'] && !store['saves_prev/tester/town_a.json'].save_data.startsWith('gz:'), '前一版（舊格式）留了備份');
  // 較舊的進度想蓋掉壓縮的新存檔 → 擋下
  r = await post({ town_id: 'town_a', save_data: JSON.stringify({ tickCount: 700 }) });
  ok(r.body.stale === true && r.body.cloud_tick === 900, '舊進度（未壓縮）不能蓋過較新的壓縮存檔', r.body);
  r = await post({ town_id: 'town_a', save_data: gz(JSON.stringify({ tickCount: 800 })), tick_count: 800 });
  ok(r.body.stale === true, '舊進度（壓縮）也不能蓋過較新的存檔', r.body);
  // 更新的壓縮存檔 → 寫入
  r = await post({ town_id: 'town_a', save_data: gz(JSON.stringify({ tickCount: 1200 })), tick_count: 1200 });
  ok(!r.body.stale && store[key].tick_count === 1200, '更新的進度可以寫入', r.body);
  // force 照常可以覆寫
  r = await post({ town_id: 'town_a', save_data: JSON.stringify({ tickCount: 10 }), force: true });
  ok(!r.body.stale && JSON.parse(store[key].save_data).tickCount === 10, '匯入（force）仍可覆寫', r.body);
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

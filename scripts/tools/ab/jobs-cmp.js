// v11.13.0「工作與求職」改前改後對照：每一項的平均±標準誤，以及差幾個合併標準誤（|差| 超過 2 的要說得出原因）
// 用法：node scripts/tools/ab/jobs-cmp.js base.jsonl new.jsonl
const fs = require('fs'); const rd = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const [A, B] = [rd(process.argv[2]), rd(process.argv[3])];
const JOBK = ['farmer', 'cook', 'tailor', 'carpenter', 'miner', 'blacksmith', 'trader', 'guard', 'doctor', 'researcher', 'priest', 'none'];
const keys = ['pop', 'adults', 'unemp', 'unempAvg', 'overAvg', 'lowAvg', 'hired', 'laidOff', 'switched', 'grads', 'strikes', 'wildcat', 'concede', 'refuse', 'sacked', 'ustrikes', 'union', 'clergy', 'clIn', 'clOut', 'left', 'starved', 'mood', 'treasury', 'priv', 'other'];
const ms = (xs) => { const n = xs.length, m = xs.reduce((s, x) => s + x, 0) / n; const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1)); return [m, sd / Math.sqrt(n)]; };
const row = (k, fa, fb) => { const [ma, sa] = ms(A.map(fa)), [mb, sb] = ms(B.map(fb || fa)); const se = Math.sqrt(sa * sa + sb * sb); const z = se ? (mb - ma) / se : (mb === ma ? 0 : Infinity); console.log(`${k}\t${ma.toFixed(2)}±${sa.toFixed(2)}\t${mb.toFixed(2)}±${sb.toFixed(2)}\t${Number.isFinite(z) ? z.toFixed(2) : '-'}\t${Math.abs(z) > 2 ? '超過 2' : '以內'}`); };
console.log('項目\t改前(n=' + A.length + ')\t改後(n=' + B.length + ')\t差/合併標準誤\t');
for (const k of keys) row(k, x => x[k] || 0);
for (const j of JOBK) row('人數:' + j, x => (x.jobs || {})[j] || 0);
const sum = (k) => B.reduce((s, x) => s + ((x.dec || {})[k] || 0), 0); const pk = {}; for (const x of B) for (const [k, v] of Object.entries(x.pick || {})) pk[k] = (pk[k] || 0) + v;
console.log('改後八座鎮合計：問了', JSON.stringify(Object.fromEntries(['seek', 'switchAsk', 'cutAsk', 'walkAsk', 'endAsk', 'ordAsk'].map(k => [k, sum(k)]))), '選了', JSON.stringify(pk));
console.log('errs', A.concat(B).filter(x => (x.errs || []).length || (x.pageErrs || []).length).map(x => x.seed + ':' + JSON.stringify((x.errs || []).concat(x.pageErrs || [])).slice(0, 200)));

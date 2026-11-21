// v11.14.0「房子」改前改後對照：每一項的平均±標準誤，差超過 2 個合併標準誤的標出來
// 用法：node scripts/tools/ab/house-cmp.js base.jsonl new.jsonl
const fs = require('fs'); const rd = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const [A, B] = [rd(process.argv[2]), rd(process.argv[3])]; const seeds = A.map(r => r.seed).filter(s => B.some(r => r.seed === s)); const a = A.filter(r => seeds.includes(r.seed)), b = B.filter(r => seeds.includes(r.seed));
const ms = (xs) => { const n = xs.length; const m = xs.reduce((s, x) => s + x, 0) / n; const v = n > 1 ? xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1) : 0; return { m, se: Math.sqrt(v / n) }; };
const keys = (process.argv[4] || 'pop,hh,units,priv,pub,vacant,lodAvg,hlAvg,hlPeak,homeless,built,pubBuilt,sold,evicted,foreclosed,owners,landlords,topOwner,svAvg,servants,rent,rentSum,ptax,bankLoans,treasury,privSilver,other,bad').split(',');
console.log(`n=${a.length} vs ${b.length} (seeds ${seeds.join(',')})`); console.log('項目'.padEnd(12), '改前 平均±標準誤'.padEnd(22), '改後 平均±標準誤'.padEnd(22), '差／合併標準誤');
for (const k of keys) { const x = ms(a.map(r => +r[k] || 0)), y = ms(b.map(r => +r[k] || 0)); const se = Math.sqrt(x.se ** 2 + y.se ** 2); const z = se > 0 ? (y.m - x.m) / se : (y.m === x.m ? 0 : Infinity);
  console.log(k.padEnd(12), `${x.m.toFixed(2)} ± ${x.se.toFixed(2)}`.padEnd(22), `${y.m.toFixed(2)} ± ${y.se.toFixed(2)}`.padEnd(22), `${z.toFixed(2)}${Math.abs(z) > 2 ? '  ← 超過 2' : ''}`); }
const errs = (R) => R.reduce((s, r) => s + (r.errs?.length || 0) + (r.pageErrs?.length || 0), 0); console.log('errors', errs(a), errs(b));
const pk = {}; for (const r of b) for (const [k, v] of Object.entries(r.pick || {})) pk[k] = (pk[k] || 0) + v; console.log('new picks', JSON.stringify(pk));

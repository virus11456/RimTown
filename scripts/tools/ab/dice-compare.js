// 移除前後對照：每種城鎮 4 次，每項平均 ± 標準誤，差距 / 合併標準誤
const fs = require('fs'); const dir = __dirname;
const load = (pre, T) => fs.readdirSync(dir).filter(f => f.startsWith(`${pre}_T${T}`) && f.endsWith('.json')).flatMap(f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));
const K = ['pop', 'births', 'married', 'breakup', 'feud', 'thefts', 'caught', 'factions', 'treasury', 'priv', 'other'];
const ms = (xs) => { const n = xs.length; const m = xs.reduce((s, x) => s + x, 0) / n; const sd = n > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0; return { n, m, se: sd / Math.sqrt(n) }; };
const f1 = (x) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));
let bad = 0;
for (const T of [0, 1, 2, 3]) {
  const A = load('base', T), B = load('after', T); console.log(`\n== ${['村', '鎮', '城', '王都'][T]}（移除前 n=${A.length}，移除後 n=${B.length}）`);
  for (const k of K) { const a = ms(A.map(x => x.st[k])), b = ms(B.map(x => x.st[k])); const se = Math.sqrt(a.se ** 2 + b.se ** 2); const z = se > 0 ? Math.abs(a.m - b.m) / se : (a.m === b.m ? 0 : Infinity);
    const flag = (k === 'other' ? (A.some(x => x.st.other) || B.some(x => x.st.other)) : z > 2) ? ' ✗' : ''; if (flag) bad++;
    console.log(`${k.padEnd(9)} 前 ${f1(a.m)}±${f1(a.se)}  後 ${f1(b.m)}±${f1(b.se)}  差/標準誤 ${z === Infinity ? '∞' : z.toFixed(2)}${flag}`); }
  const err = [...A, ...B].map(x => x.errs?.page || 0).reduce((s, x) => s + x, 0); console.log(`pageerror 合計 ${err}`);
}
console.log(`\n超過 2 個標準誤或帳上對不上：${bad} 項`);

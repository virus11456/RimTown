const fs = require('fs'); const rd = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const [A, B] = [rd(process.argv[2]), rd(process.argv[3])];
const keys = ['thefts', 'caught', 'jails', 'bribes', 'cbuy', 'mbuy', 'lobby', 'papers', 'pop', 'treasury', 'priv', 'other'];
const ms = (xs) => { const n = xs.length, m = xs.reduce((s, x) => s + x, 0) / n; const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1)); return [m, sd / Math.sqrt(n)]; };
console.log('項目\t改前(n=' + A.length + ')\t改後(n=' + B.length + ')\t差/合併標準誤');
for (const k of keys) { const [ma, sa] = ms(A.map(x => x[k])), [mb, sb] = ms(B.map(x => x[k])); const se = Math.sqrt(sa * sa + sb * sb); console.log(`${k}\t${ma.toFixed(1)}±${sa.toFixed(1)}\t${mb.toFixed(1)}±${sb.toFixed(1)}\t${se ? ((mb - ma) / se).toFixed(2) : '-'}`); }
const tempt = B.map(x => x.ost?.tempt || 0), steal = B.map(x => x.ost?.steal || 0); console.log('tempt', tempt.join(','), 'steal', steal.join(','));
console.log('errs', A.concat(B).filter(x => x.errs.length || x.pageErrs.length).map(x => x.seed + ':' + JSON.stringify(x.errs.concat(x.pageErrs)).slice(0, 200)));

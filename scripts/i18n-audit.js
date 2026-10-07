#!/usr/bin/env node
// v5.81.0 i18n 稽核:(1) i18n.js 不得有重複 key(JS 物件後者蓋前者,重複等於悄悄改譯文);
// (2) 前端 t('…') 的中文字串都要有英文對照——歷史欠帳記在 scripts/i18n_missing_baseline.json,
//     新增的字串沒英文就失敗;補齊舊欠帳後用 --update 縮小基準。
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const i18n = fs.readFileSync(path.join(ROOT, 'chrome-extension/i18n.js'), 'utf8');
const unesc = (k) => k.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
const keyRe = /'((?:[^'\\]|\\.)+)':\s*'/g;
const counts = {};
for (const line of i18n.split('\n')) {
  if (!/^\s+'/.test(line) && !/^\s+'[^']*':/.test(line)) continue;
  let m; keyRe.lastIndex = 0;
  while ((m = keyRe.exec(line))) counts[unesc(m[1])] = (counts[unesc(m[1])] || 0) + 1;
}
const dups = Object.entries(counts).filter(([, n]) => n > 1).map(([k]) => k);
const keys = new Set(Object.keys(counts));
const files = fs.readdirSync(path.join(ROOT, 'chrome-extension')).filter(f => f.endsWith('.js') && !['i18n.js', 'changelog.js', 's2t.js', 'sw.js', 'chiptune.js'].includes(f));
const missing = new Set();
for (const f of files) {
  const s = fs.readFileSync(path.join(ROOT, 'chrome-extension', f), 'utf8');
  for (const m of s.matchAll(/\bt\('((?:[^'\\]|\\.)+)'\)/g)) { const k = unesc(m[1]); if (/[一-鿿]/.test(k) && !keys.has(k)) missing.add(k); }
}
const basePath = path.join(__dirname, 'i18n_missing_baseline.json');
const baseline = new Set(fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, 'utf8')) : []);
const fresh = [...missing].filter(k => !baseline.has(k));
if (process.argv.includes('--update')) { fs.writeFileSync(basePath, JSON.stringify([...missing].sort(), null, 1)); console.log(`baseline updated: ${missing.size} missing strings`); }
console.log(`i18n keys: ${keys.size}, duplicate keys: ${dups.length}, t() strings without English: ${missing.size} (baseline ${baseline.size}, new ${fresh.length})`);
if (dups.length) console.log('duplicates:', dups.slice(0, 10).map(k => JSON.stringify(k)).join(', '));
if (fresh.length) console.log('new strings without English:\n' + fresh.slice(0, 20).map(k => '  ' + k).join('\n'));
process.exit(dups.length || fresh.length ? 1 : 0);

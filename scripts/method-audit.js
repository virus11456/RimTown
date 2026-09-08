#!/usr/bin/env node
// 發版前稽核:前端三大檔案裡每個 this._xxx( 直接呼叫,都必須有對應的方法定義或 this._xxx = ... 指派。
// 起因:v5.64.1 移除 _dedupeCloudSaves 時把相鄰的 _newerSave 一起刪掉,開機/切鎮/馬車過場全炸(v5.66.6 回填)。
// 用法:node scripts/method-audit.js  (回傳非 0 = 有缺)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'chrome-extension');
const files = ['app.js', 'simulation.js', 'tilemap.js'].map(f => path.join(dir, f));
const src = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const defined = new Set();
for (const m of src.matchAll(/^\s+(?:async\s+)?(?:static\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) defined.add(m[1]);
for (const m of src.matchAll(/\bthis\.([A-Za-z_$][\w$]*)\s*=\s*(?!=)/g)) defined.add(m[1]); // this.x = ...(任何指派)
for (const m of src.matchAll(/prototype\.([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
const missing = new Map();
for (const m of src.matchAll(/\bthis\.(_[A-Za-z][\w$]*)\s*\(/g)) { if (!defined.has(m[1])) missing.set(m[1], (missing.get(m[1]) || 0) + 1); }
if (missing.size) {
    console.error('缺少方法定義:', [...missing].map(([k, v]) => `${k}(${v} 處呼叫)`).join(', '));
    process.exit(1);
}
console.log('method audit OK');

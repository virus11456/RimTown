#!/usr/bin/env node
// 首頁「更新紀錄」的資料:單一來源 = chrome-extension/changelog.js(v6.50.0 起;以前是 wordpress/rimtown.php,WordPress 版已停用)
//   node scripts/gen-changelog.js                 檢查並重寫 chrome-extension/changelog.js
//   node scripts/gen-changelog.js --add entry.json 把新版本加到最前面(entry.json = {version, date, changes:[…], changes_en:[…]})
// 每個版本都要有 changes 與 changes_en(英文更新紀錄),缺一或條數不同就失敗(v5.74.0 起)
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const SRC = path.join(root, 'chrome-extension', 'changelog.js');
const load = () => {
    const src = fs.readFileSync(SRC, 'utf8');
    const i = src.indexOf('window.RIMTOWN_CHANGELOG = ');
    if (i < 0) throw new Error('changelog.js: 找不到 window.RIMTOWN_CHANGELOG');
    const body = src.slice(i + 'window.RIMTOWN_CHANGELOG = '.length).trim().replace(/;\s*$/, '');
    return JSON.parse(body);
};
const entries = load();
const ai = process.argv.indexOf('--add');
if (ai > 0) {
    const e = JSON.parse(fs.readFileSync(process.argv[ai + 1], 'utf8'));
    if (!e.version || !e.date) { console.error('--add: 需要 version 與 date'); process.exit(1); }
    if (entries.some(x => x.version === e.version)) { console.error(`--add: ${e.version} 已經在更新紀錄裡`); process.exit(1); }
    entries.unshift({ version: e.version, date: e.date, changes: e.changes || [], changes_en: e.changes_en || [] });
}
if (!entries.length) { console.error('no changelog entries'); process.exit(1); }
const problems = [];
const seen = new Set();
for (const e of entries) {
    if (seen.has(e.version)) problems.push(`${e.version}: 版本重複`); seen.add(e.version);
    if (!Array.isArray(e.changes) || !e.changes.length) problems.push(`${e.version}: 缺 changes`);
    if (!Array.isArray(e.changes_en) || !e.changes_en.length) problems.push(`${e.version}: 缺 changes_en`);
    else if (e.changes_en.length !== (e.changes || []).length) problems.push(`${e.version}: changes ${e.changes.length} 條 / changes_en ${e.changes_en.length} 條`);
}
if (problems.length) { console.error('changelog 英文對照不完整:\n  ' + problems.join('\n  ')); process.exit(1); }
// 一個版本一行,git diff 只會多一行
const out = '// 首頁更新紀錄(單一來源;新版本用 node scripts/gen-changelog.js --add entry.json 加入)\n' +
    'window.RIMTOWN_CHANGELOG = [\n' + entries.map(e => JSON.stringify({ version: e.version, date: e.date, changes: e.changes, changes_en: e.changes_en })).join(',\n') + '\n];\n';
fs.writeFileSync(path.join(root, 'chrome-extension/changelog.js'), out);
console.log('changelog.js:', entries.length, 'versions, latest', entries[0].version);

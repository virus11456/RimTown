#!/usr/bin/env node
// 從 wordpress/rimtown.php 的 rimtown_get_changelog() 產生 chrome-extension/changelog.js 與 wordpress/changelog.js
// (首頁「更新紀錄」的資料來源;單一來源 = rimtown.php,每次發版跑一次)
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const php = fs.readFileSync(path.join(root, 'wordpress', 'rimtown.php'), 'utf8');
const start = php.indexOf('function rimtown_get_changelog()');
const body = php.slice(start, php.indexOf('\n}', start));
const entries = [];
// v5.74.0 每個版本都要有 'changes' 與 'changes_en'(英文更新紀錄),缺一或條數不同就失敗
const re = /'version'\s*=>\s*'([^']*)',\s*'date'\s*=>\s*'([^']*)',\s*'changes'\s*=>\s*array\(([\s\S]*?)\n\s*\),(?:\s*'changes_en'\s*=>\s*array\(([\s\S]*?)\n\s*\),)?\s*\)/g;
let m;
const parseList = (src) => { const out = []; const rs = /'((?:[^'\\]|\\.)*)'/g; let c; while ((c = rs.exec(src || ''))) out.push(c[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\')); return out; };
const problems = [];
while ((m = re.exec(body))) {
    const changes = parseList(m[3]);
    const changes_en = parseList(m[4]);
    if (!changes_en.length) problems.push(`${m[1]}: 缺 changes_en`);
    else if (changes_en.length !== changes.length) problems.push(`${m[1]}: changes ${changes.length} 條 / changes_en ${changes_en.length} 條`);
    entries.push({ version: m[1], date: m[2], changes, changes_en });
}
if (!entries.length) { console.error('no changelog entries parsed'); process.exit(1); }
if (problems.length) { console.error('changelog 英文對照不完整:\n  ' + problems.join('\n  ')); process.exit(1); }
const out = '// 由 scripts/gen-changelog.js 從 wordpress/rimtown.php 產生,請勿手改\n' +
    'window.RIMTOWN_CHANGELOG = ' + JSON.stringify(entries) + ';\n';
for (const f of ['chrome-extension/changelog.js', 'wordpress/changelog.js']) fs.writeFileSync(path.join(root, f), out);
console.log('changelog.js:', entries.length, 'versions, latest', entries[0].version);

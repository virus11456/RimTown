#!/usr/bin/env node
// 從 wordpress/rimtown.php 的 rimtown_get_changelog() 產生 chrome-extension/changelog.js 與 wordpress/changelog.js
// (首頁「更新紀錄」的資料來源;單一來源 = rimtown.php,每次發版跑一次)
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const php = fs.readFileSync(path.join(root, 'wordpress', 'rimtown.php'), 'utf8');
const start = php.indexOf('function rimtown_get_changelog()');
const body = php.slice(start, php.indexOf('\n}', start));
const entries = [];
const re = /'version'\s*=>\s*'([^']*)',\s*'date'\s*=>\s*'([^']*)',\s*'changes'\s*=>\s*array\(([\s\S]*?)\),\s*\)/g;
let m;
while ((m = re.exec(body))) {
    const changes = [];
    const rs = /'((?:[^'\\]|\\.)*)'/g; let c;
    while ((c = rs.exec(m[3]))) changes.push(c[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
    entries.push({ version: m[1], date: m[2], changes });
}
if (!entries.length) { console.error('no changelog entries parsed'); process.exit(1); }
const out = '// 由 scripts/gen-changelog.js 從 wordpress/rimtown.php 產生,請勿手改\n' +
    'window.RIMTOWN_CHANGELOG = ' + JSON.stringify(entries) + ';\n';
for (const f of ['chrome-extension/changelog.js', 'wordpress/changelog.js']) fs.writeFileSync(path.join(root, f), out);
console.log('changelog.js:', entries.length, 'versions, latest', entries[0].version);

// v6.22.3 CJK 標點稽核:找模板字串(反引號)本文裡沒包進 t() 的 CJK 標點（「」：、（）！？，。——），英文模式會原樣露出。
// 用法:node scripts/cjk-punct-audit.js [--list]   超過基準（目前 10:AI 提示詞與 console.log）就失敗。自動改寫工具在 scratchpad cjk_punct_fix.js（逐字元走模板本文,跳過提示詞／正規式／new Agent 名字）。
// 找程式碼字串裡「沒包在 t()/tpl()/logMessageT() 第一參數」的 CJK 標點（「」：、（）——！？，。），英文模式會原樣露出
const fs = require('fs'); const path = require('path');
const dir = 'chrome-extension'; const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !/^(i18n|changelog|tilemap|sw)\.js$/.test(f));
const PUNCT = /[「」：、（）！？，。…]/; const BASELINE = 10;
let total = 0; const byFile = {};
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  // 1) 去掉註解
  let s = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
  // 2) 去掉 t('...') / tpl('...' / logMessageT('cat','...' / addT(...,'...' 等的中文鍵：簡化為「任何單引號字串前面緊接 t( 或 tpl( 或 , 」→ 視為鍵。只標記「不在任何單引號字串、而在模板字串/雙引號裡」的 CJK 標點，以及單引號字串但前面不是 t( 的。
  const lines = s.split('\n'); const hits = [];
  lines.forEach((line, i) => {
    // 移除 t('...')、tpl('...'、T('...' 與 '...' 直接跟在 (、, 後面的鍵（視為 i18n 鍵）
    let l = line.replace(/\b(t|tpl|logMessageT|logMessage|addT|add|collectEvent|_fill|render|describeT|createGossip|createRelGossip|contentT|titleT|textT)\(\s*(?:'[^']*'\s*,\s*)*'(?:[^'\\]|\\.)*'/g, m => ' '.repeat(m.length));
    l = l.replace(/\bt\(\s*`[^`]*`\s*\)/g, m => ' '.repeat(m.length)).replace(/new RegExp\([^)]*\)/g, m => ' '.repeat(m.length)).replace(/\/(?:[^\/\\\n]|\\.)+\/[gimsuy]*/g, m => /[「」：、（）—！？，。…]/.test(m) ? ' '.repeat(m.length) : m);
    // 剩下的字串字面值
    const re = /`(?:[^`\\]|\\.)*`/g; let m;
    while ((m = re.exec(l))) {
      const str = m[0];
      // 模板字串內的 ${...} 內容先去掉
      const body = str[0] === '`' ? str.replace(/\$\{[^}]*\}/g, '') : str;
      if (PUNCT.test(body)) hits.push(`${i + 1}: ${line.trim().slice(0, 150)}`);
    }
  });
  if (hits.length) { byFile[f] = hits; total += hits.length; }
}
for (const [f, h] of Object.entries(byFile)) { console.log(`\n## ${f} (${h.length})`); (process.argv.includes('--list') ? h : h.slice(0, 3)).forEach(x => console.log('  ' + x)); }
console.log('\nTOTAL', total, 'baseline', BASELINE); if (total > BASELINE) { console.error('cjk-punct-audit: new CJK punctuation outside t()'); process.exit(1); }

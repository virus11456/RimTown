// ============================
// i18n 雙語系統 (Bilingual System)
// ============================
// 使用方式：t('中文字串') → 根據當前語言返回對應翻譯
// Usage: t('Chinese string') → returns translation based on current language

// v6.43.6 依「看得到的字」截斷(emoji、組合字、國旗不會被切成一半);以前用 .slice 可能把 emoji 的一半留下來變亂碼
const _clipNeedSeg = /[\uD800-\uDFFF\r\u200C\u200D\u0300-\u0DFF\u0E31-\u109F\u1100-\u11FF\u135D-\u135F\u1700-\u1DFF\u20D0-\u20FF\u2CEF-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uABFF\uD7B0-\uD7FF\uFB1E\uFE00-\uFE2F]/; // 代理對(emoji、國旗)、ZWJ／ZWNJ、CRLF、含附加符號的文字區段(涵蓋 BMP 所有 \p{M})、韓文字母;不用 /u 的 \p{M},中文快路徑才不會慢 6 倍
let _clipSeg = null; // v6.43.7 共用一個 Segmenter(以前每次 new,英文存檔時一次存檔多花 30ms 以上)
function clipText(s, n, ell = '…') {
    s = String(s ?? ''); if (s.length <= n) return s;
    const keep = Math.max(0, n - (ell ? 1 : 0));
    // 快路徑:截斷點附近沒有 emoji／組合字元就直接切。v6.44.1 以前只認幾段附加符號,漏了印度語系的母音符號／virama、
    // 其他附加符號區段、分解的韓文字母(初聲＋中聲＋終聲),會被從中間切開;改用 Unicode「附加符號」類別 \p{M} 一次涵蓋
    if (!_clipNeedSeg.test(s.slice(0, keep + 2))) return s.slice(0, keep) + ell;
    let parts;
    try { if (!_clipSeg && typeof Intl !== 'undefined' && Intl.Segmenter) _clipSeg = new Intl.Segmenter(undefined, { granularity: 'grapheme' }); parts = _clipSeg ? Array.from(_clipSeg.segment(s), x => x.segment) : Array.from(s); } catch (e) { parts = Array.from(s); }
    if (parts.length <= n) return s;
    const out = parts.slice(0, keep);
    // 較舊的瀏覽器會把「子音＋virama」單獨切成一個字,留下一半的連寫字;結尾是 virama／ZWJ 就再退一格
    while (out.length && /[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u0DCA\u0E3A\u0F84\u1039\u17D2\u200D]$/.test(out[out.length - 1])) out.pop();
    return out.join('') + ell;
}
// v6.43.6 清掉落單的半個 emoji(舊存檔被切壞的)
function fixBrokenText(s) { return typeof s === 'string' ? s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '') : s; }
if (typeof globalThis !== 'undefined') { globalThis.clipText = clipText; globalThis.fixBrokenText = fixBrokenText; }
const I18N = (() => {
    // v5.74.1 第一次來的訪客依瀏覽器語言決定預設(非中文 → English);之後以玩家自己切的為準
    let currentLang = (() => {
        try { const v = localStorage.getItem('rimtown-lang'); if (v === 'zh' || v === 'en') return v; } catch (e) {}
        try { const nav = (navigator.language || (navigator.languages && navigator.languages[0]) || 'zh').toLowerCase(); return nav.startsWith('zh') ? 'zh' : 'en'; } catch (e) { return 'zh'; }
    })();

    // English translations (key = Chinese, value = English)
    // v6.28.0 字典拆到 i18n-en.js(255KB 壓縮後),只在英文介面載入;en 物件先建好,字典載入後 Object.assign 進來
    const en = (typeof window !== 'undefined') ? (window.RIMTOWN_I18N_EN = window.RIMTOWN_I18N_EN || {}) : {};
    let _dictLoading = null;
    function _dictUrl() { try { const s = document.currentScript && document.currentScript.src; if (s) return s.replace(/i18n\.js(\?.*)?$/, 'i18n-en.js$1'); } catch (e) {} return 'i18n-en.js'; }
    const _DICT_URL = (typeof document !== 'undefined') ? _dictUrl() : 'i18n-en.js';
    // v6.43.2 載好就記住:以前每次都 Object.keys(7600 筆),記憶／日誌快取每筆都問一次,英文版 getState 一次要 1.8 秒
    let _dictOk = false;
    function dictReady() { if (_dictOk) return true; for (const k in en) { _dictOk = true; break; } return _dictOk; }
    // 英文介面:在解析階段同步插入字典腳本,保證後面的腳本跑到時 t() 已有翻譯
    if (typeof document !== 'undefined' && currentLang === 'en' && !dictReady() && document.readyState === 'loading') {
        try { document.write('<script src="' + _DICT_URL.replace(/"/g, '') + '"><\/script>'); } catch (e) {}
    }
    // 執行期切到英文:動態載字典,載完再翻一次靜態文字並重畫
    function ensureDict(cb) {
        if (dictReady()) { cb && cb(); return; }
        if (!_dictLoading) {
            _dictLoading = new Promise((resolve) => { const s = document.createElement('script'); s.src = _DICT_URL; s.onload = () => resolve(true); s.onerror = () => resolve(false); document.head.appendChild(s); });
        }
        _dictLoading.then(() => { cb && cb(); });
    }


    // v5.72.0 村民英文名:存檔一律存中文名,顯示時才換成英文;隨機卡司「姓+名」用對照表拼成 Given Surname
    const NAME_SURNAMES = {"陳": "Carter", "林": "Lynn", "黃": "Hughes", "張": "Chapman", "李": "Lee", "王": "Walker", "吳": "Woods", "劉": "Lewis", "蔡": "Sawyer", "楊": "Young", "許": "Hudson", "鄭": "Jennings", "謝": "Shaw", "郭": "Cole", "洪": "Hunt", "曾": "Tanner", "廖": "Lowell", "賴": "Lyle", "徐": "Sutton", "周": "Jordan", "葉": "Yates", "蘇": "Sullivan", "高": "Gale", "呂": "Lucas", "潘": "Parker", "簡": "Chandler", "何": "Holt", "羅": "Lowe", "梁": "Lang", "宋": "Song", "唐": "Tate", "趙": "Chase", "馬": "Marsh", "柯": "Keller", "凌": "Lindley", "韓": "Hanley", "董": "Dunn", "魏": "Wells", "方": "Fang", "石": "Stone"};
    const NAME_GIVEN = {"志明": "Ethan", "建宏": "Jason", "俊傑": "Justin", "家豪": "Jacob", "承翰": "Hank", "冠廷": "Kent", "宗翰": "Zach", "柏翰": "Brian", "彥廷": "Ian", "子墨": "Miles", "宇軒": "Shane", "澤": "Zeke", "思成": "Cyrus", "岳": "Everett", "峰": "Fenn", "昊": "Howie", "翔": "Sean", "睿": "Reid", "浩然": "Harlan", "立": "Liam", "風": "Wynn", "岩": "Rocky", "洲": "Joe", "霆": "Tyler", "淑芬": "Sophie", "美玲": "Melinda", "雅婷": "Yvette", "怡君": "Erin", "佳蓉": "Joanna", "曉薇": "Sylvia", "子晴": "Claire", "語彤": "Tara", "欣妍": "Yvonne", "佩珊": "Peggy", "宛柔": "Winona", "思妤": "Cecily", "詠晴": "Serena", "若曦": "Rosie", "芷若": "Jill", "靜宜": "Jean", "采薇": "Tracy", "韻如": "Juno", "婉婷": "Wanda", "晴": "Summer", "嵐": "Layla", "薇": "Vera", "蕎": "Jo", "菱": "Lena", "文傑": "Wesley", "俊宏": "Jonah", "明哲": "Mitchell", "柏宇": "Boyd", "承佑": "Chester", "冠宇": "Garrett", "奕辰": "Easton", "子恆": "Hendrix", "景行": "Kingsley", "允文": "Alvin", "懷安": "Wyatt", "一帆": "Ivan", "兆宏": "Joel", "俊宇": "Jude", "廷威": "Trevor", "冠霖": "Collin", "哲瑋": "Jarvis", "少軒": "Shawn", "季恆": "Jerome", "紹文": "Sherwin", "嘉祥": "Jaxon", "弘毅": "Hollis", "子安": "Zane", "辰": "Chen", "宸": "Chance", "曜": "Yancy", "朗": "Lon", "寬": "Kwan", "鈞": "June", "楷": "Kai", "恆": "Heng", "邦": "Bond", "泰": "Tyrone", "燁": "Yule", "川": "Chuan", "勳": "Shun", "雨彤": "Yolanda", "芷晴": "Jessa", "怡萱": "Ingrid", "沛珊": "Priscilla", "佳琪": "Jackie", "宜庭": "Edie", "雅雯": "Yasmin", "庭瑄": "Tessa", "品妍": "Pia", "語嫣": "Yuna", "嘉欣": "Jacqueline", "予涵": "Yuki", "舒婷": "Shelby", "恩綺": "Enid", "靜怡": "Jenna", "心瑜": "Simone", "依婷": "Iris", "柔安": "Rowena", "昕妤": "Shanna", "貝兒": "Bella", "安琪": "Angie", "語珊": "Yvaine", "若瑄": "Roxanne", "婕": "Jade", "妍": "Yan", "瑄": "Shan", "彤": "Tong", "霏": "Faye", "綺": "Chloe", "恩": "Enya", "棠": "Tamara", "芊": "Chen-Chen", "語": "Yu", "寧": "Ning", "曦": "Cici", "芸": "Yun"};
    const NAME_FIXED = {"陳偉": "Victor", "林美": "Mia", "張豪": "Hugo", "王麗": "Lily", "劉俊": "Leo", "趙霞": "Zoe", "楊鋒": "Felix", "孫雨": "Nora", "吳達": "Duncan", "黃莉": "Hazel", "馬強": "Max", "許瑩": "Ivy", "周明": "Milo", "何昌": "Charles", "何秀": "Sandra", "鄭薇": "Vivian", "蘇晴": "Sunny", "高朗": "Lance", "柯薇": "Willow", "凌波": "Luna", "李雪": "Sylvie", "鄭強": "Grant", "何芳": "Fiona", "蔡文": "Winston", "呂嵐": "Lane", "丁傑": "Jake", "蕭瑜": "Simon", "唐琳": "Tina", "曹峰": "Caleb", "邱雅": "Ella", "范浩": "Howard", "海伯": "Hal", "阿潮": "Cody", "小鷗": "Gwen", "浪叔": "Wade", "秀姑": "Shirley", "石叔": "Stan", "燈爺": "Lou", "阿汐": "Marina", "阿錨": "Andre", "雲姨": "Claudia", "阿舵": "Rudy", "木蝦": "Woody", "珊珊": "Coral", "阿浮": "Finn", "海嬤": "Granny Mae", "小龍": "Drake", "天明": "Dawson", "子軒": "Xander", "浩宇": "Hugh", "嘉禾": "Jasper", "承恩": "Ennis", "宏志": "Henry", "瑞陽": "Ray", "文博": "Wendell", "志遠": "Julian", "新宇": "Neo", "國棟": "Gordon", "小鳳": "Phoebe", "曉月": "Selene", "詩涵": "Sharon", "雨桐": "Autumn", "美琪": "Maggie", "欣怡": "Cindy", "佳穎": "Jenny", "思琪": "Skye", "夢瑤": "Maya", "婉清": "Wendy", "紫萱": "Violet", "若蘭": "Rowan", "礦爺": "Boone", "鐵柱": "Brock", "阿杏": "Ginger", "老錘": "Hank", "小鑽": "Dax", "阿岩": "Petra", "白姑": "Blanche", "牛叔": "Bruno", "阿晴": "Clara", "木根": "Rooney", "祠婆": "Ada", "阿梯": "Terry", "繡姑": "Edith", "阿鈴": "Belle", "油伯": "Olly", "林姥": "Thora", "大熊": "Bjorn", "阿葉": "Fern", "木叔": "Tobias", "阿松": "Pete", "鋸哥": "Sawyer", "鹿娘": "Dora", "老樵": "Woodrow", "阿苔": "Tamsin", "桂嬸": "Greta", "阿哨": "Rafe", "樹婆": "Willa", "阿狐": "Reynard", "皮姑": "Pearl", "阿矢": "Flint", "金老爺": "Magnus", "鳳姨": "Freya", "老帳": "Lester", "阿算": "Abe", "書儀": "Sophie", "財叔": "Caius", "綵姑": "Scarlett", "門叔": "Gates", "窯叔": "Kyle", "阿鋼": "Steele", "杏姑": "Amber", "肥叔": "Barnaby", "阿苗": "Milla", "阿榫": "Tanner", "駝姐": "Carmen", "杜鵑": "Juniper", "石磊": "Garrick", "白露": "Bailey", "老謝": "Gideon", "小滿": "Wren", "阿帆": "Sully", "蚵嫂": "Opal", "阿鹽": "Saul", "阿蓉": "Rosa", "老漁": "Fisher"};
    let _nameRe = null;
    function _buildNameRe() {
        const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fixed = Object.keys(NAME_FIXED).sort((a, b) => b.length - a.length).map(esc).join('|');
        const sn = Object.keys(NAME_SURNAMES).map(esc).join('|');
        const gv = Object.keys(NAME_GIVEN).concat(Object.keys(NAME_FIXED).filter(k => k.length <= 2)).sort((a, b) => b.length - a.length).map(esc).join('|');
        _nameRe = new RegExp('(?:' + fixed + ')|(?:' + sn + ')(?:' + gv + ')', 'g');
    }
    function localizeName(name) {
        if (!name || typeof name !== 'string') return name;
        if (NAME_FIXED[name]) return NAME_FIXED[name];
        const sn = NAME_SURNAMES[name[0]], gv = NAME_GIVEN[name.slice(1)] || NAME_FIXED[name.slice(1)];
        if (sn && gv && name.length >= 2) return gv + ' ' + sn;
        return name;
    }
    function localizeNames(str, force = false) {
        if ((currentLang === 'zh' && !force) || !str || typeof str !== 'string' || !/[\u4e00-\u9fff]/.test(str)) return str;
        if (!_nameRe) _buildNameRe();
        return str.replace(_nameRe, (m) => localizeName(m));
    }
    function localizeTree(root) {
        if (currentLang === 'zh' || !root) return;
        if (root.nodeType === 3) { const v = localizeNames(root.data); if (v !== root.data) root.data = v; return; }
        if (root.nodeType !== 1 && root.nodeType !== 11) return;
        if (root.nodeType === 1 && (root.tagName === 'SCRIPT' || root.tagName === 'STYLE' || root.tagName === 'TEXTAREA' || root.tagName === 'INPUT')) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n; const todo = [];
        while ((n = walker.nextNode())) { if (/[\u4e00-\u9fff]/.test(n.data)) todo.push(n); }
        for (const tn of todo) { const v = localizeNames(tn.data); if (v !== tn.data) tn.data = v; }
        if (root.nodeType === 1 && root.title && /[\u4e00-\u9fff]/.test(root.title)) root.title = localizeNames(root.title);
    }
    // v5.73.0 反向:AI 用英文名回覆時,把英文名換回存檔用的中文名(固定卡司/新生兒對照 + 隨機卡司 Given Surname)
    let _revFixed = null, _revRe = null, _revSurname = null, _revGiven = null;
    function _buildRev() {
        _revFixed = {}; for (const [zh, en] of Object.entries(NAME_FIXED)) if (!_revFixed[en]) _revFixed[en] = zh;
        _revSurname = {}; for (const [zh, en] of Object.entries(NAME_SURNAMES)) _revSurname[en] = zh;
        _revGiven = {}; for (const [zh, en] of Object.entries(NAME_GIVEN)) _revGiven[en] = zh;
        for (const [zh, en] of Object.entries(NAME_FIXED)) if (zh.length <= 2 && !_revGiven[en]) _revGiven[en] = zh;
        const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fixed = Object.keys(_revFixed).sort((a, b) => b.length - a.length).map(esc).join('|');
        const gv = Object.keys(_revGiven).sort((a, b) => b.length - a.length).map(esc).join('|');
        const sn = Object.keys(_revSurname).sort((a, b) => b.length - a.length).map(esc).join('|');
        _revRe = new RegExp('\\b(?:(' + gv + ') (' + sn + ')|(' + fixed + '))\\b', 'g');
    }
    // v5.81.0 玩家自訂村民可登記英文名:進固定名對照表,正反向對照都重建
    function registerName(zh, en) {
        if (!zh || !en || typeof zh !== 'string' || typeof en !== 'string') return;
        zh = zh.trim(); en = en.trim();
        if (!zh || !en || NAME_FIXED[zh] === en) return;
        NAME_FIXED[zh] = en;
        _nameRe = null; _revRe = null;
    }
    function delocalizeNames(str) {
        if (!str || typeof str !== 'string' || !/[A-Za-z]/.test(str)) return str;
        if (!_revRe) _buildRev();
        return str.replace(_revRe, (m, gv, sn, fixed) => {
            if (fixed) return _revFixed[fixed] || m;
            if (gv && sn && _revSurname[sn] && _revGiven[gv]) return _revSurname[sn] + _revGiven[gv];
            return m;
        });
    }
    let _nameObserver = null;
    function _syncNameObserver() {
        if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
        if (currentLang === 'en') {
            if (_nameObserver) return;
            _nameObserver = new MutationObserver((muts) => {
                for (const m of muts) {
                    if (m.type === 'characterData') { const v = localizeNames(m.target.data); if (v !== m.target.data) m.target.data = v; }
                    else for (const nd of m.addedNodes) localizeTree(nd);
                }
            });
            _nameObserver.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
            localizeTree(document.body);
        } else if (_nameObserver) { _nameObserver.disconnect(); _nameObserver = null; }
    }
    // v6.40.1 中文半形標點轉全形:內建台詞有上百句寫成「喲,這不是…嗎?」,AI 回覆也常混半形。只轉緊接在中文字後面的 , ? ! ; :
    const _ZP = { ',': '，', '?': '？', '!': '！', ';': '；', ':': '：' };
    const _ZP_TEST = /[\u3400-\u9fff\u3001-\u303f\uff01-\uff5e][,?!;:]/;
    const _ZP_RE = /([\u3400-\u9fff\u3001-\u303f\uff01-\uff5e])([,?!;:])(?!\/\/)/g;
    function zhPunct(s) { if (typeof s !== 'string' || !_ZP_TEST.test(s)) return s; return s.replace(_ZP_RE, (m, a, p) => a + _ZP[p]); }
    window.zhPunct = zhPunct;
    function t(text) {
        if (currentLang === 'zh') return zhPunct(text);
        if (!text || typeof text !== 'string') return text;
        return localizeNames(_t(text)); // v5.72.0 翻譯後再把夾在句子裡的中文人名換成英文名
    }
    function _t(text) {
        // Direct lookup
        if (en[text] !== undefined) return en[text];
        // Try trimmed
        const trimmed = text.trim();
        if (en[trimmed] !== undefined) return en[trimmed];
        // Handle HTML-wrapped strings: extract Chinese text, translate, put back
        if (text.includes('<') && text.includes('>')) {
            let result = text;
            // Replace Chinese text segments between/outside HTML tags
            result = result.replace(/(>)([^<]+)(<)/g, (match, open, content, close) => {
                const translated = en[content.trim()] || content;
                return open + (content.startsWith(' ') ? ' ' : '') + translated + (content.endsWith(' ') ? ' ' : '') + close;
            });
            // Handle trailing text after last tag
            result = result.replace(/>([^<]+)$/g, (match, content) => {
                const translated = en[content.trim()] || content;
                return '>' + translated;
            });
            // Handle leading text before first tag
            result = result.replace(/^([^<]+)</, (match, content) => {
                const translated = en[content.trim()] || content;
                return translated + '<';
            });
            if (result !== text) return result;
        }
        return text; // Fallback to original
    }

    function setLang(lang) {
        currentLang = lang;
        localStorage.setItem('rimtown-lang', lang);
        if (lang === 'en' && !dictReady()) { ensureDict(() => { _applyLang(); try { window.rimtownApp?.render?.(); window.rimtownApp?.renderSidebar?.(); } catch (e) {} }); return; } // v6.28.0
        _applyLang();
    }
    function _applyLang() {
        // Translate static HTML elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = t(key);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = t(key);
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = t(key);
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            el.innerHTML = t(key);
        });
        _syncNameObserver(); // v5.72.0
        // Update page title
        document.title = t('邊境鎮') + ' - AI ' + t('小鎮') + (currentLang === 'en' ? ' Simulation' : '模擬');
    }

    function getLang() {
        return currentLang;
    }

    function toggleLang() {
        setLang(currentLang === 'zh' ? 'en' : 'zh');
    }

    // Expose globally
    window.t = t;
    window.I18N = { t, setLang, getLang, toggleLang, translations: en, localizeName, localizeNames, localizeTree, delocalizeNames, registerName, ensureDict, dictReady, _onDictLoaded: () => { try { _buildNameRe?.(); } catch (e) {} } };
    if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _syncNameObserver); else _syncNameObserver(); }

    return { t, setLang, getLang, toggleLang, translations: en, localizeName, localizeNames, localizeTree, delocalizeNames, registerName, ensureDict, dictReady };
})();

// RimTown - landing-3d.js：首頁的 3D 場景(v9.29.0 重寫)
// - 首屏:黃昏的小鎮。村民在鎮上走動,每隔幾秒有一個人遇到事、看選項、自己選、說理由,結果真的發生(錢飛過去、道歉、搖頭)
// - 「從一個人到整個世界」:同一座小鎮,鏡頭隨捲動從一個人拉遠到整片海,再升到天上
// - 頁面先畫好,閒置時才載 three.js 與 villager3d.js;捲出畫面或切到別的分頁就停
// - 偏好減少動態的人只畫一格;沒有 WebGL 時首屏改放一張實際畫面
'use strict';
const LANDING3D = (() => {
    const live = new Set();
    const zh = () => !(typeof I18N !== 'undefined' && I18N.getLang && I18N.getLang() === 'en');
    const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    let libs = null;
    const ensure = () => libs || (libs = (async () => {
        if (typeof THREE === 'undefined') await load('vendor/three.min.js');
        if (typeof VILLAGER3D === 'undefined') await load('villager3d.js');
    })().catch(e => { libs = null; throw e; }));
    const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const small = () => Math.min(window.innerWidth, window.innerHeight) < 600;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    const lerp = (a, b, k) => a + (b - a) * k;
    // 固定種子的亂數:每次載入村民走的路線都一樣,截圖和測試才穩定
    const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    // 村民:名字(決定長相)、職業、性別、年齡段(a 成人／o 老人／c 小孩)、階層、平常待的地方
    const CAST = [
        { name: '唐琳', en: 'Tang Lin', job: 'tailor', jz: '裁縫', je: 'tailor', g: 'female', b: 'a', cls: 0, home: 'doorC' },
        { name: '梁貝兒', en: 'Liang Bei\'er', job: 'trader', jz: '商人', je: 'trader', g: 'female', b: 'a', cls: 4, home: 'stall' },
        { name: '張豪', en: 'Zhang Hao', job: 'blacksmith', jz: '鐵匠', je: 'blacksmith', g: 'male', b: 'a', cls: 3, home: 'doorB' },
        { name: '柯翔', en: 'Ke Xiang', job: 'carpenter', jz: '木匠', je: 'carpenter', g: 'male', b: 'a', cls: 1, home: 'board' },
        { name: '唐允文', en: 'Tang Yunwen', job: 'farmer', jz: '農夫', je: 'farmer', g: 'male', b: 'a', cls: 1, home: 'farm' },
        { name: '張語嫣', en: 'Zhang Yuyan', job: 'priest', jz: '牧師', je: 'priest', g: 'female', b: 'a', cls: 2, home: 'hall' },
        { name: '楊鋒', en: 'Yang Feng', job: 'miner', jz: '礦工', je: 'miner', g: 'male', b: 'o', cls: 1, home: 'doorA' },
        { name: '白露', en: 'Bai Lu', job: 'cook', jz: '廚師', je: 'cook', g: 'female', b: 'a', cls: 2, home: 'well' },
    ];
    // 首屏輪播的決定。理由是 9.28 版接真模型實測時,村民自己說的原話(英文為翻譯);選項是這類事情會列出來的選項
    // who／to:CAST 的索引;at:發生在哪;fx:coin 錢從 from 飛到 dest、bow 道歉、no 搖頭、hold 忍住
    const DECISIONS = [
        { who: 0, to: 1, at: 'stall', fx: 'coin', from: 1, dest: 0,
          kind: ['手頭很緊', 'Short of money'], sit: ['身上只剩 1 銀幣，欠陳雅婷的錢快到期了。', 'Down to 1 silver, and the debt to Chen Yating is nearly due.'],
          opts: [['咬牙撐過去，不跟任何人開口', 'Tough it out and ask no one'], ['跟梁貝兒開口借 15 銀幣', 'Ask Liang Bei\'er for 15 silver']], pick: 1,
          why: ['欠陳雅婷的錢快到期，先跟梁貝兒開口借 15 銀幣應急。', 'The debt to Chen Yating is nearly due. I\'ll ask Liang Bei\'er for 15 silver to get by.'],
          res: ['梁貝兒：「唐琳都開口了，身上只剩 1 銀幣，總不能見死不救。」借了 15 銀幣。', 'Liang Bei\'er: "Tang Lin asked me herself, and she has 1 silver left. I can\'t just watch." She lent the 15 silver.'] },
        { who: 2, to: 1, at: 'doorB', fx: 'no',
          kind: ['有人想買你的股份', 'Someone wants your shares'], sit: ['梁貝兒開了高價，想買鐵鋪一半的股份。', 'Liang Bei\'er offers a high price for half the smithy.'],
          opts: [['賣給她', 'Sell to her'], ['不賣', 'Refuse']], pick: 1,
          why: ['梁貝兒開價雖高，但我不想把鐵鋪分一半出去，每週分紅也心疼。', 'Her price is high, but I don\'t want to give away half the smithy, and paying dividends every week would hurt.'],
          res: ['回絕了。', 'He turned her down.'] },
        { who: 3, to: 4, at: 'well', fx: 'bow',
          kind: ['對不起某人', 'Owing an apology'], sit: ['在背後說了別人的壞話，被唐允文知道了。', 'He talked behind someone\'s back, and Tang Yunwen found out.'],
          opts: [['去跟唐允文道歉', 'Apologize to Tang Yunwen'], ['先不去，拉不下臉', 'Not yet, too proud']], pick: 0,
          why: ['我先前在背後說鄭薇壞話，這事是我不對，該跟唐允文道歉。', 'I spoke ill of Zheng Wei behind her back. I was in the wrong, and I owe Tang Yunwen an apology.'],
          res: ['話說出口了。唐允文：「該原諒他。」兩人和好。', 'He said it. Tang Yunwen: "I should forgive him." They made up.'] },
        { who: 5, to: null, at: 'hall', fx: 'hold',
          kind: ['手頭很緊', 'Short of money'], sit: ['身上只剩 4 銀幣。', 'Down to 4 silver.'],
          opts: [['咬牙撐過去，不跟任何人開口', 'Tough it out and ask no one'], ['跟熟人開口借錢', 'Ask someone she knows for a loan']], pick: 0,
          why: ['身上只剩 4 銀幣，但我是牧師，不該為錢去求人，只能忍。', 'I have 4 silver left, but I\'m a priest. I shouldn\'t beg for money. I\'ll bear it.'],
          res: ['沒有跟任何人開口。', 'She asked no one.'] },
        { who: 6, to: 7, at: 'doorA', fx: 'coin', from: 7, dest: 6,
          kind: ['手頭很緊', 'Short of money'], sit: ['銀行的欠款還沒還，手頭又空了。', 'Still in debt to the bank, and out of money again.'],
          opts: [['咬牙撐過去，不跟任何人開口', 'Tough it out and ask no one'], ['跟白露開口借 10 銀幣', 'Ask Bai Lu for 10 silver']], pick: 1,
          why: ['銀行欠款還沒還，白露是自己的孩子，開口借比較不丟臉。', 'I still owe the bank. Bai Lu is my own child, so asking her is less shameful.'],
          res: ['白露借了他 10 銀幣。', 'Bai Lu lent him 10 silver.'] },
        { who: 2, to: null, at: 'board', fx: 'no',
          kind: ['手上寬裕，政治人物用得上', 'Money to spare, and a politician who could use it'], sit: ['快選舉了，候選人宋楷正缺經費。', 'An election is coming, and the candidate Song Kai needs funds.'],
          opts: [['捐一筆給宋楷', 'Donate to Song Kai'], ['不捐', 'Don\'t donate']], pick: 1,
          why: ['捐錢給宋楷這種事太顯眼，被報社挖出來不好看，不捐。', 'Giving money to Song Kai would be too visible. If the paper dug it up it would look bad. No.'],
          res: ['沒有捐。', 'No donation.'] },
    ];
    // 小鎮裡的定點(x, z)
    const SPOT = {
        plazaN: [0, -1.5], plazaE: [1.4, -0.3], plazaS: [0.1, 1.0], plazaW: [-1.3, -0.5], hall: [0, -2.5], board: [1.6, -1.2], stall: [2.2, 1.3],
        well: [-1.9, 1.7], farm: [-1.1, 3.2], doorA: [-3.4, -0.7], doorB: [3.5, -1.2], doorC: [-3.0, 1.9], lampS: [0.4, 2.5], east: [4.2, 2.6],
    };
    const WANDER = ['plazaN', 'plazaE', 'plazaS', 'plazaW', 'hall', 'board', 'stall', 'well', 'farm', 'doorA', 'doorB', 'doorC', 'lampS', 'east'];

    // ---------- 共用的造景工具 ----------
    function kit() {
        const mats = new Map();
        const mat = (hex, em, ei) => { const k = hex + '|' + (em || '') + '|' + (ei || ''); let m = mats.get(k); if (!m) { m = new THREE.MeshLambertMaterial({ color: new THREE.Color(hex), flatShading: true }); if (em) { m.emissive = new THREE.Color(em); m.emissiveIntensity = ei ?? 1; } mats.set(k, m); } return m; };
        const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 8), cyl12: new THREE.CylinderGeometry(1, 1, 1, 12), cone4: new THREE.ConeGeometry(1, 1, 4), cone6: new THREE.ConeGeometry(1, 1, 6), ico: new THREE.IcosahedronGeometry(1, 0), plane: new THREE.PlaneGeometry(1, 1) };
        // 加一塊:幾何、顏色、掛在哪、位置、大小;o.ry 轉向、o.cast/o.recv 陰影、o.em 自發光、o.live 之後還會動(不凍結矩陣)
        const put = (geo, hex, parent, p, s, o = {}) => {
            const m = new THREE.Mesh(typeof geo === 'string' ? G[geo] : geo, o.mat || mat(hex, o.em, o.ei));
            m.position.set(p[0], p[1], p[2]); m.scale.set(s[0], s[1], s[2]);
            if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
            m.castShadow = o.cast !== false; m.receiveShadow = !!o.recv;
            if (!o.live) { m.matrixAutoUpdate = false; m.updateMatrix(); }
            parent.add(m); return m;
        };
        const tex = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t; };
        const glowTex = tex(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,220,150,1)'); r.addColorStop(0.35, 'rgba(255,190,110,0.45)'); r.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
        const glow = (parent, p, size, color, op) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(color || '#ffffff'), transparent: true, opacity: op ?? 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set(p[0], p[1], p[2]); sp.scale.set(size, size, 1); parent.add(sp); return sp; };
        return { mat, G, put, tex, glow, mats };
    }
    const grp = (parent, x, y, z, ry) => { const g = new THREE.Group(); g.position.set(x, y, z); if (ry) g.rotation.y = ry; parent.add(g); return g; };

    // 一棟房子:牆、屋頂、門、亮著燈的窗、煙囪
    function house(K, parent, x, z, ry, o) {
        const g = grp(parent, x, 0, z, ry); const w = o.w || 1.6, h = o.h || 1.1, d = o.d || 1.3;
        K.put('box', o.wall || '#F1E0C2', g, [0, h / 2, 0], [w, h, d], { recv: true });
        K.put('box', '#8E8072', g, [0, 0.05, 0], [w + 0.14, 0.1, d + 0.14], { cast: false, recv: true });
        const roof = K.put('cone4', o.roof || '#C9533D', g, [0, h + (o.rh || 0.7) / 2, 0], [w * 0.83, o.rh || 0.7, d * 0.86], { ry: Math.PI / 4 });
        K.put('box', '#6E4A33', g, [o.doorX || 0, 0.36, d / 2 + 0.01], [0.34, 0.62, 0.06], { cast: false });
        const wins = [];
        for (const wx of (o.win || [-0.48, 0.48])) wins.push(K.put('box', '#FFD98A', g, [wx, h * 0.62, d / 2 + 0.01], [0.3, 0.3, 0.05], { cast: false, mat: new THREE.MeshLambertMaterial({ color: new THREE.Color('#FFE3A6'), emissive: new THREE.Color('#FFC66B'), emissiveIntensity: 0.9 }) }));
        if (o.side !== false) wins.push(K.put('box', '#FFD98A', g, [w / 2 + 0.01, h * 0.62, 0], [0.05, 0.3, 0.3], { cast: false, mat: wins[0].material }));
        let chim = null;
        if (o.chimney) { K.put('box', '#8A6A58', g, [w * 0.24, h + 0.62, -d * 0.12], [0.2, 0.5, 0.2]); chim = new THREE.Vector3(w * 0.24, h + 0.95, -d * 0.12); g.updateMatrixWorld(true); chim.applyMatrix4(g.matrixWorld); }
        return { g, roof, wins, chim };
    }
    function tree(K, parent, x, z, s, pine, sway) {
        const g = grp(parent, x, 0, z); g.scale.setScalar(s || 1);
        K.put('cyl', '#7A5238', g, [0, 0.42, 0], [0.13, 0.84, 0.13]);
        const top = new THREE.Group(); top.position.y = 0.84; g.add(top);
        if (pine) { K.put('cone6', '#3F7A5A', top, [0, 0.45, 0], [0.72, 1.0, 0.72], { live: true }); K.put('cone6', '#4C8E66', top, [0, 1.0, 0], [0.52, 0.85, 0.52], { live: true }); }
        else { K.put('ico', '#5FA05A', top, [0, 0.5, 0], [0.82, 0.74, 0.82], { live: true }); K.put('ico', '#74B868', top, [0.24, 1.0, 0.1], [0.52, 0.5, 0.52], { live: true }); }
        sway.push({ top, ph: x * 1.3 + z });
        return g;
    }
    function lamp(K, parent, x, z, glows) {
        const g = grp(parent, x, 0, z);
        K.put('box', '#3B3A46', g, [0, 0.62, 0], [0.07, 1.24, 0.07]);
        K.put('box', '#3B3A46', g, [0, 1.3, 0], [0.26, 0.05, 0.26]);
        K.put('box', '#FFE2A0', g, [0, 1.17, 0], [0.17, 0.2, 0.17], { cast: false, em: '#FFC060', ei: 1.4 });
        glows.push({ sp: K.glow(g, [0, 1.17, 0], 1.7, '#ffcf8a', 0.75), ph: x + z, base: 0.75 });
    }

    // ---------- 小鎮 ----------
    // full:連同海、鄰島、船、多蓋的房子、天上的牌(給「從一個人到整個世界」用)
    function town(K, scene, opt) {
        const root = grp(scene, 0, 0, 0); const sway = [], glows = [], smokes = [], flags = [], lit = [];
        // 島:草皮＋泥土＋岩石(低多邊形)
        K.put(new THREE.CylinderGeometry(7.3, 7.3, 0.36, 14), '#6FB55A', root, [0, -0.18, 0], [1, 1, 1], { recv: true, cast: false });
        K.put(new THREE.CylinderGeometry(7.3, 5.9, 1.1, 14), '#8F6A48', root, [0, -0.91, 0], [1, 1, 1], { cast: false });
        K.put(new THREE.CylinderGeometry(5.9, 3.0, 1.5, 14), '#6E5340', root, [0, -2.2, 0], [1, 1, 1], { cast: false });
        K.put(new THREE.CylinderGeometry(3.0, 0.9, 1.4, 10), '#584436', root, [0, -3.6, 0], [1, 1, 1], { cast: false });
        // 廣場與小路
        K.put('cyl12', '#D2B88F', root, [0, 0.025, -0.4], [2.15, 0.05, 2.15], { recv: true, cast: false });
        K.put('cyl12', '#BFA57C', root, [0, 0.03, -0.4], [1.2, 0.055, 1.2], { recv: true, cast: false });
        const road = (x, z, len, ry) => K.put('box', '#CBA873', root, [x, 0.02, z], [0.82, 0.04, len], { recv: true, cast: false, ry });
        road(0, -2.5, 2.2, 0); road(-2.6, -0.7, 2.6, Math.PI / 2 + 0.12); road(2.7, -0.9, 2.6, Math.PI / 2 - 0.16); road(-1.6, 1.4, 2.6, -0.85); road(1.5, 1.2, 2.2, 0.85); road(-0.6, 2.8, 2.2, 0.25);
        // 鎮公所:塔、鐘、旗
        const hall = grp(root, 0, 0, -4.1);
        K.put('box', '#A9A096', hall, [0, 0.09, 0.15], [3.6, 0.18, 2.5], { recv: true, cast: false });
        K.put('box', '#EADDC4', hall, [0, 0.93, 0], [3.0, 1.5, 1.8], { recv: true });
        K.put('cone4', '#3E5F74', hall, [0, 2.1, 0], [2.45, 0.9, 1.55], { ry: Math.PI / 4 });
        K.put('box', '#EADDC4', hall, [0, 2.3, 0.5], [0.82, 1.5, 0.82]);
        K.put('cone4', '#3E5F74', hall, [0, 3.38, 0.5], [0.76, 0.68, 0.76], { ry: Math.PI / 4 });
        K.put('cyl12', '#FFF1CF', hall, [0, 2.55, 0.92], [0.24, 0.04, 0.24], { rx: Math.PI / 2, cast: false, em: '#FFD98A', ei: 0.7 });
        K.put('box', '#5E4030', hall, [0, 0.58, 0.91], [0.56, 0.8, 0.06], { cast: false });
        const hw = new THREE.MeshLambertMaterial({ color: new THREE.Color('#FFE3A6'), emissive: new THREE.Color('#FFC66B'), emissiveIntensity: 1 }); lit.push(hw);
        for (const wx of [-1.05, -0.62, 0.62, 1.05]) K.put('box', '#FFD98A', hall, [wx, 1.0, 0.91], [0.26, 0.44, 0.05], { cast: false, mat: hw });
        for (const cx of [-1.35, 1.35]) K.put('box', '#D9CCB4', hall, [cx, 0.93, 0.98], [0.16, 1.5, 0.16]);
        K.put('box', '#5A5560', hall, [0, 4.15, 0.5], [0.04, 0.9, 0.04]);
        const flag = new THREE.Group(); flag.position.set(0, 4.42, 0.5); hall.add(flag); K.put('box', '#F2A65A', flag, [0.27, 0, 0], [0.52, 0.28, 0.02], { live: true, cast: false }); flags.push(flag);
        // 房子
        const hs = [
            house(K, root, -4.5, -1.5, 0.55, { wall: '#F1E0C2', roof: '#C9533D', chimney: true }),
            house(K, root, 4.6, -2.1, -0.5, { wall: '#DCE2E8', roof: '#56699E', chimney: true, w: 1.7, h: 1.2 }),
            house(K, root, -4.1, 2.5, 0.95, { wall: '#EAD7B0', roof: '#B98A4A', w: 1.4, h: 0.95, d: 1.2, rh: 0.62 }),
            house(K, root, 5.2, 1.0, -1.1, { wall: '#E6C8A6', roof: '#7B4B3A', w: 1.5, d: 1.25 }),
        ];
        for (const h of hs) { lit.push(h.wins[0].material); if (h.chim) smokes.push(h.chim); }
        // 市集攤位:條紋棚、櫃檯、貨
        const st = grp(root, 2.9, 0, 2.3, -0.4);
        for (const [px, pz] of [[-0.72, -0.42], [0.72, -0.42], [-0.72, 0.42], [0.72, 0.42]]) K.put('box', '#7A5238', st, [px, 0.55, pz], [0.07, 1.1, 0.07]);
        for (let i = 0; i < 6; i++) K.put('box', i % 2 ? '#F4ECDF' : '#E8674A', st, [-0.63 + i * 0.252, 1.16, 0], [0.252, 0.06, 1.08], { rx: 0.14 });
        K.put('box', '#9C7650', st, [0, 0.26, 0.2], [1.4, 0.52, 0.5], { recv: true });
        for (const [cx, col] of [[-0.45, '#E8674A'], [-0.15, '#F2C14E'], [0.15, '#7FB98A'], [0.45, '#F4ECDF']]) K.put('box', col, st, [cx, 0.59, 0.2], [0.2, 0.14, 0.26], { cast: false });
        // 井
        const well = grp(root, -2.5, 0, 1.2);
        K.put('cyl', '#9A948E', well, [0, 0.24, 0], [0.42, 0.48, 0.42]); K.put('cyl', '#22283A', well, [0, 0.49, 0], [0.3, 0.02, 0.3], { cast: false });
        K.put('box', '#7A5238', well, [-0.36, 0.72, 0], [0.07, 1.0, 0.07]); K.put('box', '#7A5238', well, [0.36, 0.72, 0], [0.07, 1.0, 0.07]);
        K.put('cone4', '#8A5A3C', well, [0, 1.38, 0], [0.62, 0.36, 0.62], { ry: Math.PI / 4 });
        // 提案板
        const bd = grp(root, 2.2, 0, -1.9, -0.35);
        K.put('box', '#7A5238', bd, [-0.42, 0.5, 0], [0.07, 1.0, 0.07]); K.put('box', '#7A5238', bd, [0.42, 0.5, 0], [0.07, 1.0, 0.07]);
        K.put('box', '#8C5A3C', bd, [0, 0.78, 0], [0.96, 0.6, 0.06]);
        for (const [nx, ny, col] of [[-0.25, 0.84, '#F4ECDF'], [0.05, 0.74, '#F4ECDF'], [0.3, 0.88, '#F2C14E']]) K.put('box', col, bd, [nx, ny, 0.04], [0.2, 0.26, 0.02], { cast: false });
        // 田:土、一排排的苗、稻草人
        const farm = grp(root, -1.3, 0, 4.5, 0.12);
        K.put('box', '#7B5B3E', farm, [0, 0.03, 0], [2.7, 0.06, 1.6], { recv: true, cast: false });
        for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) K.put('box', (r + c) % 3 ? '#8BCB6B' : '#B7D968', farm, [-1.08 + c * 0.36, 0.14, -0.57 + r * 0.38], [0.14, 0.2, 0.14], { cast: false });
        K.put('box', '#7A5238', farm, [-1.2, 0.5, 0.55], [0.06, 1.0, 0.06]); K.put('box', '#7A5238', farm, [-1.2, 0.74, 0.55], [0.6, 0.06, 0.06]); K.put('box', '#D9B56A', farm, [-1.2, 1.04, 0.55], [0.22, 0.22, 0.22]);
        for (let i = 0; i < 7; i++) K.put('box', '#9C7650', root, [-2.75 + i * 0.5, 0.2, 5.55 - Math.abs(i - 3) * 0.05], [0.06, 0.4, 0.06], { cast: false });
        K.put('box', '#9C7650', root, [-1.25, 0.3, 5.5], [3.1, 0.05, 0.05], { cast: false });
        // 長椅、路燈、樹、花、石頭
        K.put('box', '#8C5A3C', root, [-1.15, 0.2, -2.0], [0.9, 0.07, 0.3]); K.put('box', '#8C5A3C', root, [-1.15, 0.36, -2.14], [0.9, 0.3, 0.05]);
        for (const [x, z] of [[-1.9, -1.9], [2.05, 0.2], [3.9, 3.6], [-4.9, 0.6], [-0.9, 6.0]]) lamp(K, root, x, z, glows);
        for (const [x, z, s, p] of [[-6.2, -0.4, 1.15, 0], [-5.4, -3.7, 1.0, 1], [6.3, 0.1, 1.05, 1], [6.3, 3.0, 1.15, 0], [-2.9, 6.0, 0.95, 1], [2.3, -6.0, 1.1, 1], [-2.4, -5.9, 1.0, 0], [1.6, 5.9, 1.0, 0], [-6.0, 3.6, 0.9, 1], [6.4, -3.2, 0.9, 0], [1.9, 6.3, 0.7, 1]]) tree(K, root, x, z, s, !!p, sway);
        for (const [c, x, z] of [['#F4A3C4', -3.3, 0.5], ['#F6D365', -5.3, 1.6], ['#FFFFFF', 4.0, 0.2], ['#F4A3C4', 1.1, 3.9], ['#9EC9F2', -0.9, -3.3], ['#F6D365', 3.4, -3.6], ['#FFFFFF', -3.9, -3.5], ['#F4A3C4', 5.9, 2.2], ['#9EC9F2', 0.9, 4.9]]) { K.put('box', '#4E8A3A', root, [x, 0.09, z], [0.04, 0.18, 0.04], { cast: false }); K.put('box', c, root, [x, 0.21, z], [0.12, 0.1, 0.12], { cast: false }); }
        for (const [x, z, s] of [[-6.6, 1.5, 0.34], [6.5, -1.6, 0.4], [0.6, -6.6, 0.3], [-4.6, 4.9, 0.28]]) K.put('ico', '#8C8A93', root, [x, s * 0.5, z], [s, s * 0.7, s]);
        // 煙囪的煙
        const puffMat = () => new THREE.MeshBasicMaterial({ color: 0xcfc8d8, transparent: true, opacity: 0.5, depthWrite: false });
        const puffs = [];
        smokes.forEach((p, si) => { for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(K.G.ico, puffMat()); m.position.copy(p); m.castShadow = false; root.add(m); puffs.push({ m, p, ph: i / 5 + si * 0.13 }); } });
        const out = { root, sway, glows, puffs, flags, lit, hs, grow: [], far: [], boats: [], cards: [], beam: null, storm: null, meteor: null, ring: null };
        if (opt.full) world(K, scene, out);
        return out;
    }
    // 海、鄰島、船、長大後才有的房子、天上的事件卡
    function world(K, scene, T) {
        const sea = new THREE.Mesh(new THREE.CircleGeometry(160, 40), new THREE.MeshLambertMaterial({ color: new THREE.Color('#20345C') }));
        sea.rotation.x = -Math.PI / 2; sea.position.y = -2.6; sea.receiveShadow = false; scene.add(sea);
        K.put('cyl12', '#2B4474', scene, [0, -2.58, 0], [10.5, 0.02, 10.5], { cast: false });
        // 小鎮長大:多出來的房子、工廠、高塔(捲到第五章才長出來)
        const g = grp(T.root, 0, 0, 0);
        const add = (fn) => { const h = new THREE.Group(); g.add(h); fn(h); h.scale.setScalar(0.001); T.grow.push(h); };
        add(h => house(K, h, -5.9, 1.9, 1.2, { wall: '#E8DCCB', roof: '#A8483A', w: 1.3, h: 1.5, d: 1.1 }));
        add(h => house(K, h, 3.4, -4.3, -0.2, { wall: '#DCE2E8', roof: '#56699E', w: 1.4, h: 1.7, d: 1.2 }));
        add(h => house(K, h, -3.1, -4.3, 0.25, { wall: '#F1E0C2', roof: '#C9533D', w: 1.4, h: 1.5, d: 1.2, chimney: true }));
        add(h => { const f = grp(h, 4.9, 0, 4.0, -0.8); K.put('box', '#B9A592', f, [0, 0.7, 0], [2.0, 1.4, 1.4]); K.put('box', '#6E5A50', f, [0, 1.47, 0], [2.1, 0.14, 1.5]); K.put('cyl', '#8A6A58', f, [0.6, 1.9, -0.2], [0.2, 1.6, 0.2]); K.put('box', '#FFD98A', f, [-0.4, 0.8, 0.71], [0.5, 0.4, 0.04], { cast: false, em: '#FFC66B', ei: 1 }); });
        add(h => { const t = grp(h, -0.2, 0, 6.2, 0); K.put('box', '#D9CCB4', t, [0, 1.3, 0], [0.8, 2.6, 0.8]); K.put('cone4', '#3E5F74', t, [0, 3.0, 0], [0.74, 0.8, 0.74], { ry: Math.PI / 4 }); K.put('box', '#FFD98A', t, [0, 2.1, 0.41], [0.26, 0.4, 0.04], { cast: false, em: '#FFC66B', ei: 1 }); });
        // 鄰島:各有幾間小屋和一棵樹
        const isl = (x, z, r, cols) => {
            const i = grp(scene, x, -2.4, z);
            K.put(new THREE.CylinderGeometry(r, r * 0.8, 1.4, 9), '#7B5D45', i, [0, 0.5, 0], [1, 1, 1], { cast: false });
            K.put(new THREE.CylinderGeometry(r, r, 0.3, 9), '#66A957', i, [0, 1.3, 0], [1, 1, 1], { cast: false });
            cols.forEach((c, k) => { const a = k * 2.2 + x, d = r * 0.42; const hx = Math.cos(a) * d, hz = Math.sin(a) * d; K.put('box', '#EFE2CB', i, [hx, 1.8, hz], [0.9, 0.7, 0.8], { cast: false }); K.put('cone4', c, i, [hx, 2.4, hz], [0.78, 0.5, 0.7], { ry: Math.PI / 4, cast: false }); K.put('box', '#FFD98A', i, [hx, 1.85, hz + 0.41], [0.2, 0.2, 0.03], { cast: false, em: '#FFC66B', ei: 1.2 }); });
            K.put('ico', '#5FA05A', i, [-r * 0.5, 2.2, r * 0.3], [0.6, 0.8, 0.6], { cast: false });
            T.far.push(i); return i;
        };
        isl(-24, -13, 5.2, ['#C9533D', '#56699E', '#B98A4A']); isl(22, -20, 6.0, ['#56699E', '#A8483A', '#3E5F74', '#C9533D']); isl(25, 10, 4.4, ['#B98A4A', '#C9533D']); isl(-21, 16, 4.8, ['#3E5F74', '#B98A4A', '#C9533D']); isl(1, -33, 4.2, ['#C9533D', '#56699E']);
        // 商船:在小鎮和鄰島之間來回
        const boat = (a, b, sp, ph) => { const g2 = grp(scene, 0, -2.45, 0); K.put('box', '#7A5238', g2, [0, 0.14, 0], [0.5, 0.28, 1.5], { live: true, cast: false }); K.put('box', '#5E4030', g2, [0, 0.6, 0], [0.06, 1.0, 0.06], { live: true, cast: false }); K.put('box', '#F4ECDF', g2, [0, 0.72, 0.28], [0.04, 0.72, 0.6], { live: true, cast: false }); T.boats.push({ g: g2, a, b, sp, ph }); };
        boat([-9, -5], [-19, -10], 0.035, 0); boat([8.5, -7], [17, -15], 0.03, 0.4); boat([9, 4], [21, 9], 0.04, 0.7); boat([-8, 7], [-17, 13], 0.032, 0.2);
        // 鄰島上空的雷雲
        const st = grp(scene, 22, 9, -20); const cm = new THREE.MeshLambertMaterial({ color: new THREE.Color('#4A4763'), flatShading: true, emissive: new THREE.Color('#BFD4FF'), emissiveIntensity: 0 });
        for (const [x, y, z, s] of [[0, 0, 0, 2.6], [2.2, 0.3, 0.6, 2.0], [-2.3, 0.2, -0.4, 2.1], [0.6, 0.9, -1.2, 1.7]]) K.put('ico', '', st, [x, y, z], [s, s * 0.6, s], { mat: cm, cast: false });
        T.storm = { g: st, mat: cm };
        // 流星
        const me = new THREE.Group(); scene.add(me); K.put('ico', '#FFE9B8', me, [0, 0, 0], [0.5, 0.5, 0.5], { live: true, cast: false, em: '#FFB45A', ei: 2 }); const tail = K.glow(me, [0, 0, 0], 5, '#ffb070', 0.9); T.meteor = { g: me, tail };
        // 天上的事件卡與光柱
        const cardTex = (hue, glyph) => K.tex(128, (c, s) => { c.fillStyle = '#F4ECDF'; c.fillRect(0, 0, s, s); c.fillStyle = hue; c.fillRect(8, 8, s - 16, s - 16); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; c.strokeRect(16, 16, s - 32, s - 32); c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); glyph(c, s); c.fill(); });
        const star = (c, s) => { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.11 : s * 0.25; c[i ? 'lineTo' : 'moveTo'](s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } };
        const drop = (c, s) => { c.moveTo(s / 2, s * 0.24); c.quadraticCurveTo(s * 0.76, s * 0.56, s / 2, s * 0.76); c.quadraticCurveTo(s * 0.24, s * 0.56, s / 2, s * 0.24); };
        const sun = (c, s) => { c.arc(s / 2, s / 2, s * 0.2, 0, Math.PI * 2); };
        [['#C9533D', star, -5], ['#3E5F74', drop, 0], ['#B98A4A', sun, 5]].forEach(([hue, gl, x], i) => { const m = new THREE.Mesh(K.G.plane, new THREE.MeshBasicMaterial({ map: cardTex(hue, gl), side: THREE.DoubleSide, transparent: true, opacity: 0 })); m.scale.set(3.4, 4.8, 1); m.position.set(x, 30, 5 + Math.abs(x) * 0.25); m.rotation.x = -1.15; scene.add(m); T.cards.push({ m, x, i }); });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 2.6, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        beam.position.set(0, 15, -0.4); scene.add(beam); T.beam = beam;
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.09, -0.4); scene.add(ring); T.ring = ring;
    }
    // 天空:星星、月亮、雲、螢火蟲
    function sky(K, scene, mobile, far) {
        const R = rng(7); const n = mobile ? 90 : 170; const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, e = 0.12 + R() * 1.1, r = far ? 150 : 60; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r * 0.75 + 2; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r - (far ? 0 : 12); }
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff3d6, size: far ? 0.9 : 0.36, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true })); scene.add(stars);
        const moon = grp(scene, far ? 60 : 13, far ? 46 : 12.5, far ? -110 : -22);
        const mm = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xfff0cf })); mm.scale.setScalar(far ? 7 : 1.7); moon.add(mm); K.glow(moon, [0, 0, 0], far ? 44 : 10, '#ffe2b0', 0.55);
        const clouds = [];
        const cl = (x, y, z, s, v) => { const g = grp(scene, x, y, z); const m = new THREE.MeshLambertMaterial({ color: new THREE.Color('#B9A9C9'), flatShading: true, transparent: true, opacity: 0.92 }); for (const [cx, cy, cz, cs] of [[0, 0, 0, 1], [1.1, 0.12, 0.2, 0.74], [-1.15, 0.05, -0.1, 0.8], [0.3, 0.42, -0.3, 0.62]]) { const b = new THREE.Mesh(K.G.ico, m); b.position.set(cx * s, cy * s, cz * s); b.scale.set(cs * s, cs * s * 0.55, cs * s * 0.8); b.castShadow = false; g.add(b); } clouds.push({ g, x, v }); };
        if (far) { cl(-34, 16, -30, 6, 0.5); cl(30, 20, 26, 7, 0.4); cl(8, 18, -52, 5.5, 0.6); cl(-40, 14, 30, 5, 0.45); }
        else { cl(-11, 8.2, -9, 1.9, 0.16); cl(10.5, 6.6, -12, 1.5, 0.12); cl(-3, 10.6, -16, 2.3, 0.1); cl(14.5, 9.4, -5, 1.2, 0.14); }
        const fn = mobile ? 14 : 30; const fp = new Float32Array(fn * 3); const fl = [];
        for (let i = 0; i < fn; i++) fl.push({ x: (R() - 0.5) * 12, z: (R() - 0.5) * 11, y: 0.5 + R() * 1.8, a: R() * 6.28, s: 0.3 + R() * 0.5 });
        const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
        const flies = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffe08a, size: 0.13, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(flies);
        return { stars, clouds, flies, fl, fp };
    }
    function lights(scene, mobile, far) {
        scene.add(new THREE.HemisphereLight(0xb9b3f0, 0x5a4c66, 1.75));
        const sun = new THREE.DirectionalLight(0xffc998, 2.3); sun.position.set(-9, 8, 7); sun.castShadow = !mobile && !far;
        sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -0.0006; scene.add(sun);
        const rim = new THREE.DirectionalLight(0x8fb2ff, 0.9); rim.position.set(8, 5, -9); scene.add(rim);
        const pl = new THREE.PointLight(0xffb866, 5, 7, 1.6); pl.position.set(0, 1.7, -0.6); scene.add(pl);
        return { sun, pl };
    }
    // 村民
    function people(scene, list, mobile) {
        return list.map((s, i) => {
            const m = VILLAGER3D.build({ aid: 'lp' + i, agent: { name: s.name, appear: { b: s.b, cls: s.cls, king: false, hl: false } }, pos: { job: s.job, gender: s.g } });
            m.scale.multiplyScalar(0.86); m.traverse(o => { if (o.isMesh) o.castShadow = !mobile; });
            scene.add(m);
            const part = (n) => m.children.find(c => c.name === n);
            const [x, z] = SPOT[s.home] || [0, 0];
            m.position.set(x, 0, z);
            return { m, s, i, tx: x, tz: z, ry: 0, armR: part('armR'), armL: part('armL'), legL: part('legL'), legR: part('legR'), ph: i * 1.7, blink: 40 + i * 37, look: null, busy: false, act: null, next: 2 + i * 1.3, walk: 0, tall: s.b === 'c' ? 0.7 : 1 };
        });
    }
    const turn = (f, target, k) => { f.m.rotation.y += (((target - f.m.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k; };
    // 每一格:走路、呼吸、眨眼、手勢
    function animate(folks, t, dt, frame, still) {
        for (const f of folks) {
            const dx = f.tx - f.m.position.x, dz = f.tz - f.m.position.z, d = Math.hypot(dx, dz);
            const ud = f.m.userData; if (ud.eyes) { const shut = !still && ((frame + f.blink) % 190) < 6; ud.eyes.visible = !shut; ud.lids.visible = shut; }
            if (d > 0.06 && !still) {
                const step = Math.min(d, (f.busy ? 2.4 : 1.2) * dt); f.m.position.x += dx / d * step; f.m.position.z += dz / d * step;
                turn(f, Math.atan2(dx, dz), 0.2); f.walk += dt * 9;
                const sw = Math.sin(f.walk) * 0.7;
                if (f.legL) f.legL.rotation.x = sw; if (f.legR) f.legR.rotation.x = -sw;
                if (f.armL) f.armL.rotation.x = -sw * 0.7; if (f.armR) f.armR.rotation.x = sw * 0.7;
                f.m.position.y = Math.abs(Math.sin(f.walk)) * 0.045; f.m.rotation.x = 0;
                continue;
            }
            const br = still ? 0 : Math.sin(t * 2.2 + f.ph);
            if (f.legL) f.legL.rotation.x *= 0.7; if (f.legR) f.legR.rotation.x *= 0.7;
            let y = Math.max(0, br) * 0.02, ar = br * 0.05, al = -br * 0.05, tilt = 0, wob = 0;
            if (f.act === 'think') { ar = -2.5 + Math.sin(t * 3) * 0.08; wob = Math.sin(t * 1.4) * 0.12; }
            else if (f.act === 'talk') { ar = -0.8 + Math.sin(t * 6) * 0.28; }
            else if (f.act === 'give') { ar = -1.35; }
            else if (f.act === 'take') { ar = -1.2; al = -1.2; }
            else if (f.act === 'bow') { tilt = 0.42; ar = 0.25; al = 0.25; }
            else if (f.act === 'no') { wob = Math.sin(t * 9) * 0.32; ar = -0.3; al = -0.3; }
            else if (f.act === 'hold') { ar = -0.5; al = -0.5; tilt = 0.08; }
            else if (f.act === 'cheer') { y = Math.abs(Math.sin(t * 7)) * 0.16; ar = -2.7; al = -2.7; }
            else if (f.act === 'nod') { tilt = 0.1 + Math.sin(t * 6) * 0.1; }
            f.m.position.y = y; f.m.rotation.x += (tilt - f.m.rotation.x) * 0.15;
            if (f.armR) f.armR.rotation.x += (ar - f.armR.rotation.x) * 0.25; if (f.armL) f.armL.rotation.x += (al - f.armL.rotation.x) * 0.25;
            const face = f.look ? Math.atan2(f.look.m.position.x - f.m.position.x, f.look.m.position.z - f.m.position.z) : f.ry;
            turn(f, face + wob, 0.1);
        }
    }
    // 環境:樹搖、旗飄、燈閃、煙、雲、螢火蟲
    function ambient(T, S, t, dt) {
        for (const s of T.sway) { s.top.rotation.z = Math.sin(t * 0.9 + s.ph) * 0.035; s.top.rotation.x = Math.cos(t * 0.7 + s.ph) * 0.025; }
        for (const f of T.flags) { f.rotation.y = Math.sin(t * 2.2) * 0.35; f.children[0].rotation.y = Math.sin(t * 4.1) * 0.25; }
        for (const g of T.glows) g.sp.material.opacity = g.base * (0.86 + Math.sin(t * 3.1 + g.ph) * 0.09 + Math.sin(t * 7.3 + g.ph * 2) * 0.05);
        T.lit.forEach((m, i) => { m.emissiveIntensity = 0.92 + Math.sin(t * 1.7 + i * 2.1) * 0.12; });
        for (const p of T.puffs) { const k = (t * 0.16 + p.ph) % 1; p.m.position.set(p.p.x + Math.sin(k * 5 + p.ph * 9) * 0.16 + k * 0.5, p.p.y + k * 1.9, p.p.z); const s = 0.07 + k * 0.2; p.m.scale.set(s, s * 0.8, s); p.m.material.opacity = 0.34 * (1 - k) * Math.min(1, k * 8); }
        for (const c of S.clouds) { c.g.position.x += c.v * dt; if (c.g.position.x > c.x + 60) c.g.position.x = c.x - 60; }
        const a = S.fp; S.fl.forEach((f, i) => { a[i * 3] = f.x + Math.sin(t * f.s + f.a) * 0.7; a[i * 3 + 1] = f.y + Math.sin(t * f.s * 1.7 + f.a * 2) * 0.35; a[i * 3 + 2] = f.z + Math.cos(t * f.s * 0.8 + f.a) * 0.7; });
        S.flies.geometry.attributes.position.needsUpdate = true; S.flies.material.opacity = 0.6 + Math.sin(t * 2.6) * 0.3;
    }

    // ---------- 共用的畫面外殼:建立畫布、依可見性暫停、清理 ----------
    function shell(host, cls, build) {
        const still = reduced(), mobile = small();
        const canvas = document.createElement('canvas'); canvas.className = cls; canvas.setAttribute('aria-hidden', 'true');
        let renderer;
        try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'low-power' }); } catch (e) { return null; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
        if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = !mobile; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        host.querySelector('.lp-stage-ph')?.remove(); host.prepend(canvas);
        const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 600);
        const st = { host, canvas, renderer, scene, cam, still, mobile, alive: true, visible: true, raf: 0, frame: 0, last: 0, t0: performance.now(), w: 1, h: 1, els: [] };
        const impl = build(st);
        const resize = () => { st.w = canvas.clientWidth || host.clientWidth || 600; st.h = canvas.clientHeight || host.clientHeight || 420; renderer.setSize(st.w, st.h, false); cam.aspect = st.w / st.h; impl.resize?.(); cam.updateProjectionMatrix(); };
        resize();
        const tick = (now) => {
            st.raf = 0; if (!st.alive) return;
            if (now - st.last < (mobile ? 30 : 14)) { schedule(); return; }
            const dt = Math.min(0.06, (now - (st.last || now)) / 1000); st.last = now; st.frame++;
            impl.frame((now - st.t0) / 1000, dt);
            renderer.render(scene, cam); impl.after?.();
            if (!still) schedule();
        };
        const schedule = () => { if (!st.raf && st.visible && !document.hidden && st.alive) st.raf = requestAnimationFrame(tick); };
        st.kick = () => { if (still) { if (!st.raf) st.raf = requestAnimationFrame(tick); } else schedule(); };
        try { st.io = new IntersectionObserver(es => { st.visible = es.some(e => e.isIntersecting); host.classList.toggle('lp-stage-idle', !st.visible); schedule(); }, { rootMargin: '80px' }); st.io.observe(host); } catch (e) {}
        st.onVis = () => schedule(); document.addEventListener('visibilitychange', st.onVis);
        let rt = 0; st.onResize = () => { clearTimeout(rt); rt = setTimeout(() => { resize(); st.kick(); }, 120); }; window.addEventListener('resize', st.onResize);
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); kill(st); impl.lost?.(); });
        st.impl = impl; live.add(st); host.classList.add('lp-stage-live');
        requestAnimationFrame(tick);
        return st;
    }
    function kill(st) {
        if (!st || !st.alive) return; st.alive = false; live.delete(st);
        try { if (st.raf) cancelAnimationFrame(st.raf); st.io?.disconnect(); document.removeEventListener('visibilitychange', st.onVis); window.removeEventListener('resize', st.onResize); st.impl?.dispose?.(); } catch (e) {}
        try { st.els.forEach(e => e.remove()); st.scene.traverse(o => { if (o.isMesh || o.isPoints) o.geometry?.dispose?.(); }); st.renderer.dispose(); st.renderer.forceContextLoss?.(); st.canvas.remove(); } catch (e) {}
        st.host.classList.remove('lp-stage-live');
    }
    const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
    const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // ---------- 首屏:小鎮＋決定輪播 ----------
    function fallback(host) {
        if (!host) return; host.classList.add('lp-stage-fallback');
        const L = zh() ? 'zh' : 'en';
        host.innerHTML = `<img src="img/landing/proposals-${L}.jpg" width="1280" height="760" alt="${zh() ? '遊戲畫面' : 'Game screenshot'}" loading="lazy">`;
    }
    // 決定卡的內容(也給沒有 WebGL、或測試時直接取用)
    function cardHtml(d) {
        const ix = zh() ? 0 : 1, c = CAST[d.who];
        return `<div class="lp-dc-head"><b class="lp-dc-name">${esc(ix ? c.en : c.name)}</b><span class="lp-dc-job">${esc(ix ? c.je : c.jz)}</span><span class="lp-dc-kind">${esc(d.kind[ix])}</span></div>
            <p class="lp-dc-sit">${esc(d.sit[ix])}</p>
            <ul class="lp-dc-opts">${d.opts.map((o, i) => `<li class="${i === d.pick ? 'pick' : ''}" style="--i:${i}">${esc(o[ix])}</li>`).join('')}</ul>
            <p class="lp-dc-why">${ix ? '"' : '「'}${esc(d.why[ix])}${ix ? '"' : '」'}</p>
            <p class="lp-dc-res">${esc(d.res[ix])}</p>`;
    }
    function hero(host) {
        return shell(host, 'lp-stage-canvas', (st) => {
            const { scene, cam, still, mobile } = st; const K = kit();
            const T = town(K, scene, { full: false }); const S = sky(K, scene, mobile, false); lights(scene, mobile, false);
            const folks = people(scene, CAST, mobile); const R = rng(41);
            folks.forEach(f => { f.ry = Math.atan2(-f.m.position.x * 0.3, 8 - f.m.position.z); f.m.rotation.y = f.ry; });
            // 錢幣(借錢時從一個人飛到另一個人)與腳下的光圈
            const coin = new THREE.Mesh(K.G.cyl12, new THREE.MeshLambertMaterial({ color: new THREE.Color('#F7C948'), emissive: new THREE.Color('#F2A65A'), emissiveIntensity: 0.8 })); coin.scale.set(0.13, 0.04, 0.13); coin.rotation.x = Math.PI / 2; coin.visible = false; scene.add(coin);
            const coinGlow = K.glow(coin, [0, 0, 0], 6, '#ffd070', 0.9);
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 28), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; scene.add(ring);
            // 畫面上的字:頭上的名牌、決定卡
            const tag = el('div', 'lp-tag'); const card = el('div', 'lp-dc'); card.setAttribute('aria-hidden', 'true'); tag.setAttribute('aria-hidden', 'true');
            const dots = el('div', 'lp-dc-dots', DECISIONS.map(() => '<i></i>').join('')); dots.setAttribute('aria-hidden', 'true');
            host.append(tag, card, dots); st.els.push(tag, card, dots);
            const D = { i: -1, t0: 0, cur: null, ph: -1, prepped: -1 };
            const CYCLE = 11.6, mark = (d, k) => { const [x, z] = SPOT[d.at]; return k ? [x + 0.62, z + 0.12] : [x - 0.5, z]; };
            const prep = (i) => { const d = DECISIONS[i % DECISIONS.length]; const a = folks[d.who]; a.busy = true; [a.tx, a.tz] = mark(d, 0); if (d.to != null) { const b = folks[d.to]; b.busy = true; [b.tx, b.tz] = mark(d, 1); } D.prepped = i; };
            const phase = (n) => { if (D.ph === n) return; D.ph = n; card.className = 'lp-dc on p' + n; };
            const begin = (i, t) => {
                D.i = i; D.t0 = t; const d = D.cur = DECISIONS[i % DECISIONS.length]; const a = folks[d.who], b = d.to != null ? folks[d.to] : null;
                card.innerHTML = cardHtml(d); D.ph = -1; phase(1); tag.textContent = zh() ? a.s.name : a.s.en; tag.classList.add('on');
                [...dots.children].forEach((x, k) => x.classList.toggle('on', k === i % DECISIONS.length));
                a.act = 'think'; if (b) { a.look = b; b.look = a; b.act = null; } else a.look = null;
            };
            const end = () => { const d = D.cur; if (!d) return; for (const k of [d.who, d.to]) if (k != null) { const f = folks[k]; f.busy = false; f.act = null; f.look = null; f.next = D.t0 + 9 + k * 0.7; f.ry = Math.atan2(-f.m.position.x * 0.3, 8 - f.m.position.z); } card.classList.remove('on'); tag.classList.remove('on'); coin.visible = false; D.cur = null; };
            const wander = (t) => { for (const f of folks) { if (f.busy || t < f.next) continue; const taken = new Set(folks.map(o => o.tx.toFixed(1) + o.tz.toFixed(1))); for (let n = 0; n < 6; n++) { const [x, z] = SPOT[WANDER[Math.floor(R() * WANDER.length)]]; const px = x + (R() - 0.5) * 0.7, pz = z + (R() - 0.5) * 0.7; if (!taken.has(px.toFixed(1) + pz.toFixed(1))) { f.tx = px; f.tz = pz; break; } } f.next = t + 6 + R() * 9; f.ry = Math.atan2(-f.tx * 0.3, 8 - f.tz); } };
            const v = new THREE.Vector3(); const focus = new THREE.Vector3(0, 0.9, -0.3); const px = { x: 0, y: 0, tx: 0, ty: 0 };
            const onMove = (e) => { const r = host.getBoundingClientRect(); px.tx = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5); px.ty = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5); };
            if (!mobile && !still) window.addEventListener('pointermove', onMove, { passive: true });
            const shift = () => parseFloat(getComputedStyle(host).getPropertyValue('--lp-shift')) || 0;
            let sh = 0, lift = 0, lastTf = '';
            prep(0); for (const f of folks) { f.m.position.x = f.tx; f.m.position.z = f.tz; }
            if (still) { begin(0, 0); phase(5); const d = D.cur; folks[d.who].act = 'take'; if (d.to != null) folks[d.to].act = 'give'; for (const f of folks) if (f.look) f.m.rotation.y = Math.atan2(f.look.m.position.x - f.m.position.x, f.look.m.position.z - f.m.position.z); }
            return {
                resize() { sh = shift(); lift = parseFloat(getComputedStyle(host).getPropertyValue('--lp-lift')) || 0; const narrow = st.w / st.h < 1.05; cam.fov = narrow ? 44 : 30; if (sh || lift) cam.setViewOffset(st.w, st.h, -st.w * sh, st.h * lift, st.w, st.h); else cam.clearViewOffset(); },
                frame(t, dt) {
                    if (!still) {
                        const i = Math.floor(t / CYCLE), s = t - i * CYCLE;
                        if (D.prepped < i) prep(i);
                        if (s >= 1.4 && D.i < i) begin(i, t);
                        if (D.cur && D.i === i) {
                            const u = t - D.t0, d = D.cur, a = folks[d.who], b = d.to != null ? folks[d.to] : null;
                            if (u > 1.5) phase(2); if (u > 3.5) phase(3);
                            if (u > 4.2) { phase(4);
                                if (d.fx === 'coin') { const from = folks[d.from], to = folks[d.dest]; from.act = u < 6.4 ? 'give' : 'nod'; to.act = u < 5.6 ? 'talk' : (u < 7.6 ? 'take' : 'cheer');
                                    const k = clamp((u - 5.0) / 1.1, 0, 1); coin.visible = k > 0 && k < 1; if (coin.visible) { const e = ease(k); coin.position.set(lerp(from.m.position.x, to.m.position.x, e), 0.95 + Math.sin(e * Math.PI) * 0.95, lerp(from.m.position.z, to.m.position.z, e)); coin.rotation.z = t * 9; coinGlow.material.opacity = 0.9 * Math.sin(k * Math.PI); } }
                                else if (d.fx === 'bow') { a.act = u < 6.6 ? 'bow' : 'nod'; if (b) b.act = u > 6.0 ? 'nod' : null; }
                                else if (d.fx === 'no') { a.act = u < 6.2 ? 'no' : null; if (b) b.act = u > 5.2 && u < 7 ? 'hold' : null; }
                                else if (d.fx === 'hold') { a.act = 'hold'; }
                            }
                            if (u > 5.6) phase(5);
                            if (u > 8.5) { end(); prep(i + 1); }
                            ring.position.x = a.m.position.x; ring.position.z = a.m.position.z; ring.material.opacity = 0.55 + Math.sin(t * 4) * 0.2; const rs = 1 + Math.sin(t * 2) * 0.08; ring.scale.set(rs, rs, 1);
                        } else ring.material.opacity *= 0.85;
                        wander(t);
                    } else if (D.cur) { const a = folks[D.cur.who]; ring.position.x = a.m.position.x; ring.position.z = a.m.position.z; ring.material.opacity = 0.6; }
                    animate(folks, t, dt, st.frame, still); ambient(T, S, still ? 0 : t, dt);
                    // 鏡頭:慢慢左右繞,游標帶一點視差;有人在做決定時,往那邊靠一點
                    px.x += (px.tx - px.x) * 0.05; px.y += (px.ty - px.y) * 0.05;
                    const az = 0.2 + (still ? 0 : Math.sin(t * 0.11) * 0.2) + px.x * 0.16, rad = (cam.fov > 40 ? 30 : 31), hgt = 10.4 - px.y * 1.4;
                    const tgt = D.cur ? folks[D.cur.who].m.position : null;
                    focus.x += ((tgt ? tgt.x * 0.4 : 0) - focus.x) * 0.03; focus.z += ((tgt ? tgt.z * 0.4 - 0.2 : -0.3) - focus.z) * 0.03;
                    cam.position.set(focus.x + Math.sin(az) * rad, hgt, focus.z + Math.cos(az) * rad); cam.lookAt(focus.x, 0.9, focus.z);
                },
                after() {
                    if (!D.cur) return; const f = folks[D.cur.who];
                    v.set(f.m.position.x, f.m.position.y + 1.72 * f.tall, f.m.position.z).project(cam);
                    const tf = `translate(${Math.round((v.x * 0.5 + 0.5) * st.w)}px, ${Math.round((-v.y * 0.5 + 0.5) * st.h)}px) translate(-50%, -100%)`; if (tf !== lastTf) { lastTf = tf; tag.style.transform = tf; } // 位置沒變就不寫,少一次版面更新
                },
                dispose() { window.removeEventListener('pointermove', onMove); },
                lost() { fallback(host); },
                folks, D,
            };
        });
    }

    // ---------- 從一個人到整個世界:鏡頭隨捲動拉遠 ----------
    // 七個鏡位:眼睛位置、看向哪裡。0 一個人、1 人與人、2 討生活、3 誰說了算、4 小鎮長大、5 世界、6 你
    const VIEWS = [
        [[0.6, 2.05, 2.2], [-3.35, 0.85, -0.75]], [[1.75, 3.3, 8.7], [-1.95, 0.8, 1.9]], [[-1.0, 2.8, -0.2], [2.8, 0.9, 2.6]], [[7.0, 4.2, 3.2], [0, 1.25, -2.5]],
        [[11, 10.5, 19], [0, 0.6, -0.4]], [[22, 30, 54], [0, -1, -5]], [[0.5, 58, 20], [0, 0, 0]],
    ];
    // 誰站哪裡:CAST 索引、位置、看向誰(索引)或固定朝向(弧度)、手勢
    const SCALE_CAST = [
        [6, [-3.35, -0.75], 1.02, 'think'], // 0 一個人:站在家門口想事情
        [3, [-2.4, 1.95], [4], 'talk'], [4, [-1.5, 2.1], [3], 'nod'], // 1 人與人:井邊聊天
        [1, [3.04, 1.98], [0], 'give'], [0, [2.56, 3.35], [1], 'take'], // 2 討生活:攤位買賣(賣的人在櫃檯後面)
        [5, [0, -2.75], 0.9, 'talk'], [2, [-0.7, -1.5], [5], null], [7, [0.5, -1.25], [5], 'cheer'], // 3 誰說了算:鎮公所前
    ];
    function scale(host, opts) {
        return shell(host, 'lp-scale-canvas', (st) => {
            const { scene, cam, still, mobile } = st; const K = kit();
            const T = town(K, scene, { full: true }); const S = sky(K, scene, mobile, true); lights(scene, mobile, true);
            const folks = people(scene, CAST, mobile);
            SCALE_CAST.forEach(([ci, [x, z], face, act]) => { const f = folks[ci]; f.m.position.set(x, 0, z); f.tx = x; f.tz = z; f.act = act; f.face = face; });
            folks.forEach(f => { f.look = Array.isArray(f.face) ? folks[f.face[0]] : null; f.ry = typeof f.face === 'number' ? f.face : 0; f.m.rotation.y = f.look ? Math.atan2(f.look.m.position.x - f.m.position.x, f.look.m.position.z - f.m.position.z) : f.ry; });
            const coin = new THREE.Mesh(K.G.cyl12, new THREE.MeshLambertMaterial({ color: new THREE.Color('#F7C948'), emissive: new THREE.Color('#F2A65A'), emissiveIntensity: 0.9 })); coin.scale.set(0.12, 0.04, 0.12); coin.rotation.x = Math.PI / 2; scene.add(coin);
            const ballot = K.put('box', '#F4ECDF', scene, [0, 0, 0], [0.16, 0.2, 0.02], { live: true, cast: false }); K.put('box', '#8C5A3C', scene, [1.35, 0.28, -2.2], [0.5, 0.42, 0.4]); K.put('box', '#3B2A20', scene, [1.35, 0.5, -2.2], [0.3, 0.03, 0.06], { cast: false });
            scene.fog = new THREE.Fog(0x1a1830, 90, 260);
            const eye = new THREE.Vector3(), at = new THREE.Vector3(), a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), b0 = new THREE.Vector3(), b1 = new THREE.Vector3(); let p = 0, shown = -1, narrow = false;
            const BACK = [1.45, 1.4, 1.45, 1.35, 1.25, 1.2, 1.1]; // 直式畫面各鏡位退後的倍數
            const key = (i, e, a) => { a.fromArray(VIEWS[i][1]); e.fromArray(VIEWS[i][0]); if (narrow) e.sub(a).multiplyScalar(BACK[i]).add(a); };
            const prog = () => { try { return clamp(+opts.progress() || 0, 0, VIEWS.length - 1); } catch (e) { return 0; } };
            return {
                resize() { narrow = st.w / st.h < 0.9; cam.fov = narrow ? 46 : 32; const cs = getComputedStyle(host), lift = parseFloat(cs.getPropertyValue('--lp-lift')) || 0, sh = parseFloat(cs.getPropertyValue('--lp-shift')) || 0; if (lift || sh) cam.setViewOffset(st.w, st.h, -st.w * sh, st.h * lift, st.w, st.h); else cam.clearViewOffset(); },
                frame(t, dt) {
                    const want = prog(); p = still ? want : p + (want - p) * Math.min(1, dt * 4.5);
                    const i = Math.min(VIEWS.length - 2, Math.floor(p)), k = ease(p - i);
                    key(i, a0, b0); key(i + 1, a1, b1); eye.lerpVectors(a0, a1, k); at.lerpVectors(b0, b1, k);
                    const dr = still ? 0 : Math.sin(t * 0.25) * 0.02 * eye.length();
                    cam.position.set(eye.x + dr, eye.y, eye.z); cam.lookAt(at);
                    animate(folks, t, dt, st.frame, still); ambient(T, S, still ? 0 : t, dt);
                    // 2 討生活:錢在買賣雙方之間來回
                    const c = (t * 0.45) % 1, s = folks[1].m.position, b = folks[0].m.position, e = ease(c);
                    coin.visible = p > 1.3 && p < 2.9; coin.position.set(lerp(b.x, s.x, e), 0.95 + Math.sin(e * Math.PI) * 0.7, lerp(b.z, s.z, e)); coin.rotation.z = t * 8;
                    // 3 誰說了算:選票一張張投進票箱
                    const bk = (t * 0.6) % 1; ballot.visible = p > 2.4 && p < 3.8; ballot.position.set(lerp(0.5, 1.35, ease(bk)), 0.95 + Math.sin(bk * Math.PI) * 0.6 - bk * 0.4, lerp(-1.25, -2.2, ease(bk))); ballot.rotation.z = bk * 3;
                    // 4 小鎮長大:多的房子一棟棟長出來
                    T.grow.forEach((h, n) => { const g = ease((p - 3.35 - n * 0.12) / 0.5); h.scale.setScalar(Math.max(0.001, g * (1 + Math.sin(g * Math.PI) * 0.12))); });
                    // 5 世界:船來回、雷雲閃電、流星
                    for (const bo of T.boats) { const u = (Math.sin(t * bo.sp * 6.28 + bo.ph * 6.28) + 1) / 2; bo.g.position.set(lerp(bo.a[0], bo.b[0], u), -2.45 + Math.sin(t * 1.4 + bo.ph * 9) * 0.05, lerp(bo.a[1], bo.b[1], u)); bo.g.rotation.y = Math.atan2(bo.b[0] - bo.a[0], bo.b[1] - bo.a[1]) + (Math.cos(t * bo.sp * 6.28 + bo.ph * 6.28) < 0 ? Math.PI : 0); }
                    if (T.storm) T.storm.mat.emissiveIntensity = still ? 0 : (Math.sin(t * 13) > 0.94 || Math.sin(t * 7.3 + 1) > 0.985 ? 1.3 : 0);
                    if (T.meteor) { const m = ((t * 0.09) % 1), vis = p > 4.4 && !still; T.meteor.g.visible = vis && m < 0.35; const q = m / 0.35; T.meteor.g.position.set(lerp(-46, -14, q), lerp(44, 12, q), lerp(-30, -44, q)); T.meteor.tail.material.opacity = 0.9 * Math.sin(q * Math.PI); }
                    // 6 你:天上的事件卡、照向小鎮的光、落下後一圈圈散開
                    const g6 = ease((p - 5.25) / 0.6);
                    for (const cd of T.cards) { cd.m.material.opacity = g6; cd.m.position.y = 29.5 + Math.sin(t * 0.9 + cd.i * 2) * 0.5; cd.m.rotation.z = Math.sin(t * 0.6 + cd.i) * 0.08 + cd.x * -0.03; }
                    if (T.beam) T.beam.material.opacity = g6 * (0.16 + Math.sin(t * 1.6) * 0.04);
                    if (T.ring) { const rk = (t * 0.33) % 1; const rr = 1 + rk * 9; T.ring.scale.set(rr, rr, 1); T.ring.material.opacity = g6 * (1 - rk) * 0.7; }
                    const step = Math.round(p); if (step !== shown) { shown = step; try { opts.onStep?.(step); } catch (e2) {} }
                },
                lost() { host.classList.add('lp-stage-fallback'); },
                folks, get p() { return p; },
            };
        });
    }

    // ---------- 對外 ----------
    let heroSt = null, scaleSt = null;
    function mount(host) {
        if (!host || heroSt?.host === host) return; if (heroSt) { kill(heroSt); heroSt = null; }
        const token = heroSt = { host, pending: true };
        const go = () => { if (heroSt !== token) return; ensure().then(() => { if (heroSt !== token) return; const s = hero(host); if (s) heroSt = s; else { heroSt = null; fallback(host); } }).catch(() => { if (heroSt === token) { heroSt = null; fallback(host); } }); };
        if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 300);
    }
    // 捲到附近才建第二個場景,不搶首屏
    function mountScale(host, opts) {
        if (!host || scaleSt?.host === host) return; if (scaleSt) { kill(scaleSt); scaleSt = null; }
        const token = scaleSt = { host, pending: true };
        const go = () => { if (scaleSt !== token) return; ensure().then(() => { if (scaleSt !== token) return; const s = scale(host, opts || {}); if (s) scaleSt = s; else { scaleSt = null; host.classList.add('lp-stage-fallback'); } }).catch(() => { if (scaleSt === token) { scaleSt = null; host.classList.add('lp-stage-fallback'); } }); };
        let io = null;
        try { io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { root: opts?.root || null, rootMargin: '900px 0px' }); io.observe(host); token.io = io; } catch (e) { go(); }
    }
    function unmount() {
        for (const s of [heroSt, scaleSt]) { if (!s) continue; if (s.pending) s.io?.disconnect(); else kill(s); }
        heroSt = null; scaleSt = null;
    }
    return { mount, mountScale, unmount, cardHtml, CAST, DECISIONS, VIEWS, get hero() { return heroSt; }, get scale() { return scaleSt; } };
})();

// ============================================================
// RimTown 方塊村民 3D 模型(v6.98.0 從 town3d.js 抽出)
// 遊戲(town3d.js)與首頁(landing-3d.js)共用同一套長相:名字決定髮型、五官、配件、衣服、身材;依年齡與貧富換外觀
// 只依賴 three.js;職業配色與自訂外觀常數也搬到這裡(tilemap.js 會用到,必須比它早載入)
// ============================================================
// Agent sprite colors by job — chibi style palette
// {body, bodyDk, accent, hair, hairDk, hairLt, pants, boots, skin}
// v5.89.0 村民自訂外觀選項(agent.look = { skin, hair, hairColor, shirt, acc };沒設定就照名字雜湊的預設)
const LOOK_SKINS = ['#fce4c8', '#f6ddbe', '#eecca4', '#e0bc98', '#cda074', '#b88458'];
const LOOK_HAIR_COLORS = ['#241812', '#3f2810', '#5a3a1a', '#754824', '#9a6a2a', '#c8a860', '#8c8c92', '#33263f', '#6a2a1a'];
const LOOK_SHIRTS = ['#c62828', '#ef6c00', '#f9a825', '#2e7d32', '#00838f', '#1565c0', '#6a1b9a', '#eceff1'];
function lookSig(look) { return look ? `${look.skin ?? ''}.${look.hair ?? ''}.${look.hairColor ?? ''}.${look.shirt ?? ''}.${look.acc ?? ''}` : ''; }

const JOB_COLORS = {
    mayor:     { body:'#c83040', bodyDk:'#a02030', accent:'#ffd700', hair:'#4a3530', hairDk:'#352520', hairLt:'#6a5550', pants:'#b89060', boots:'#6b4226', skin:'#fce4c8' },
    doctor:    { body:'#e8e8f0', bodyDk:'#c8c8d8', accent:'#e53935', hair:'#5a3a1a', hairDk:'#3a2510', hairLt:'#7a5a3a', pants:'#ddd', boots:'#a88a8a', skin:'#fce4c8' },
    blacksmith:{ body:'#607080', bodyDk:'#485868', accent:'#a08060', hair:'#222', hairDk:'#111', hairLt:'#444', pants:'#555', boots:'#4a3020', skin:'#f0d8b8' },
    cook:      { body:'#e88030', bodyDk:'#c06820', accent:'#fff', hair:'#4a2a0a', hairDk:'#301808', hairLt:'#6a4a2a', pants:'#f0e0c0', boots:'#8b6e4e', skin:'#fce4c8' },
    farmer:    { body:'#6a9a40', bodyDk:'#508030', accent:'#d4b896', hair:'#6b4226', hairDk:'#4a2e18', hairLt:'#8b6246', pants:'#8b7355', boots:'#6b4226', skin:'#f0d8b8' },
    trader:    { body:'#8030a0', bodyDk:'#602080', accent:'#ffd54f', hair:'#1a1a2a', hairDk:'#0a0a18', hairLt:'#3a3a5a', pants:'#555', boots:'#4a3a2a', skin:'#fce4c8' },
    guard:     { body:'#3a5060', bodyDk:'#283848', accent:'#90a4ae', hair:'#222', hairDk:'#111', hairLt:'#444', pants:'#3a4a58', boots:'#2a2a2a', skin:'#f0d8b8' },
    researcher:{ body:'#2868b8', bodyDk:'#1848a0', accent:'#90caf9', hair:'#4a3a2a', hairDk:'#302818', hairLt:'#6a5a4a', pants:'#556080', boots:'#4a4050', skin:'#fce4c8' },
    miner:     { body:'#6a5040', bodyDk:'#504030', accent:'#ffd54f', hair:'#333', hairDk:'#1a1a1a', hairLt:'#555', pants:'#5a4a3a', boots:'#3a2a1a', skin:'#f0d8b8' },
    priest:    { body:'#f0e070', bodyDk:'#d0c050', accent:'#fff', hair:'#5a3a1a', hairDk:'#3a2510', hairLt:'#7a5a3a', pants:'#e0d0a0', boots:'#a08858', skin:'#fce4c8' },
    carpenter: { body:'#907060', bodyDk:'#706050', accent:'#c09070', hair:'#4a2a0a', hairDk:'#301808', hairLt:'#6a4a2a', pants:'#686058', boots:'#4a3828', skin:'#f0d8b8' },
    tailor:    { body:'#d06080', bodyDk:'#b04868', accent:'#ffb6c1', hair:'#1a1a2a', hairDk:'#0a0a18', hairLt:'#3a3a5a', pants:'#c0a0a0', boots:'#8a6a6a', skin:'#fce4c8' },
    player:    { body:'#00b8d0', bodyDk:'#0098b0', accent:'#b0f0ff', hair:'#e0e8f0', hairDk:'#b0b8c0', hairLt:'#fff', pants:'#4a7080', boots:'#3a5060', skin:'#fce4c8' },
    default:   { body:'#8090a0', bodyDk:'#607080', accent:'#b0c0d0', hair:'#555', hairDk:'#333', hairLt:'#777', pants:'#686868', boots:'#484848', skin:'#f0d8b8' },
};

const VILLAGER3D = (() => {
    const hash2 = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const shadeHex = (hex, amt) => { const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)))); return '#' + [f(n >> 16 & 255), f(n >> 8 & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join(''); };
    // 依名字決定膚色、髮色、衣服深淺(自訂外觀優先);shade 可傳入遊戲原本的調色函式,結果才會一模一樣
    function variedColors(base, name, look, shade) {
        const sh = shade || shadeHex; name = String(name || '');
        let h = 2166136261; for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = (h * 16777619) >>> 0; }
        const SKINS = LOOK_SKINS, HAIRS = LOOK_HAIR_COLORS;
        const skin = (look && look.skin != null && LOOK_SKINS[look.skin]) || SKINS[h % SKINS.length];
        const hair = (look && look.hairColor != null && LOOK_HAIR_COLORS[look.hairColor]) || HAIRS[(h >>> 3) % HAIRS.length];
        const bJit = (((h >>> 6) % 5) - 2) * 0.05, pJit = (((h >>> 10) % 3) - 1) * 0.06;
        const shirt = look && look.shirt != null ? LOOK_SHIRTS[look.shirt] : null;
        return { ...base, skin, hair, hairDk: sh(hair, -0.38), hairLt: sh(hair, 0.32),
            body: shirt || sh(base.body, bJit), bodyDk: shirt ? sh(shirt, -0.3) : sh(base.bodyDk, bJit), pants: sh(base.pants, pJit) };
    }
    // 方塊零件 [w,h,d,hex,x,y,z] 併成一個頂點色網格(首頁用;遊戲傳入自己的 partMesh,可共用材質與遠處簡化)
    let unitBox = null, vcMat = null;
    const box = () => unitBox || (unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed());
    function partMesh(boxes) {
        const up = box().attributes.position, un = box().attributes.normal, n = up.count;
        const pos = new Float32Array(boxes.length * n * 3), nor = new Float32Array(boxes.length * n * 3), col = new Float32Array(boxes.length * n * 3);
        const c = new THREE.Color(); let o = 0;
        for (const b of boxes) { c.set(b[3]); for (let k = 0; k < n; k++) { pos[o] = up.getX(k) * b[0] + b[4]; pos[o + 1] = up.getY(k) * b[1] + b[5]; pos[o + 2] = up.getZ(k) * b[2] + b[6]; nor[o] = un.getX(k); nor[o + 1] = un.getY(k); nor[o + 2] = un.getZ(k); col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; o += 3; } }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const m = new THREE.Mesh(g, vcMat || (vcMat = new THREE.MeshLambertMaterial({ vertexColors: true }))); m.castShadow = true; m.userData.ownGeo = true; return m;
    }
    // 做一個村民:o = { aid, agent:{name, look, gender, appear}, pos:{job, gender}, c(配色,可省略), partMesh, box, mat }
    // 回傳 THREE.Group,子物件 legL/legR/armL/armR(可擺動)、userData.eyes/lids(眨眼)、tool、lodParts(遠處簡化用)
    function build(o) {
        const aid = o.aid || 'v', agent = o.agent || {}, pos = o.pos || {};
        const P = o.partMesh || partMesh, BOX = o.box || box, MAT = o.mat || ((hex, opts) => new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(hex) }, opts || {})));
        const jobKey = pos.job || agent.job?.key || 'default';
        const c = o.c ? { ...o.c } : variedColors(JOB_COLORS[jobKey] || JOB_COLORS.default, agent.name || aid, agent.look || null);
        const ap = agent.appear || null;
        const m = new THREE.Group();
        const female = (pos.gender || agent.gender) === 'female';
        const shade = (hex, k) => { const x = new THREE.Color(hex); x.multiplyScalar(k); return '#' + x.getHexString(); };
        // v6.92.0 依年齡與貧富換外觀
        const mix = (hex, to, k) => { const x = new THREE.Color(hex); x.lerp(new THREE.Color(to), k); return '#' + x.getHexString(); };
        const ab = ap?.b || 'a', cls = ap?.cls ?? 1, child = ab === 'c', poor = cls === 0 || !!ap?.hl, king = !!ap?.king;
        if (ab === 'e') c.hair = mix(c.hair, '#BDBDBD', 0.75); else if (ab === 'o') c.hair = '#ECECEC';
        if (poor) { c.body = shade(mix(c.body, '#7A7366', 0.55), 0.82); c.bodyDk = shade(c.body, 0.8); c.pants = shade(mix(c.pants, '#6B6358', 0.5), 0.85); c.boots = '#4A3B2E'; }
        else if (cls >= 3) { c.body = shade(c.body, 1.08); c.bodyDk = shade(c.bodyDk, 1.05); c.boots = cls >= 4 ? '#2B1D14' : c.boots; }
        const gn = ap?.gn || ''; // v7.5.0 神話基因的外觀
        if (gn === 'night') c.skin = '#E8E2EC'; else if (gn === 'wolf') c.hair = '#77797C'; else if (gn === 'sun') c.hair = '#E8B13A'; else if (gn === 'hades') { c.body = '#2E2A3A'; c.bodyDk = '#221F2B'; } else if (gn === 'giant') c.skin = shade(c.skin, 0.92);
        const zb = !!ap?.zb; if (zb) { c.skin = '#8FAF7A'; c.body = shade(mix(c.body, '#5E6B52', 0.6), 0.8); c.bodyDk = shade(c.body, 0.8); c.pants = shade(mix(c.pants, '#4E4A40', 0.5), 0.8); } // v9.2.0 喪屍:灰綠皮膚、髒衣服
        const skinDk = shade(c.skin, 0.86), hairDk = shade(c.hair, 0.8), bodyLt = shade(c.body, 1.18);
        // v6.96.0 每個人長得不一樣:用名字當種子,穩定決定髮型、眼型、眉毛、嘴型、雀斑、鬍子、小配件、衣服花樣、身材
        const nm = String(agent.name || aid); let hs = 2166136261; for (let i = 0; i < nm.length; i++) { hs ^= nm.charCodeAt(i); hs = (hs * 16777619) >>> 0; }
        const R = (salt) => hash2(hs % 100003, salt * 7919 + (hs >>> 17));
        const pick = (arr, salt) => arr[Math.floor(R(salt) * arr.length) % arr.length];
        const adult = ab === 'a' || ab === 'e' || ab === 'o';
        const bw = 0.9 + R(1) * 0.22; // 胖瘦
        if (!poor && !(cls >= 3)) { c.body = shade(c.body, 0.86 + R(2) * 0.3); c.bodyDk = shade(c.body, 0.8); if (R(3) < 0.25) c.body = mix(c.body, pick(['#C94F4F', '#4F7FC9', '#5FA05A', '#C9A24F', '#8A5FC9', '#4FB0A8'], 4), 0.35); }
        // v6.97.0 換回方塊人,但做成「方塊Q版」:頭大一點、方形大眼帶反光、腮紅、不畫鼻子、額前瀏海;身體、手腳都是方塊
        const body = [];   // [w,h,d,hex,x,y,z]
        const B = (w, h, d, hex, x, y, z) => body.push([w, h, d, hex, x, y, z]);
        const HY = 1.12, F = 0.23, T = HY + 0.23; // 頭中心高度、臉的正面、頭頂
        const zf = 0.14 * bw; // 胸口正面
        // 軀幹、腰帶與扣環、衣領
        B(0.44 * bw, 0.42, 0.28 * bw, c.body, 0, 0.66, 0);
        B(0.46 * bw, 0.07, 0.3 * bw, c.bodyDk, 0, 0.47, 0);
        B(0.09, 0.06, 0.02, poor ? '#6B5A45' : '#D9B85C', 0, 0.47, 0.15 * bw + 0.005);
        B(0.28, 0.05, 0.05, cls >= 3 && !poor ? '#F2F2F2' : bodyLt, 0, 0.86, 0.12);
        if (female) B(0.5 * bw, 0.16, 0.34 * bw, c.body, 0, 0.38, 0); // 裙擺
        { const cv = R(5); // 衣服花樣:條紋、吊帶褲
          if (cv < 0.22) B(0.45 * bw, 0.05, 0.29 * bw, shade(c.body, 1.3), 0, 0.7, 0);
          else if (cv < 0.36 && !female) { B(0.24, 0.2, 0.02, c.pants, 0, 0.6, zf + 0.01); B(0.04, 0.18, 0.02, c.pants, -0.1, 0.76, zf + 0.01); B(0.04, 0.18, 0.02, c.pants, 0.1, 0.76, zf + 0.01); } }
        if (poor) { B(0.12, 0.11, 0.02, mix(c.body, '#A08C6E', 0.6), 0.1, 0.68, zf + 0.005); B(0.13, 0.1, 0.02, mix(c.body, '#5C5247', 0.6), -0.09, 0.56, -zf - 0.005); } // 補丁
        if (zb) { B(0.14, 0.12, 0.02, '#7A2A22', -0.08, 0.62, zf + 0.006); B(0.1, 0.16, 0.02, shade(c.body, 0.6), 0.11, 0.5, zf + 0.006); B(0.12, 0.1, 0.02, '#6B2420', 0.05, 0.7, -zf - 0.006); } // v9.2.0 喪屍:血跡、破洞
        if (cls >= 3 && !poor) { B(0.04, 0.04, 0.02, '#D9B85C', 0, 0.74, zf + 0.01); B(0.04, 0.04, 0.02, '#D9B85C', 0, 0.62, zf + 0.01); } // 金扣
        if (cls >= 4 && !poor) { const cape = cls >= 5 ? '#9E1B1B' : '#5E2A84'; B(0.5, 0.58, 0.05, cape, 0, 0.6, -zf - 0.03); B(0.48, 0.05, 0.34, cape, 0, 0.875, -0.01); // 披風
            if (cls >= 5) { B(0.52, 0.06, 0.08, '#F5F5F5', 0, 0.88, -zf - 0.02); B(0.52, 0.06, 0.07, '#F5F5F5', 0, 0.33, -zf - 0.03); } // 白毛邊
            B(0.22, 0.03, 0.02, '#E6C350', 0, 0.82, zf + 0.01); B(0.06, 0.06, 0.02, cls >= 5 ? '#C62828' : '#2E7D32', 0, 0.77, zf + 0.015); } // 金項鍊與墜子
        // 頭:大方頭、耳朵、腮紅、嘴、眉毛(眼睛另外一個網格,才能眨眼、睡覺閉眼)
        B(0.5, 0.46, 0.46, c.skin, 0, HY, 0);
        B(0.05, 0.1, 0.1, skinDk, -0.275, HY - 0.02, 0); B(0.05, 0.1, 0.1, skinDk, 0.275, HY - 0.02, 0);
        const blushK = R(6); if (blushK > 0.18) { const bc = blushK > 0.75 ? '#EE8E96' : '#F2A8AE'; B(0.08, 0.04, 0.02, bc, -0.16, HY - 0.075, F + 0.005); B(0.08, 0.04, 0.02, bc, 0.16, HY - 0.075, F + 0.005); } // 腮紅深淺(有人沒有)
        if (R(7) < 0.2) for (const sx of [-1, 1]) for (const [fx, fy] of [[0.13, -0.05], [0.17, -0.035], [0.2, -0.06]]) B(0.022, 0.022, 0.02, '#A8714E', sx * fx, HY + fy, F + 0.012); // 雀斑
        const beard = !female && adult && R(12) < 0.3 ? (R(13) < 0.5 ? 'm' : 'b') : '';
        const mz = beard === 'b' ? F + 0.035 : F + 0.005, my = HY - 0.12;
        const mouthT = Math.floor(R(8) * 4); // 嘴型:微笑、開口笑、小圓嘴、貓嘴
        if (mouthT === 0) B(0.08, 0.022, 0.02, '#8C4A3C', 0, my, mz);
        else if (mouthT === 1) { B(0.1, 0.04, 0.02, '#B5483F', 0, my, mz); B(0.06, 0.015, 0.02, '#F2F2F2', 0, my + 0.012, mz + 0.002); }
        else if (mouthT === 2) B(0.04, 0.04, 0.02, '#A8443A', 0, my, mz);
        else { B(0.04, 0.02, 0.02, '#8C4A3C', -0.022, my, mz); B(0.04, 0.02, 0.02, '#8C4A3C', 0.022, my, mz); B(0.02, 0.02, 0.02, '#8C4A3C', 0, my + 0.015, mz); }
        { const bwid = 0.08 + R(10) * 0.03, bt = R(9) < 0.45 ? 0.035 : 0.022; B(bwid, bt, 0.02, hairDk, -0.11, HY + 0.09, F + 0.006); B(bwid, bt, 0.02, hairDk, 0.11, HY + 0.09, F + 0.006); } // 眉毛粗細長短
        if (beard === 'm') B(0.14, 0.03, 0.025, hairDk, 0, HY - 0.085, F + 0.012); // 八字鬍
        if (beard === 'b') { B(0.44, 0.14, 0.04, c.hair, 0, HY - 0.17, F + 0.012); B(0.44, 0.06, 0.3, c.hair, 0, HY - 0.25, 0.08); B(0.04, 0.18, 0.14, c.hair, -0.255, HY - 0.07, 0.08); B(0.04, 0.18, 0.14, c.hair, 0.255, HY - 0.07, 0.08); } // 落腮鬍
        if (adult && R(14) < 0.15) { B(0.04, 0.05, 0.04, '#E6C350', -0.275, HY - 0.1, 0); B(0.04, 0.05, 0.04, '#E6C350', 0.275, HY - 0.1, 0); } // 耳環
        // 頭髮:有自訂外觀用自訂的,沒有就依名字挑(男 0 短髮、3 側髮、4 刺蝟、6 平頭、7 油頭、5 蓬髮、11 捲髮;女 1 長髮、2 包包頭、8 雙馬尾、9 鮑伯、10 馬尾、11 捲髮;老先生可能禿頭 12)
        let hairStyle = agent.look?.hair;
        if (hairStyle == null) hairStyle = (!female && ab === 'o' && R(15) < 0.45) ? 12 : female ? pick([1, 1, 2, 8, 9, 10, 11, 3], 16) : pick([0, 0, 3, 4, 6, 7, 5, 11], 16);
        const H = c.hair;
        if (hairStyle === 12) { B(0.54, 0.16, 0.08, H, 0, HY - 0.01, -0.22); B(0.05, 0.14, 0.24, H, -0.27, HY - 0.01, -0.1); B(0.05, 0.14, 0.24, H, 0.27, HY - 0.01, -0.1); } // 禿頭只剩後腦一圈
        else {
            if (hairStyle === 5) B(0.6, 0.18, 0.56, H, 0, T + 0.06, -0.01); // 蓬髮
            else if (hairStyle === 6) B(0.52, 0.06, 0.48, H, 0, T + 0.02, -0.01); // 平頭
            else B(0.54, 0.12, 0.5, H, 0, T + 0.04, -0.01);
            B(0.54, hairStyle === 6 ? 0.2 : 0.3, 0.1, H, 0, HY + (hairStyle === 6 ? 0.12 : 0.08), -0.22); // 後腦
            if (hairStyle !== 6) { B(0.04, 0.16, 0.42, H, -0.27, HY + 0.12, -0.02); B(0.04, 0.16, 0.42, H, 0.27, HY + 0.12, -0.02); } // 鬢角
            // 瀏海:平瀏海、斜瀏海、短瀏海(刺蝟、平頭、油頭不留)
            if (![4, 6, 7].includes(hairStyle)) { if (R(25) < 0.5) B(0.5, 0.08, 0.05, H, 0, HY + 0.19, F + 0.012); else { B(0.32, 0.1, 0.05, H, -0.09, HY + 0.175, F + 0.012); B(0.18, 0.06, 0.05, H, 0.16, HY + 0.2, F + 0.012); } }
            else B(0.5, 0.04, 0.04, H, 0, HY + 0.215, F + 0.01);
        }
        if (hairStyle === 1) { B(0.5, 0.42, 0.1, H, 0, HY - 0.12, -0.24); B(0.05, 0.4, 0.2, H, -0.27, HY - 0.06, -0.1); B(0.05, 0.4, 0.2, H, 0.27, HY - 0.06, -0.1); } // 長髮
        if (hairStyle === 2) B(0.18, 0.18, 0.18, hairDk, 0, T + 0.14, -0.12); // 包包頭
        if (hairStyle === 3) { B(0.06, 0.28, 0.12, H, -0.27, HY - 0.02, 0.12); B(0.06, 0.28, 0.12, H, 0.27, HY - 0.02, 0.12); } // 兩側長鬢
        if (hairStyle === 4) for (const [x, z] of [[-0.16, 0.06], [0, 0.1], [0.16, 0.06], [-0.08, -0.12], [0.08, -0.12]]) B(0.1, 0.12, 0.1, H, x, T + 0.15, z); // 刺蝟頭
        if (hairStyle === 7) B(0.3, 0.1, 0.2, H, 0.06, T + 0.12, 0.1); // 油頭
        if (hairStyle === 8) for (const x of [-0.32, 0.32]) { B(0.1, 0.32, 0.1, H, x, HY - 0.04, -0.08); B(0.06, 0.06, 0.06, c.accent || '#E06A8A', x * 0.94, HY + 0.12, -0.08); } // 雙馬尾
        if (hairStyle === 9) { for (const x of [-0.27, 0.27]) B(0.07, 0.34, 0.44, H, x, HY - 0.02, -0.01); B(0.54, 0.36, 0.1, H, 0, HY - 0.02, -0.22); } // 鮑伯頭
        if (hairStyle === 10) { B(0.1, 0.32, 0.1, H, 0, HY - 0.04, -0.31); B(0.07, 0.07, 0.07, c.accent || '#E06A8A', 0, HY + 0.12, -0.29); } // 馬尾
        if (hairStyle === 11) for (const [x, y, z] of [[-0.18, 0.13, 0.08], [0.04, 0.15, 0.1], [0.2, 0.12, 0.02], [-0.14, 0.13, -0.14], [0.14, 0.14, -0.14], [-0.29, -0.02, -0.04], [0.29, -0.02, -0.04]]) B(0.16, 0.12, 0.16, H, x, T + y - 0.04, z); // 捲髮
        // 職業帽／配件
        const acc = child ? 0 : (agent.look?.acc ?? 0);
        let minerLamp = false;
        if (king) { B(0.5, 0.1, 0.5, '#E6C350', 0, T + 0.12, 0); for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19], [0, 0.21]]) B(0.07, 0.12, 0.07, '#E6C350', x, T + 0.22, z); B(0.07, 0.07, 0.02, '#C62828', 0, T + 0.12, 0.255); } // 王冠
        else if (child) { /* 小孩不戴職業帽 */ }
        else if (acc === 1 || jobKey === 'farmer') { B(0.78, 0.04, 0.78, '#D9B36B', 0, T + 0.08, 0); B(0.46, 0.16, 0.46, '#D9B36B', 0, T + 0.18, 0); B(0.48, 0.04, 0.48, '#8C5A3C', 0, T + 0.11, 0); }
        else if (jobKey === 'guard') { B(0.58, 0.22, 0.54, '#90A4AE', 0, T + 0.06, -0.01); B(0.06, 0.14, 0.16, '#C9533D', 0, T + 0.24, -0.01); }
        else if (jobKey === 'miner') { B(0.58, 0.2, 0.54, '#D2B23D', 0, T + 0.06, -0.01); minerLamp = true; }
        else if (jobKey === 'cook') { B(0.44, 0.3, 0.44, '#FFFFFF', 0, T + 0.22, 0); B(0.32, 0.3, 0.02, '#F4F4F4', 0, 0.6, zf + 0.01); }
        else if (jobKey === 'mayor') { B(0.56, 0.06, 0.52, '#FFD700', 0, T + 0.11, -0.01); B(0.08, 0.08, 0.02, '#E8732A', 0.11, 0.76, zf + 0.01); }
        else if (jobKey === 'doctor') { B(0.56, 0.08, 0.52, '#FFFFFF', 0, T + 0.11, -0.01); B(0.05, 0.15, 0.02, '#C9533D', 0.1, 0.7, zf + 0.01); B(0.15, 0.05, 0.02, '#C9533D', 0.1, 0.7, zf + 0.01); }
        else if (jobKey === 'priest') B(0.32, 0.3, 0.32, '#F0E070', 0, T + 0.22, 0);
        const jobHat = king || acc === 1 || ['farmer', 'guard', 'miner', 'cook', 'mayor', 'doctor', 'priest'].includes(jobKey);
        if (!jobHat && !child) { const ax = R(17); // 小配件:花朵髮夾、蝴蝶結、鴨舌帽
            if (female && ax < 0.28) { const fc = pick(['#F4A3C4', '#F6D365', '#9EC9F2', '#FFFFFF'], 18); for (const [x, y] of [[0.2, 0.07], [0.26, 0.03], [0.16, 0.02], [0.22, -0.02]]) B(0.06, 0.06, 0.05, fc, x, T + y, F - 0.04); B(0.04, 0.04, 0.05, '#F6C04A', 0.21, T + 0.025, F - 0.03); }
            else if (female && ax < 0.45 && hairStyle !== 4) { const bc = pick(['#D94F5C', '#4F7FC9', '#F2B134', '#8A5FC9'], 19); B(0.1, 0.08, 0.05, bc, -0.08, T + 0.14, 0.08); B(0.1, 0.08, 0.05, bc, 0.08, T + 0.14, 0.08); B(0.05, 0.05, 0.06, shade(bc, 0.8), 0, T + 0.14, 0.08); }
            else if (!female && ax < 0.6 && hairStyle !== 4 && hairStyle !== 5 && hairStyle !== 11) { const cc = pick(['#3B5998', '#B03A2E', '#2E7D32', '#5D4037'], 20); B(0.56, 0.14, 0.52, cc, 0, T + 0.08, -0.01); B(0.4, 0.03, 0.18, shade(cc, 0.85), 0, T + 0.03, F + 0.08); } }
        else if (child && R(17) < 0.3) { const bc = pick(['#D94F5C', '#F2B134', '#4F7FC9'], 19); B(0.09, 0.07, 0.05, bc, -0.07, T + 0.12, 0.08); B(0.09, 0.07, 0.05, bc, 0.07, T + 0.12, 0.08); }
        if (acc === 2) { const G = '#4A3A2E', ey = HY - 0.01, gz = F + 0.014; for (const x of [-0.11, 0.11]) { B(0.15, 0.018, 0.02, G, x, ey + 0.075, gz); B(0.15, 0.018, 0.02, G, x, ey - 0.075, gz); B(0.018, 0.15, 0.02, G, x - 0.075, ey, gz); B(0.018, 0.15, 0.02, G, x + 0.075, ey, gz); } B(0.07, 0.018, 0.02, G, 0, ey + 0.02, gz); } // 方框眼鏡(框在眼睛外圍,不擋眼)
        if (acc === 3) B(0.48, 0.1, 0.34, c.accent, 0, 0.85, 0.01); // 圍巾
        if (jobKey === 'blacksmith') B(0.3, 0.36, 0.03, '#5A4A3A', 0, 0.62, zf + 0.01);
        if (jobKey === 'trader') { B(0.18, 0.2, 0.14, '#8C5A3C', 0.32, 0.52, 0); B(0.04, 0.38, 0.02, '#5A3E2B', 0.12, 0.7, zf + 0.01); }
        if (gn === 'wolf') { B(0.12, 0.17, 0.08, hairDk, -0.17, T + 0.07, -0.02); B(0.12, 0.17, 0.08, hairDk, 0.17, T + 0.07, -0.02); } // 狼耳
        else if (gn === 'thunder') { B(0.07, 0.2, 0.05, '#FFE14D', 0.3, T + 0.12, 0); B(0.07, 0.1, 0.05, '#FFE14D', 0.34, T - 0.02, 0); } // 電光
        else if (gn === 'phoenix') { B(0.12, 0.14, 0.12, '#FF7A1A', 0, T + 0.09, 0); B(0.07, 0.1, 0.07, '#FFD24D', 0, T + 0.19, 0); } // 頭頂火焰
        else if (gn === 'owl') { B(0.5, 0.05, 0.02, '#D9A520', 0, HY + 0.17, F + 0.01); } // 金色額飾
        else if (gn === 'sun') { B(0.56, 0.04, 0.56, '#FFD24D', 0, T + 0.12, 0); } // 光環
        else if (gn === 'night') { B(0.04, 0.05, 0.02, '#FFFFFF', -0.05, HY - 0.12, F + 0.01); B(0.04, 0.05, 0.02, '#FFFFFF', 0.05, HY - 0.12, F + 0.01); } // 尖牙
        m.add(P(body)); const lodParts = body.slice(); // 遠處簡化網格用的零件清單
        // 眼睛(睜眼＋反光)與閉眼線各一個網格:會眨眼,睡覺時閉眼
        // 眼型:一般、大亮眼、小豆眼、睏睏眼、長睫毛;眼珠顏色也有幾種
        const eyeT = Math.floor(R(21) * 5); const ek = eyeT === 1 ? 1.2 : eyeT === 2 ? 0.72 : 1; const eyeC = zb ? '#D9DCC8' : gn === 'night' ? '#B3202A' : gn === 'owl' ? '#D9A520' : gn === 'wolf' ? '#C9A227' : pick(['#33241B', '#33241B', '#33241B', '#2E4A7A', '#3E6B3A', '#5A3A1E'], 22);
        const EY = HY - 0.01, ew = 0.075 * ek, eh = 0.1 * ek;
        const eyeParts = [];
        for (const x of [-0.11, 0.11]) { eyeParts.push([ew, eh, 0.02, eyeC, x, EY, F + 0.006]); eyeParts.push([0.028 * ek, 0.028 * ek, 0.02, '#FFFFFF', x + ew * 0.22, EY + eh * 0.22, F + 0.014]); if (eyeT !== 2) eyeParts.push([0.014, 0.014, 0.02, '#FFFFFF', x - ew * 0.25, EY - eh * 0.28, F + 0.013]); }
        if (eyeT === 3) for (const x of [-0.11, 0.11]) eyeParts.push([0.09, 0.045, 0.02, c.skin, x, EY + 0.035, F + 0.02]); // 睏睏眼:上眼皮
        if (eyeT === 4 || (female && eyeT === 0 && R(23) < 0.5)) for (const x of [-0.11, 0.11]) eyeParts.push([0.035, 0.018, 0.02, '#2B2118', x + (x < 0 ? -0.05 : 0.05), EY + 0.045, F + 0.012]); // 長睫毛
        const eyes = P(eyeParts);
        eyes.name = 'eyes'; eyes.castShadow = false; m.add(eyes); m.userData.eyes = eyes;
        const lids = P([[0.08, 0.018, 0.02, '#33241B', -0.11, EY - 0.01, F + 0.008], [0.08, 0.018, 0.02, '#33241B', 0.11, EY - 0.01, F + 0.008]]);
        lids.name = 'lids'; lids.castShadow = false; lids.visible = false; m.add(lids); m.userData.lids = lids;
        for (const x of [-0.11, 0.11]) lodParts.push([Math.max(0.05, ew), eh, 0.02, eyeC, x, EY, F + 0.006]);
        m.userData.lodParts = lodParts;
        m.userData.blinkPh = Math.floor(hash2(aid.length * 7, (aid.charCodeAt(0) || 1) * 13) * 200);
        // 四肢(各自一個網格,掛在樞紐上擺動):腿＋靴＋鞋底、手臂＋袖口＋手
        const limb = (name, x, pivotY, boxes) => { const g = new THREE.Group(); g.position.set(x, pivotY, 0); g.name = name; g.add(P(boxes)); m.add(g); for (const b of boxes) lodParts.push([b[0], b[1], b[2], b[3], b[4] + x, b[5] + pivotY, b[6]]); return g; };
        const leg = (x) => limb(x < 0 ? 'legL' : 'legR', x, 0.4, [[0.16, 0.3, 0.17, c.pants, 0, -0.15, 0], [0.19, 0.1, 0.22, c.boots, 0, -0.33, 0.02], [0.2, 0.03, 0.23, shade(c.boots, 0.6), 0, -0.385, 0.02], ...(poor && x > 0 ? [[0.09, 0.08, 0.02, mix(c.pants, '#A08C6E', 0.6), 0, -0.12, 0.095]] : [])]);
        leg(-0.11); leg(0.11);
        const ax0 = 0.22 * bw + 0.07;
        const arm = (x) => limb(x < 0 ? 'armL' : 'armR', x, 0.84, [[0.13, 0.32, 0.14, c.body, 0, -0.16, 0], [0.14, 0.05, 0.15, c.bodyDk, 0, -0.3, 0], [0.12, 0.1, 0.12, c.skin, 0, -0.37, 0]]);
        arm(-ax0); const armR = arm(ax0);
        const tool = new THREE.Group(); tool.name = 'tool'; tool.visible = false; tool.position.set(0, -0.37, 0.1); armR.add(tool);
        tool.add(P([[0.06, 0.95, 0.06, '#8B6914', 0, 0.2, 0], [0.22, 0.06, 0.08, '#8A8A8A', 0, 0.66, 0.04]]));
        m.userData.tool = tool;
        if (minerLamp) { const l = new THREE.Mesh(BOX(), MAT('#FFE9A8', { emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0.6 })); l.scale.set(0.12, 0.1, 0.06); l.position.set(0, T + 0.06, 0.28); m.add(l); }
        m.scale.setScalar(1.3 * (child ? 0.68 : ab === 't' ? 0.88 : 1) * (0.95 + R(24) * 0.1) * (gn === 'giant' ? 1.3 : 1)); m.userData.ab = ab; // 高矮也略有不同;小孩、青少年個子小
        return m;
    }
    return { build, variedColors, partMesh, shadeHex, hash2 };
})();

// ============================================================
// RimTown 3D 小鎮渲染器(three.js r159,程序化低多邊形)— v6.23.0
// 繼承 PixelTileMap:沿用地圖生成、尋路、村民移動、點擊判定等邏輯,只換掉畫面層。
// 開關:localStorage rimtown_renderer = '3d' 或網址 ?r=3d(v6.27 之後成為唯一渲染器)
// ============================================================
(function () {
if (typeof PixelTileMap === 'undefined' || typeof THREE === 'undefined') return;

const t3 = (s) => (typeof t === 'function' ? t(s) : s);
const hash32 = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; };
const hash2 = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

// 低多邊形地表配色(sRGB)
const GROUND_COLORS = {
    [T.GRASS]: '#7CC45A', [T.GRASS2]: '#76BE55', [T.GRASS3]: '#84CB62',
    [T.DIRT]: '#CBA470', [T.STONE_PATH]: '#BDB2A1', [T.GRAVEL]: '#A9A196', [T.SAND]: '#EBD9A8',
    [T.SALT]: '#EEE9DC', [T.NET]: '#9A8A66', [T.SNOW]: '#F1F4F7', [T.RAIL]: '#8E8478',
    [T.CROP1]: '#B48C5C', [T.CROP2]: '#B48C5C', [T.CROP3]: '#B48C5C',
    [T.FLOOR]: '#CDB58F', [T.FLOOR2]: '#C7AD86', [T.DARK_FLOOR]: '#9E8A6C', [T.RUG]: '#B46A5A',
    [T.WATER]: '#3B7AA6', [T.WATER2]: '#35709A', [T.CHASM]: '#3A3340',
};
const WALL_PALETTE = ['#F3E2C3', '#E8D2AE', '#F6EEDC', '#D9C3A5', '#C9A98A', '#EEDDCB', '#D8E0D0', '#E9D6B8'];
// v6.57.0 依時代的建材:0 木屋(拓荒)、1 木骨石屋(手工,原本的樣子)、2 磚造樓房(工坊)
const WOOD_WALLS = ['#B08A5E', '#A47D52', '#9C7650', '#B89468'], THATCH_ROOFS = ['#C9A55A', '#BFA055', '#B8964A', '#CBAE68'];
const BRICK_WALLS = ['#B5654A', '#A85A42', '#C27458', '#9E5643'], SLATE_ROOFS = ['#4F5A66', '#56606B', '#5B4E48', '#4A5560'];
const ROOF_PALETTE = {
    frontier: ['#C9533D', '#B9473A', '#8C5A3C', '#A85A3A', '#D28A3D', '#7A6F5C'],
    harbor:   ['#5B7F8E', '#3C7E71', '#C9533D', '#4F6F93', '#8C5A3C', '#D28A3D'],
    mountain: ['#6B6F78', '#8C5A3C', '#5B6E7A', '#7A6F5C', '#A85A3A', '#4E5A66'],
    forest:   ['#5E7F4A', '#8C5A3C', '#7A6F5C', '#3C7E71', '#A85A3A', '#6B8F5A'],
    market:   ['#D28A3D', '#C9533D', '#8C4FA0', '#3C7E71', '#D2B23D', '#B9473A'],
};

class Town3D extends PixelTileMap {
    constructor(canvas) {
        Town3D._pending = canvas;          // 真正的 WebGL 畫布;基底類別拿到的是替身,避免被鎖成 2D context
        super(document.createElement('canvas'));
    }

    // ---------- 初始化:取代 2D 畫布設定 ----------
    _setupCanvas() {
        this.glCanvas = Town3D._pending; Town3D._pending = null;
        this.glCanvas.classList.add('is-3d');
        this.mapWidth = this.cols * TILE; this.mapHeight = this.rows * TILE;
        this.camX = 0; this.camY = 0; this.zoom = 1.5; this.minZoom = 1; this.maxZoom = 4;
        this._dpr = Math.min(window.devicePixelRatio || 1, 2);
        this._viewW = 0; this._viewH = 0; this._needsResize = true;
        this.isMobile = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        try { this.idleCam = localStorage.getItem('rimtown_idlecam') !== '0'; } catch (e) { this.idleCam = true; } this._lastInputAt = Date.now(); // v6.32.0 閒置 45 秒後慢慢環繞小鎮
        // v6.27.0 high/low 鎖定,auto 才自動降級。v6.43.3 只有玩家在設定裡親手選的才鎖(rimtown_3d_q_by=user);
        // 以前自動降級也寫進 'low',手機載入時卡一下就永遠鎖在低畫質(30fps、標籤每秒只動 10 次),這類舊紀錄一律當 auto
        try { const q = localStorage.getItem('rimtown_3d_quality'); const byUser = q === 'high' || localStorage.getItem('rimtown_3d_q_by') === 'user'; this.lowQuality = q === 'low' && byUser; this.lockQuality = byUser && (q === 'high' || q === 'low'); } catch (e) { this.lowQuality = false; }
        if (this.lowQuality) this._dpr = 1;
        // 軌道相機:看向 target(地圖座標,1 格 = 1 單位),yaw/pitch/dist
        this.target = new THREE.Vector3(this.cols / 2, 0, this.rows / 2);
        this.yaw = -0.45; this.pitch = 0.95; this.dist = this.isMobile ? 58 : 50;
        this.minPitch = 0.38; this.maxPitch = 1.35; this.minDist = 9; this.maxDist = 95;

        try {
            this.renderer = new THREE.WebGLRenderer({ canvas: this.glCanvas, antialias: !this.isMobile && !this.lowQuality, alpha: false, powerPreference: 'high-performance' });
        } catch (e) { console.warn('[Town3D] WebGL 初始化失敗', e); this.renderer = null; return; }
        // v6.28.0 WebGL 失聯(iOS Safari 記憶體吃緊時常見):擋掉預設行為讓 three 能自動復原;復原後重建場景
        this.glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this._ctxLost = true; console.warn('[Town3D] WebGL context lost'); }, false);
        this.glCanvas.addEventListener('webglcontextrestored', () => { this._ctxLost = false; this._sceneSrc = null; this._dynSig = null; this._farmSig = this._factSig = this._expSig = null; this._graveN = -1; this._festId = null; this._fx = null; this._stars = null; this._beam = null; this._needsResize = true; console.warn('[Town3D] WebGL context restored'); }, false);
        this.renderer.setPixelRatio(this._dpr);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = !this.isMobile && !this.lowQuality;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#BDE3F7');
        this.scene.fog = new THREE.FogExp2('#BDE3F7', 0.006);
        this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 420);
        this.hemi = new THREE.HemisphereLight('#CFE9FF', '#8C7A5A', 0.9);
        this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight('#FFF4DC', 1.6);
        this.sun.castShadow = !this.isMobile && !this.lowQuality;
        const sc = this.sun.shadow.camera; sc.left = -56; sc.right = 56; sc.top = 56; sc.bottom = -56; sc.near = 1; sc.far = 260;
        this.sun.shadow.mapSize.set(window.innerWidth <= 820 ? 1024 : 2048, window.innerWidth <= 820 ? 1024 : 2048); // v6.27.0 小螢幕陰影貼圖減半 this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.03;
        this.sun.target.position.set(this.cols / 2, 0, this.rows / 2);
        this.scene.add(this.sun); this.scene.add(this.sun.target);
        this._static = new THREE.Group(); this.scene.add(this._static);
        this._dyn = new THREE.Group(); this.scene.add(this._dyn);
        this._agentGroup = new THREE.Group(); this.scene.add(this._agentGroup);
        this._mats = {}; this._geos = {}; this._agentMeshes = {}; this._winMats = []; this._waterMeshes = []; this._glowMats = [];
        this._ray = new THREE.Raycaster(); this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this._tmpV = new THREE.Vector3(); this._tmpV2 = new THREE.Vector3(); this._dummy = new THREE.Object3D();

        // HTML 標籤層(建築名牌、村民名牌、泡泡、特效)
        const parent = this.glCanvas.parentElement;
        this.overlay = document.createElement('div');
        this.overlay.className = 'town3d-overlay';
        if (parent) parent.appendChild(this.overlay);
        this._ovPool = new Map(); this._ovUsed = new Set();

        this._resizeObserver = new ResizeObserver(() => { this._needsResize = true; });
        if (parent) this._resizeObserver.observe(parent);
        window.addEventListener('resize', () => { this._needsResize = true; });
        this._setupInteraction3D();
    }
    _setupInteraction() { /* 2D 版互動不掛;改用 _setupInteraction3D */ }

    // v6.33.0 解析度:低畫質 1x;手機「自動」1.5x(iPhone 原生 3x、安卓 2.6x 的填充率是手機 GPU 最大頭,1.5x 肉眼幾乎看不出差別、像素少四成);鎖「高」才用到 2x
    // v6.43.0 精簡細節:手機或低畫質時,百葉、花槽、腰樑、側樹冠、草叢不畫(省三角形與記憶體)
    _lite() { return !!(this.lowQuality || this.isMobile); }
    _targetDpr() { if (this.lowQuality) return 1; const d = window.devicePixelRatio || 1; return Math.min(d, this.isMobile && !this.lockQuality ? 1.5 : 2); }
    _checkResize() {
        const parent = this.glCanvas?.parentElement;
        if (!parent || !this.renderer) return;
        const rect = parent.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        if (w < 1 || h < 1) { this._needsResize = true; return; }
        const dpr = this._targetDpr();
        if (!this._needsResize && Math.abs(this._viewW - w) <= 1 && Math.abs(this._viewH - h) <= 1 && dpr === this._dpr) return;
        this._needsResize = false; this._dpr = dpr; this._viewW = w; this._viewH = h;
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
        if (!this._initialZoomApplied) { this._initialZoomApplied = true; this.dist = w <= 820 ? 58 : 50; }
    }
    _clampCamera() {
        this.target.x = clamp(this.target.x, 4, this.cols - 4);
        this.target.z = clamp(this.target.z, 4, this.rows - 4);
        this.pitch = clamp(this.pitch, this.minPitch, this.maxPitch);
        this.dist = clamp(this.dist, this.minDist, this.maxDist);
        this.zoom = clamp(40 / this.dist, 0.5, 4); // 供基底類別點擊判定用的假縮放
    }
    _updateCamera() {
        // v6.32.0 閒置環繞:45 秒沒操作、也沒在跟拍／飛往某處,鏡頭就慢慢繞著目前的焦點轉(任何操作都會中斷)
        if (this.idleCam && !this._followAgent && !this._focusTo && !document.hidden && Date.now() - (this._lastInputAt || 0) > 45000) { this.yaw += 0.0011; this.pitch = lerp(this.pitch, (this.minPitch + this.maxPitch) * 0.5, 0.002); }
        if (this._followAgent) { const p = this.agentPositions[this._followAgent]; if (p) { this.target.x = lerp(this.target.x, p.x / TILE, 0.1); this.target.z = lerp(this.target.z, p.y / TILE, 0.1); if (this._focusTo && this._focusTo.dist) { this.dist = lerp(this.dist, this._focusTo.dist, 0.08); if (Math.abs(this.dist - this._focusTo.dist) < 0.3) this._focusTo = null; } } else this._followAgent = null; }
        else if (this._focusTo) {
            this.target.x = lerp(this.target.x, this._focusTo.x, 0.08);
            this.target.z = lerp(this.target.z, this._focusTo.z, 0.08);
            if (this._focusTo.dist) this.dist = lerp(this.dist, this._focusTo.dist, 0.08);
            if (Math.abs(this.target.x - this._focusTo.x) < 0.05 && Math.abs(this.target.z - this._focusTo.z) < 0.05) this._focusTo = null;
        }
        this._clampCamera();
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        this.camera.position.set(this.target.x + this.dist * cp * Math.sin(this.yaw), this.dist * sp, this.target.z + this.dist * cp * Math.cos(this.yaw));
        this.camera.lookAt(this.target.x, 0, this.target.z);
        this.camX = this.target.x * TILE - (this._viewW / this.zoom) / 2; this.camY = this.target.z * TILE - (this._viewH / this.zoom) / 2;
    }
    _followCamera(pos) {
        if (!this.followPlayer || !this._viewW) return;
        this._focusTo = { x: pos.x / TILE, z: pos.y / TILE };
    }
    getViewCenter() { return { x: this.target.x * TILE, y: this.target.z * TILE }; }
    // v6.28.0 給 AI 對話距離判定:拉遠時只算鏡頭中心附近,避免俯瞰全鎮時每對村民都觸發 LLM
    getLlmRadiusTiles() { return this.dist <= 24 ? 14 : this.dist <= 40 ? 10 : this.dist <= 60 ? 7 : 5; }
    focusMap(px, py, dist) { this._focusTo = { x: px / TILE, z: py / TILE, dist: dist || null }; this._lastInputAt = Date.now(); }
    // v6.29.0 跟拍村民:鏡頭每幀追著他;使用者拖曳就取消
    followAgent(agentId) { this._followAgent = agentId || null; this._lastInputAt = Date.now(); if (agentId) { this.followPlayer = false; this._focusTo = null; const p = this.agentPositions[agentId]; if (p && this.dist > 30) this._focusTo = { x: p.x / TILE, z: p.y / TILE, dist: 22 }; } }
    isFollowing(agentId) { return !!this._followAgent && this._followAgent === agentId; }
    focusLocation(locId) {
        const z = this.buildingZones[locId] || this.natureZones[locId];
        if (!z) return;
        this.focusMap((z.x + z.w / 2) * TILE, (z.y + z.h / 2) * TILE, this.isMobile ? 24 : 20);
    }

    // 螢幕座標 → 地面交點 → 地圖像素座標(與 2D 版相同的座標系)
    _groundPoint(clientX, clientY) {
        const r = this.glCanvas.getBoundingClientRect();
        const nx = ((clientX - r.left) / r.width) * 2 - 1, ny = -((clientY - r.top) / r.height) * 2 + 1;
        this._ray.setFromCamera({ x: nx, y: ny }, this.camera);
        const p = new THREE.Vector3();
        return this._ray.ray.intersectPlane(this._groundPlane, p) ? p : null;
    }
    _screenToMap(sx, sy) {
        const p = this._groundPoint(sx, sy);
        if (!p) return { x: this.target.x * TILE, y: this.target.z * TILE };
        return { x: p.x * TILE, y: p.z * TILE };
    }
    _project(wx, wy, wz) {
        const v = this._tmpV.set(wx, wy, wz).project(this.camera);
        if (v.z > 1 || v.z < -1) return null;
        return { x: (v.x + 1) / 2 * this._viewW, y: (1 - v.y) / 2 * this._viewH, d: this.camera.position.distanceTo(this._tmpV2.set(wx, wy, wz)) };
    }

    _setupInteraction3D() {
        const c = this.glCanvas;
        const ptrs = new Map();
        let mode = null, g0 = null, last = null, down = null, pinch0 = null;
        c.addEventListener('contextmenu', (e) => e.preventDefault());
        c.addEventListener('pointerdown', (e) => {
            c.setPointerCapture?.(e.pointerId);
            ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this._lastInputAt = Date.now();
            this.followPlayer = false; this._focusTo = null; this._followAgent = null; // v6.29.0 拖曳就取消跟拍
            if (ptrs.size === 1) {
                down = { x: e.clientX, y: e.clientY, t: Date.now() };
                mode = (e.button === 2 || e.shiftKey || e.ctrlKey) ? 'rotate' : 'pan';
                g0 = this._groundPoint(e.clientX, e.clientY); last = { x: e.clientX, y: e.clientY };
            } else if (ptrs.size === 2) {
                const [a, b] = [...ptrs.values()];
                pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: this.dist };
                mode = 'pinch'; down = null;
            }
        });
        c.addEventListener('pointermove', (e) => {
            if (!ptrs.has(e.pointerId)) return;
            ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (mode === 'pan' && g0) {
                const g = this._groundPoint(e.clientX, e.clientY);
                if (g) { this.target.x += g0.x - g.x; this.target.z += g0.z - g.z; this._clampCamera(); }
            } else if (mode === 'rotate' && last) {
                this.yaw -= (e.clientX - last.x) * 0.006; this.pitch += (e.clientY - last.y) * 0.005; this._clampCamera();
                last = { x: e.clientX, y: e.clientY };
            } else if (mode === 'pinch' && ptrs.size === 2 && pinch0) {
                const [a, b] = [...ptrs.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
                this.dist = pinch0.dist * (pinch0.d / Math.max(10, d));
                this.yaw -= (cx - pinch0.cx) * 0.006; this.pitch += (cy - pinch0.cy) * 0.005;
                pinch0.cx = cx; pinch0.cy = cy; this._clampCamera();
            }
        });
        const up = (e) => {
            if (!ptrs.has(e.pointerId)) return;
            ptrs.delete(e.pointerId);
            if (down && mode !== 'pinch' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 7 && Date.now() - down.t < 450) {
                const now = Date.now();
                if (this._lastTapAt && now - this._lastTapAt < 320 && this._lastTap && Math.hypot(e.clientX - this._lastTap.x, e.clientY - this._lastTap.y) < 24) {
                    const g = this._groundPoint(e.clientX, e.clientY);
                    if (g) this._focusTo = { x: g.x, z: g.z, dist: Math.max(this.minDist, this.dist * 0.6) };
                    this._lastTapAt = 0;
                } else {
                    this._lastTapAt = now; this._lastTap = { x: e.clientX, y: e.clientY };
                    this._handleTap(e.clientX, e.clientY);
                }
            }
            if (ptrs.size === 0) { mode = null; g0 = null; down = null; pinch0 = null; }
            else if (ptrs.size === 1) { const p = [...ptrs.values()][0]; mode = 'pan'; g0 = this._groundPoint(p.x, p.y); pinch0 = null; }
        };
        c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
        c.addEventListener('wheel', (e) => {
            e.preventDefault(); this._lastInputAt = Date.now();
            this.dist *= Math.exp(clamp(e.deltaY, -120, 120) * 0.0014); this._clampCamera();
        }, { passive: false });
    }

    // 點擊:先用螢幕投影找村民(3D 中比地圖像素判定準),再交給基底(馬車站、建築、地點)
    _handleTap(clientX, clientY) {
        const r = this.glCanvas.getBoundingClientRect();
        const sx = clientX - r.left, sy = clientY - r.top;
        let best = null, bestD = this.isMobile ? 34 : 26;
        for (const [aid, pos] of Object.entries(this.agentPositions)) {
            if (aid === 'player') continue;
            const m = this._agentMeshes[aid]; if (!m || !m.visible) continue;
            const p = this._project(pos.x / TILE, 1.0, pos.y / TILE); if (!p) continue;
            const d = Math.hypot(p.x - sx, p.y - sy);
            if (d < bestD) { bestD = d; best = aid; }
        }
        if (best) { if (this.onAgentClick) this.onAgentClick(best); return; }
        const mp = this._screenToMap(clientX, clientY); this._lastTapExact = !!this.getLocationAt(mp.x, mp.y); // v6.29.0 app 用來決定要不要開建築卡
        super._handleTap(clientX, clientY);
    }

    // ---------- 材質 / 幾何快取 ----------
    _mat(hex, opts) {
        const key = hex + (opts ? JSON.stringify(opts) : '');
        if (!this._mats[key]) { const m = new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(hex) }, opts || {})); m.userData.plain = !opts; this._mats[key] = m; } // v6.43.0 plain＝可併進頂點色大網格
        return this._mats[key];
    }
    // v6.43.0 頂點色共用材質:靜態場景與村民都用它,幾百種顏色一次畫完
    // v6.54.0 窗戶材質:合併後每個頂點帶「第幾棟」(aBid),亮度查 uLit[棟];有人醒著才亮、全家睡了就暗
    _makeWinMat() {
        const m = new THREE.MeshLambertMaterial({ color: new THREE.Color('#9CC8E8'), emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0 });
        if (!this._winLit) this._winLit = new Float32Array(64).fill(1);
        const lit = { value: this._winLit };
        m.onBeforeCompile = (sh) => {
            sh.uniforms.uLit = lit;
            sh.vertexShader = 'attribute float aBid;\nuniform float uLit[64];\nvarying float vLit;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvLit = uLit[int(aBid + 0.5)];');
            sh.fragmentShader = 'varying float vLit;\n' + sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vLit;');
        };
        m.customProgramCacheKey = () => 'rt-win-lit';
        return m;
    }
    _vcMat() { if (!this._vcm) this._vcm = new THREE.MeshLambertMaterial({ vertexColors: true }); return this._vcm; }
    // v6.44.0 村民專用材質:晚上依自己的顏色微微自發光(像被路燈／月光補光),臉和衣服看得清楚但不會變成一片白;
    // 只改村民,房子、地面照舊用 _vcMat 跟著夜色變暗。同一份材質、只多一個 uniform,不增加繪製呼叫
    _agentMat() {
        if (!this._agm) {
            const m = new THREE.MeshLambertMaterial({ vertexColors: true });
            this._selfLit = { value: 0 };
            m.onBeforeCompile = (sh) => {
                sh.uniforms.uSelfLit = this._selfLit;
                sh.fragmentShader = 'uniform float uSelfLit;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance += vColor.rgb * uSelfLit;\n#endif');
            };
            m.customProgramCacheKey = () => 'rt-agent-selflit';
            this._agm = m;
        }
        return this._agm;
    }
    // v6.43.0 三角柱(山牆):底 1×1、高 1,沿 z 延伸
    _prismGeo() {
        return this._geo('prism', () => {
            const A = [-0.5, -0.5, 0.5], B = [0.5, -0.5, 0.5], C = [0, 0.5, 0.5], A2 = [-0.5, -0.5, -0.5], B2 = [0.5, -0.5, -0.5], C2 = [0, 0.5, -0.5];
            const tris = [A, B, C, A2, C2, B2, A, C, C2, A, C2, A2, B, C2, C, B, B2, C2, A, A2, B2, A, B2, B];
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
            g.setIndex([...Array(tris.length).keys()]); return g;
        });
    }
    _prism(w, h, d, hex, x, y, z, parent) {
        const m = new THREE.Mesh(this._prismGeo(), this._mat(hex));
        m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
        (parent || this._static).add(m); return m;
    }
    // v6.32.0 樹冠風搖:頂點著色器依世界座標相位左右擺(零 CPU 成本;風力隨天氣)
    _canopyMat() {
        if (this._canopy) return this._canopy;
        const m = new THREE.MeshLambertMaterial({ color: new THREE.Color('#ffffff') });
        m.onBeforeCompile = (sh) => {
            sh.uniforms.uTime = { value: 0 }; sh.uniforms.uWind = { value: 0.7 };
            sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n float swPh = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9;\n#else\n float swPh = 0.0;\n#endif\n float swA = (position.y + 1.0) * 0.045 * uWind;\n transformed.x += sin(uTime * 1.3 + swPh) * swA;\n transformed.z += cos(uTime * 1.1 + swPh * 1.3) * swA * 0.6;');
            m.userData.shader = sh;
        };
        this._canopy = m; return m;
    }
    _geo(key, make) { if (!this._geos[key]) { const g = make().toNonIndexed(); g.computeVertexNormals(); this._geos[key] = g; } return this._geos[key]; }
    _box(w, h, d, hex, x, y, z, parent, opts) {
        const m = new THREE.Mesh(this._geo('box', () => new THREE.BoxGeometry(1, 1, 1)), this._mat(hex, opts));
        m.scale.set(w, h, d); m.position.set(x, y, z);
        m.castShadow = true; m.receiveShadow = true;
        (parent || this._static).add(m); return m;
    }
    _cyl(rt, rb, h, seg, hex, x, y, z, parent, opts) {
        const m = new THREE.Mesh(this._geo('cyl' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg)), this._mat(hex, opts));
        m.scale.set(rt, h, rb); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
        (parent || this._static).add(m); return m;
    }
    _cone(r, h, seg, hex, x, y, z, parent, opts) {
        const m = new THREE.Mesh(this._geo('cone' + seg, () => new THREE.ConeGeometry(1, 1, seg)), this._mat(hex, opts));
        m.scale.set(r, h, r); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
        (parent || this._static).add(m); return m;
    }

    // ---------- 地形 ----------
    _tileBase(tile) {
        if (tile === T.WATER || tile === T.WATER2) return -0.55;
        if (tile === T.CHASM) return -1.1;
        if (tile === T.BRIDGE || tile === T.PIER) return -0.55; // 棧橋/橋面另外用木板盒子畫,地形當作水
        return 0;
    }
    _isWaterLike(tile) { return tile === T.WATER || tile === T.WATER2 || tile === T.BRIDGE || tile === T.PIER; }
    _vertexY(vx, vz) {
        let minB = 0, allLand = true, n = 0;
        for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
            const tx = vx + dx, tz = vz + dz;
            if (tx < 0 || tz < 0 || tx >= this.cols || tz >= this.rows) continue;
            const b = this._tileBase(this.grid[tz][tx]); n++;
            if (b < minB) minB = b; if (b !== 0) allLand = false;
        }
        if (!n) return 0;
        return allLand ? hash2(vx, vz, 7) * 0.05 : minB;
    }
    groundY(tx, tz) {
        const x = Math.floor(tx), z = Math.floor(tz);
        return (this._vertexY(x, z) + this._vertexY(x + 1, z) + this._vertexY(x, z + 1) + this._vertexY(x + 1, z + 1)) / 4;
    }
    _groundColor(tile, tx, tz) {
        const season = this.season || '';
        let hex = (tile === T.DIRT && (this.tierLv || 0) >= 2) ? '#ADA79C' : GROUND_COLORS[tile]; // v6.57.0 城市以上道路鋪石板
        if (hex === undefined) {
            // 牆/屋頂/家具等落在建築範圍內的格子:當作室內地板;其餘當草地
            hex = (tile >= T.WALL_TOP && tile <= T.DOOR) || (tile >= T.TABLE && tile <= T.ALTAR) || tile === T.WINDOW || tile === T.CAULDRON || tile === T.WEAPON_RACK || tile === T.STALL || tile === T.BARREL || tile === T.CRATE ? '#CDB58F' : '#7CC45A';
        }
        const c = new THREE.Color(hex);
        const isGrass = tile === T.GRASS || tile === T.GRASS2 || tile === T.GRASS3 || tile === T.TREE_TRUNK || tile === T.TREE_TOP || tile === T.TREE_TOP2 || tile === T.FLOWER1 || tile === T.FLOWER2 || tile === T.BUSH || tile === T.ROCK || tile === T.FENCE_H || tile === T.FENCE_V;
        if (isGrass) {
            if (season === '冬季') c.lerp(new THREE.Color('#E8EEF0'), 0.78);
            else if (season === '秋季') c.lerp(new THREE.Color('#C9B04A'), 0.35);
            else if (season === '夏季') c.lerp(new THREE.Color('#5FB24A'), 0.25);
        }
        const v = (hash2(tx, tz, 3) - 0.5) * 0.05;
        c.offsetHSL(0, 0, v);
        return c;
    }
    _buildTerrain() {
        const cols = this.cols, rows = this.rows;
        const pos = [], col = [], wpos = [];
        const push = (arr, x, y, z) => { arr.push(x, y, z); };
        for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
            const tile = this.grid[z][x];
            const y00 = this._vertexY(x, z), y10 = this._vertexY(x + 1, z), y01 = this._vertexY(x, z + 1), y11 = this._vertexY(x + 1, z + 1);
            const c = this._groundColor(this._isWaterLike(tile) ? T.WATER : tile, x, z);
            if (tile === T.STONE_PATH) {
                // v6.43.0 路面切成 2×2 小格、每格深淺不同:石板路像一塊塊鋪石,泥土路有點斑駁(只多幾個三角形,不用貼圖)
                // v6.49.0 桌機每塊鋪石高低差一點點,像真的石頭(不多切三角形;手機維持平的)
                const N = 2, rel = this._lite() ? 0 : 0.022;
                const Y = (fx, fz) => (y00 * (1 - fx) + y10 * fx) * (1 - fz) + (y01 * (1 - fx) + y11 * fx) * fz;
                const amp = 0.07;
                for (let sz = 0; sz < N; sz++) for (let sx = 0; sx < N; sx++) {
                    const fx0 = sx / N, fx1 = (sx + 1) / N, fz0 = sz / N, fz1 = (sz + 1) / N;
                    const dy = rel ? (hash2(x * N + sx, z * N + sz, 9) - 0.5) * 2 * rel : 0;
                    push(pos, x + fx0, Y(fx0, fz0) + dy, z + fz0); push(pos, x + fx0, Y(fx0, fz1) + dy, z + fz1); push(pos, x + fx1, Y(fx1, fz0) + dy, z + fz0);
                    push(pos, x + fx1, Y(fx1, fz0) + dy, z + fz0); push(pos, x + fx0, Y(fx0, fz1) + dy, z + fz1); push(pos, x + fx1, Y(fx1, fz1) + dy, z + fz1);
                    const cc = c.clone().offsetHSL(0, 0, (hash2(x * N + sx, z * N + sz, 7) - 0.5) * 2 * amp);
                    for (let i = 0; i < 6; i++) col.push(cc.r, cc.g, cc.b);
                }
            } else {
            // 兩個三角形(非索引 → 平面著色)
            push(pos, x, y00, z); push(pos, x, y01, z + 1); push(pos, x + 1, y10, z);
            push(pos, x + 1, y10, z); push(pos, x, y01, z + 1); push(pos, x + 1, y11, z + 1);
            for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
            }
            if (this._isWaterLike(tile)) {
                const wy = -0.22;
                push(wpos, x, wy, z); push(wpos, x, wy, z + 1); push(wpos, x + 1, wy, z);
                push(wpos, x + 1, wy, z); push(wpos, x, wy, z + 1); push(wpos, x + 1, wy, z + 1);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(Uint8Array.from(col, (v) => Math.round(v * 255)), 3, true)); // v6.43.0 顏色 Uint8
        g.computeVertexNormals();
        const terrain = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
        terrain.receiveShadow = true; terrain.name = 'terrain';
        this._static.add(terrain);
        // 地圖邊緣「桌面」:底板,避免看到虛空
        const base = this._box(cols + 8, 1.2, rows + 8, '#5E8E3E', cols / 2, -1.25, rows / 2);
        base.castShadow = false;
        if (wpos.length) {
            const wg = new THREE.BufferGeometry();
            wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
            wg.computeVertexNormals();
            this._waterMat = new THREE.MeshPhongMaterial({ color: new THREE.Color('#4FB0E6'), transparent: true, opacity: 0.82, shininess: 90, specular: new THREE.Color('#BFEAFF') });
            const water = new THREE.Mesh(wg, this._waterMat); water.receiveShadow = true; water.name = 'water';
            this._static.add(water); this._waterMeshes.push(water);
        }
    }

    // ---------- 植物與小物件(instancing) ----------
    _instanced(geo, hex, count, flat, mat) {
        const m = new THREE.InstancedMesh(geo, mat || this._mat(hex, flat ? null : null), Math.max(1, count));
        m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false;
        this._static.add(m); return m;
    }
    _addInst(mesh, x, y, z, sx, sy, sz, rotY, color) {
        const d = this._dummy; d.position.set(x, y, z); d.rotation.set(0, rotY || 0, 0); d.scale.set(sx, sy, sz); d.updateMatrix();
        const i = mesh.count++; mesh.setMatrixAt(i, d.matrix);
        if (color) mesh.setColorAt(i, color);
    }
    _buildVegetation() {
        const cols = this.cols, rows = this.rows, season = this.season || '';
        const lists = { tree: [], pine: [], bush: [], rock: [], flower: [], crop: [], fenceH: [], fenceV: [], deck: [], stall: [], well: [] };
        const theme = this.themeKey || "frontier";
        for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
            const tile = this.grid[z][x];
            if (tile === T.TREE_TOP || tile === T.TREE_TOP2) {
                const r = hash2(x, z, 11);
                const pine = theme === 'mountain' ? r < 0.8 : theme === 'forest' ? r < 0.45 : r < 0.25;
                lists[pine ? 'pine' : 'tree'].push({ x, z, r });
            } else if (tile === T.BUSH) lists.bush.push({ x, z, r: hash2(x, z, 12) });
            else if (tile === T.ROCK) lists.rock.push({ x, z, r: hash2(x, z, 13) });
            else if (tile === T.FLOWER1 || tile === T.FLOWER2) lists.flower.push({ x, z, r: hash2(x, z, 14), c: tile === T.FLOWER1 ? '#E85C8A' : '#F2B13C' });
            else if (tile === T.CROP1 || tile === T.CROP2 || tile === T.CROP3) lists.crop.push({ x, z, r: hash2(x, z, 15), g: tile - T.CROP1 });
            else if (tile === T.FENCE_H) lists.fenceH.push({ x, z });
            else if (tile === T.FENCE_V) lists.fenceV.push({ x, z });
            else if (tile === T.BRIDGE || tile === T.PIER) lists.deck.push({ x, z });
            else if (tile === T.STALL && !this._zoneAt(x, z, true)) lists.stall.push({ x, z, r: hash2(x, z, 16) });
            else if (tile === T.WELL && !this._zoneAt(x, z, true) && !(this._fountain && Math.hypot(this._fountain.x / TILE - x, this._fountain.y / TILE - z) < 2.5)) lists.well.push({ x, z });
        }
        const canopyCol = (r, pine) => {
            const c = new THREE.Color(pine ? (r < 0.5 ? '#2F7A4A' : '#3C8C58') : (r < 0.33 ? '#4FA85A' : r < 0.66 ? '#5DB867' : '#3F9A52'));
            if (season === '秋季' && !pine) c.lerp(new THREE.Color(r < 0.5 ? '#E08A2E' : '#C9553D'), 0.75);
            else if (season === '冬季') c.lerp(new THREE.Color('#DDE6E8'), pine ? 0.45 : 0.7);
            else if (season === '春季' && !pine && r > 0.93) c.lerp(new THREE.Color('#F0A3C0'), 0.55);
            return c;
        };
        // 樹:樹幹(圓柱)+ 樹冠(二十面體 or 兩層圓錐)
        const nTree = lists.tree.length + lists.pine.length;
        if (nTree) {
            // v6.43.0 樹幹與松樹層改開口(看不到的頂／底面不畫);森林深處的樹維持一團樹冠,只有看得見的樹才加側冠／第三層
            const rich = !this._lite(); // v6.49.0 桌機:樹根外擴、部分闊葉樹掛果／開花(用同一組 instancing,不增加繪製次數)
            const trunks = this._instanced(this._geo('trunkO', () => new THREE.CylinderGeometry(0.12, 0.17, 1, 6, 1, true)), '#7A4E2E', nTree * (rich ? 2 : 1));
            const blobs = this._instanced(this._geo('blob', () => new THREE.IcosahedronGeometry(1, 0)), '#ffffff', Math.max(1, lists.tree.length), false, this._canopyMat());
            const side = this._instanced(this._geo('blobS', () => new THREE.OctahedronGeometry(1, 0)), '#ffffff', Math.max(1, lists.tree.length * (rich ? 5 : 2)), false, this._canopyMat());
            const fruitCol = season === '春季' ? ['#F6C3D5', '#FFFFFF'] : season === '秋季' ? ['#E0552E', '#F2B13C'] : season === '夏季' ? ['#D9443A', '#E8732A'] : null;
            const cones = this._instanced(this._geo('cone6o', () => new THREE.ConeGeometry(1, 1, 6, 1, true)), '#ffffff', Math.max(1, lists.pine.length * 3), false, this._canopyMat());
            const isTree = (x, z) => { const t = this.grid[z]?.[x]; return t === T.TREE_TOP || t === T.TREE_TOP2 || t === T.TREE_TRUNK; };
            const dense = (x, z) => { let n = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if ((dx || dz) && isTree(x + dx, z + dz)) n++; return n >= 7; };
            for (const t of lists.tree) {
                const ox = (hash2(t.x, t.z, 21) - 0.5) * 0.5, oz = (hash2(t.x, t.z, 22) - 0.5) * 0.5;
                const gx = t.x + 0.5 + ox, gz = t.z + 0.5 + oz, gy = this.groundY(gx, gz);
                const s = 0.85 + t.r * 0.5, th = 0.7 * s;
                this._addInst(trunks, gx, gy + th / 2, gz, 1, th, 1);
                if (rich) this._addInst(trunks, gx, gy + 0.06, gz, 1.7, 0.14, 1.7, t.r * 6); // v6.49.0 樹根外擴
                // v6.43.0 闊葉樹三團樹冠(主冠＋兩團側冠,深淺不同),同一個 instancing 網格,不增加繪製次數
                const cc = canopyCol(t.r, false), ccL = cc.clone().offsetHSL(0, 0, 0.05), ccD = cc.clone().offsetHSL(0, 0, -0.05);
                this._addInst(blobs, gx, gy + th + 0.55 * s, gz, 0.6 * s, 0.66 * s, 0.6 * s, t.r * 6.28, cc);
                if (!dense(t.x, t.z) && !this._lite()) { // v6.43.0 手機／低畫質維持一團樹冠
                    const a1 = t.r * 6.28;
                    this._addInst(side, gx + Math.cos(a1) * 0.34 * s, gy + th + 0.42 * s, gz + Math.sin(a1) * 0.34 * s, 0.42 * s, 0.4 * s, 0.42 * s, a1 * 2, ccD);
                    this._addInst(side, gx - Math.cos(a1 + 0.9) * 0.26 * s, gy + th + 0.86 * s, gz - Math.sin(a1 + 0.9) * 0.26 * s, 0.36 * s, 0.36 * s, 0.36 * s, a1 * 3, ccL);
                    // v6.49.0 三成的樹掛果(夏秋)或開花(春):樹冠表面幾顆小點
                    if (rich && fruitCol && hash2(t.x, t.z, 31) < 0.32) for (let k = 0; k < 3; k++) { const a = a1 + k * 2.1, rr = 0.52 * s; this._addInst(side, gx + Math.cos(a) * rr, gy + th + (0.5 + k * 0.12) * s, gz + Math.sin(a) * rr, 0.07, 0.07, 0.07, 0, new THREE.Color(fruitCol[k % 2])); }
                }
            }
            for (const t of lists.pine) {
                const ox = (hash2(t.x, t.z, 21) - 0.5) * 0.5, oz = (hash2(t.x, t.z, 22) - 0.5) * 0.5;
                const gx = t.x + 0.5 + ox, gz = t.z + 0.5 + oz, gy = this.groundY(gx, gz);
                const s = 0.9 + t.r * 0.5, th = 0.5 * s;
                this._addInst(trunks, gx, gy + th / 2, gz, 1, th, 1);
                const c = canopyCol(t.r, true);
                // v6.43.0 松樹三層,越上越小、越上越亮
                if (dense(t.x, t.z)) {
                    this._addInst(cones, gx, gy + th + 0.6 * s, gz, 0.58 * s, 1.2 * s, 0.58 * s, t.r * 3, c);
                    this._addInst(cones, gx, gy + th + 1.15 * s, gz, 0.42 * s, 0.9 * s, 0.42 * s, t.r * 3 + 0.5, c);
                } else {
                    this._addInst(cones, gx, gy + th + 0.5 * s, gz, 0.62 * s, 1.0 * s, 0.62 * s, t.r * 3, c.clone().offsetHSL(0, 0, -0.04));
                    this._addInst(cones, gx, gy + th + 0.95 * s, gz, 0.48 * s, 0.85 * s, 0.48 * s, t.r * 3 + 0.5, c);
                    this._addInst(cones, gx, gy + th + 1.35 * s, gz, 0.32 * s, 0.7 * s, 0.32 * s, t.r * 3 + 1, c.clone().offsetHSL(0, 0, 0.05));
                }
            }
            trunks.instanceMatrix.needsUpdate = true; blobs.instanceMatrix.needsUpdate = true; cones.instanceMatrix.needsUpdate = true; side.instanceMatrix.needsUpdate = true;
            if (blobs.instanceColor) blobs.instanceColor.needsUpdate = true; if (cones.instanceColor) cones.instanceColor.needsUpdate = true; if (side.instanceColor) side.instanceColor.needsUpdate = true;
        }
        if (lists.bush.length) {
            const m = this._instanced(this._geo('blob', () => new THREE.IcosahedronGeometry(1, 0)), '#ffffff', lists.bush.length * 2);
            for (const b of lists.bush) { const s = 0.3 + b.r * 0.18, gy = this.groundY(b.x + 0.5, b.z + 0.5), bc = canopyCol(b.r * 0.9, false); this._addInst(m, b.x + 0.5, gy + s * 0.6, b.z + 0.5, s * 1.2, s, s * 1.2, b.r * 6, bc); this._addInst(m, b.x + 0.5 + s * 0.6, gy + s * 0.45, b.z + 0.5 - s * 0.3, s * 0.75, s * 0.7, s * 0.75, b.r * 9, bc.clone().offsetHSL(0, 0, 0.05)); } // v6.43.0 兩團
            m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        if (lists.rock.length) {
            const m = this._instanced(this._geo('rock', () => new THREE.DodecahedronGeometry(1, 0)), '#9AA0A6', lists.rock.length);
            for (const b of lists.rock) { const s = 0.22 + b.r * 0.2; this._addInst(m, b.x + 0.5, this.groundY(b.x + 0.5, b.z + 0.5) + s * 0.5, b.z + 0.5, s * 1.3, s, s, b.r * 6); }
            m.instanceMatrix.needsUpdate = true;
        }
        if (lists.flower.length) {
            const stems = this._instanced(this._geo('box', () => new THREE.BoxGeometry(1, 1, 1)), '#5DA74C', lists.flower.length * 3);
            const heads = this._instanced(this._geo('blob', () => new THREE.IcosahedronGeometry(1, 0)), '#ffffff', lists.flower.length * 3);
            for (const f of lists.flower) for (let i = 0; i < 3; i++) {
                const ox = hash2(f.x, f.z, 30 + i) * 0.8 - 0.4, oz = hash2(f.x, f.z, 40 + i) * 0.8 - 0.4;
                const gx = f.x + 0.5 + ox, gz = f.z + 0.5 + oz, gy = this.groundY(gx, gz);
                this._addInst(stems, gx, gy + 0.12, gz, 0.04, 0.24, 0.04);
                this._addInst(heads, gx, gy + 0.27, gz, 0.09, 0.08, 0.09, 0, new THREE.Color(i === 1 ? '#FFFFFF' : f.c));
            }
            stems.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
        }
        if (lists.crop.length) {
            const m = this._instanced(this._geo('box', () => new THREE.BoxGeometry(1, 1, 1)), '#ffffff', lists.crop.length * 4);
            for (const c of lists.crop) {
                const col = new THREE.Color(c.g === 0 ? '#7FBF4A' : c.g === 1 ? '#8FCC52' : '#D9B34A');
                const h = 0.18 + c.g * 0.12;
                for (let i = 0; i < 4; i++) {
                    const gx = c.x + 0.25 + (i % 2) * 0.5, gz = c.z + 0.25 + Math.floor(i / 2) * 0.5;
                    this._addInst(m, gx, this.groundY(gx, gz) + h / 2, gz, 0.22, h, 0.22, 0, col);
                }
            }
            m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        const nFence = lists.fenceH.length + lists.fenceV.length;
        if (nFence) {
            const m = this._instanced(this._geo('box', () => new THREE.BoxGeometry(1, 1, 1)), '#A8825A', nFence * 3);
            for (const f of lists.fenceH) {
                const gy = this.groundY(f.x + 0.5, f.z + 0.5);
                this._addInst(m, f.x + 0.5, gy + 0.42, f.z + 0.5, 1.0, 0.07, 0.07); this._addInst(m, f.x + 0.5, gy + 0.22, f.z + 0.5, 1.0, 0.07, 0.07); this._addInst(m, f.x + 0.5, gy + 0.3, f.z + 0.5, 0.1, 0.6, 0.1);
            }
            for (const f of lists.fenceV) {
                const gy = this.groundY(f.x + 0.5, f.z + 0.5);
                this._addInst(m, f.x + 0.5, gy + 0.42, f.z + 0.5, 0.07, 0.07, 1.0); this._addInst(m, f.x + 0.5, gy + 0.22, f.z + 0.5, 0.07, 0.07, 1.0); this._addInst(m, f.x + 0.5, gy + 0.3, f.z + 0.5, 0.1, 0.6, 0.1);
            }
            m.instanceMatrix.needsUpdate = true;
        }
        if (lists.deck.length) {
            const m = this._instanced(this._geo('box', () => new THREE.BoxGeometry(1, 1, 1)), '#A8784E', lists.deck.length * 2);
            for (const d of lists.deck) { this._addInst(m, d.x + 0.5, -0.05, d.z + 0.5, 1.0, 0.12, 1.0); if (hash2(d.x, d.z, 50) < 0.35) this._addInst(m, d.x + 0.15, -0.3, d.z + 0.15, 0.14, 0.9, 0.14); }
            m.instanceMatrix.needsUpdate = true;
        }
        for (const s of lists.stall) {
            const gx = s.x + 0.5, gz = s.z + 0.5, gy = this.groundY(gx, gz);
            const col = ['#C9533D', '#3C7E71', '#D2B23D', '#4F6F93'][Math.floor(s.r * 4)];
            this._box(0.9, 0.45, 0.6, '#A8784E', gx, gy + 0.23, gz);
            this._box(0.08, 1.1, 0.08, '#7A4E2E', gx - 0.4, gy + 0.55, gz - 0.25); this._box(0.08, 1.1, 0.08, '#7A4E2E', gx + 0.4, gy + 0.55, gz - 0.25);
            this._box(1.05, 0.08, 0.9, col, gx, gy + 1.1, gz);
        }
        for (const w of lists.well) {
            const gx = w.x + 0.5, gz = w.z + 0.5, gy = this.groundY(gx, gz);
            this._cyl(0.42, 0.46, 0.5, 8, '#9AA0A6', gx, gy + 0.25, gz);
            this._cyl(0.3, 0.3, 0.1, 8, '#4FB0E6', gx, gy + 0.46, gz);
            this._box(0.08, 1.0, 0.08, '#7A4E2E', gx - 0.4, gy + 0.9, gz); this._box(0.08, 1.0, 0.08, '#7A4E2E', gx + 0.4, gy + 0.9, gz);
            this._cone(0.65, 0.4, 4, '#8C5A3C', gx, gy + 1.5, gz).rotation.y = Math.PI / 4;
        }
    }
    // v6.43.0 路邊石與草叢:石板路靠草地的那一邊排兩塊路緣石;草地上零星草叢(低畫質不畫)。各一個 instancing 網格
    _buildGroundDetail() {
        const cols = this.cols, rows = this.rows, season = this.season || '';
        const grassy = (t) => t === T.GRASS || t === T.GRASS2 || t === T.GRASS3 || t === T.FLOWER1 || t === T.FLOWER2;
        const curbs = [], tufts = [];
        for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
            const tile = this.grid[z][x];
            if (tile === T.STONE_PATH) {
                for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nt = this.grid[z + dz]?.[x + dx]; if (nt === undefined || !grassy(nt)) continue;
                    for (const k of [0.27, 0.73]) curbs.push({ x: dx ? x + 0.5 + dx * 0.44 : x + k, z: dz ? z + 0.5 + dz * 0.44 : z + k, along: dx ? 'z' : 'x', r: hash2(x * 4 + dx, z * 4 + dz, 60 + k * 10) });
                }
            } else if (grassy(tile) && !this._lite() && season !== '冬季' && hash2(x, z, 70) < 0.12) {
                const n = 1;
                for (let i = 0; i < n; i++) tufts.push({ x: x + 0.2 + hash2(x, z, 72 + i) * 0.6, z: z + 0.2 + hash2(x, z, 74 + i) * 0.6, r: hash2(x, z, 76 + i) });
            }
        }
        if (curbs.length) {
            const m = this._instanced(this._geo('box', () => new THREE.BoxGeometry(1, 1, 1)), '#ffffff', curbs.length);
            const base = new THREE.Color('#A39A8C');
            for (const c of curbs) { const gy = this.groundY(c.x, c.z); const col = base.clone().offsetHSL(0, 0, (c.r - 0.5) * 0.12); this._addInst(m, c.x, gy + 0.04, c.z, c.along === 'x' ? 0.42 : 0.14, 0.1, c.along === 'x' ? 0.14 : 0.42, (c.r - 0.5) * 0.2, col); }
            m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        if (tufts.length) {
            const m = this._instanced(this._geo('tuftO', () => new THREE.ConeGeometry(1, 1, 3, 1, true)), '#ffffff', tufts.length * 3, false, this._canopyMat());
            m.castShadow = false;
            for (const t of tufts) {
                const gy = this.groundY(t.x, t.z), col = new THREE.Color(t.r < 0.5 ? '#5DA74C' : '#6FB956');
                if (season === '秋季') col.lerp(new THREE.Color('#C9A84A'), 0.5);
                for (let i = 0; i < 3; i++) { const a = t.r * 6.28 + i * 2.1; this._addInst(m, t.x + Math.cos(a) * 0.06, gy + 0.09, t.z + Math.sin(a) * 0.06, 0.05, 0.18 + (i === 1 ? 0.06 : 0), 0.05, a, col); }
            }
            m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
    }
    _zoneAt(tx, tz, doorOnly) {
        for (const z of Object.values(this.buildingZones)) {
            if (doorOnly && z.doorPixelX === undefined) continue;
            if (tx >= z.x && tx < z.x + z.w && tz >= z.y && tz < z.y + z.h) return z;
        }
        return null;
    }

    // ---------- 建築 ----------
    _buildBuildings() {
        const theme = this.themeKey || "frontier";
        const roofs = this.roofPalette || ROOF_PALETTE[theme] || ROOF_PALETTE.frontier; // v6.45.0 種子鎮有自己的屋頂配色
        this._buildingTops = {};
        this._winIdx = {}; this._winPub = {}; this._doorGlow = []; let winN = 0; // v6.54.0 每棟一個窗燈編號(0 = 不分棟、照常亮)
        for (const [locId, z] of Object.entries(this.buildingZones)) {
            if (z.doorPixelX === undefined) continue; // 住宅區父層、農田、礦場、廣場等不是盒子建築
            const bid = winN < 63 ? ++winN : 0; this._winIdx[locId] = bid;
            const h = hash32(locId);
            const tmpl = LOCATION_BUILDING[locId] || (z.parentLocId ? 'house' : 'house');
            const w = z.w, d = z.h; // 範圍含屋頂列,當作完整腳印
            const cx = z.x + w / 2, cz = z.y + d / 2;
            const big = w * d >= 30;
            const style = tmpl === 'house' ? (this.houseLevels?.[locId] ?? this.eraStyle ?? 1) : (this.eraStyle ?? 1); // v6.57.0 依時代／翻修程度換建材
            const wallH = (tmpl === 'house' ? 1.5 + (h % 3) * 0.15 : big ? 2.4 : 2.0) * (style === 2 ? 1.45 : 1);
            const wall = style === 0 ? WOOD_WALLS[h % WOOD_WALLS.length] : style === 2 ? BRICK_WALLS[h % BRICK_WALLS.length] : WALL_PALETTE[h % WALL_PALETTE.length];
            const roof = style === 0 ? THATCH_ROOFS[(h >>> 4) % THATCH_ROOFS.length] : style === 2 ? SLATE_ROOFS[(h >>> 4) % SLATE_ROOFS.length] : roofs[(h >>> 4) % roofs.length];
            const g = new THREE.Group(); g.position.set(cx, 0, cz); this._static.add(g);
            this._box(w, wallH + 0.3, d, wall, 0, wallH / 2 - 0.15, 0, g);
            // v6.43.0 石砌地基
            const stone = ['#9A9184', '#8C8478', '#A39A8C'][h % 3], wood = '#5A3E2B', roofDk = (() => { const k = new THREE.Color(roof); k.multiplyScalar(0.72); return '#' + k.getHexString(); })();
            this._box(w + 0.14, 0.32, d + 0.14, stone, 0, 0.06, 0, g);
            // v6.49.0 牆腳一圈深色護牆板(看起來比較有重量)
            { const k = new THREE.Color(wall); k.multiplyScalar(0.82); this._box(w + 0.04, 0.34, d + 0.04, '#' + k.getHexString(), 0, 0.37, 0, g); }
            // v6.43.0 民宅木骨架:四角柱＋腰樑＋頂樑
            if (tmpl === 'house') {
                for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) this._box(0.14, wallH, 0.14, wood, px, wallH / 2, pz, g);
                for (const yy of (this._lite() ? [wallH - 0.06] : [wallH * 0.48, wallH - 0.06])) { // v6.43.0 手機／低畫質只留頂樑
                    this._box(w + 0.02, 0.1, 0.06, wood, 0, yy, d / 2 + 0.02, g); this._box(w + 0.02, 0.1, 0.06, wood, 0, yy, -d / 2 - 0.02, g);
                    this._box(0.06, 0.1, d + 0.02, wood, w / 2 + 0.02, yy, 0, g); this._box(0.06, 0.1, d + 0.02, wood, -w / 2 - 0.02, yy, 0, g);
                }
            }
            // 屋頂:教堂／崗哨仍是尖頂;其他改成人字形雙坡屋頂(兩片屋面＋山牆＋屋脊),屋脊順著長邊
            const roofH = tmpl === 'chapel' ? 1.8 : big ? 1.3 : 1.0;
            if (tmpl === 'chapel' || tmpl === 'guardpost') {
                const r = this._cone(1, roofH, 4, roof, 0, wallH + roofH / 2, 0, g); r.rotation.y = Math.PI / 4; r.scale.set((w + 0.5) * 0.707, roofH, (d + 0.5) * 0.707);
                this._box(w + 0.5, 0.12, d + 0.5, roofDk, 0, wallH + 0.02, 0, g);
            } else {
                const along = d >= w; const span = along ? w : d, len = along ? d : w;
                const rg = new THREE.Group(); rg.rotation.y = along ? 0 : Math.PI / 2; g.add(rg);
                const eave = 0.32, half = span / 2 + eave, ang = Math.atan2(roofH, half), slab = Math.hypot(half, roofH) + 0.06;
                const baseY = wallH - roofH * eave / half; // 屋面剛好壓在牆頂邊
                const roofMid = (() => { const k = new THREE.Color(roof); k.multiplyScalar(0.86); return '#' + k.getHexString(); })();
                for (const sgn of [-1, 1]) {
                    const sl = this._box(slab, 0.12, len + 0.5, roof, sgn * half / 2, baseY + roofH / 2, 0, rg); sl.rotation.z = -sgn * ang;
                    const fa = this._box(0.06, 0.16, len + 0.52, roofDk, sgn * (half - 0.02), baseY - 0.02, 0, rg); // 簷口
                    // v6.49.0 瓦片橫紋:沿屋面排三道略深的瓦列(併進同一個網格,不增加繪製次數)
                    const nx = sgn * Math.sin(ang), ny = Math.cos(ang);
                    for (const f of [0.22, 0.48, 0.74]) { const st = this._box(0.07, 0.05, len + 0.5, roofMid, sgn * half * (1 - f) + nx * 0.075, baseY + roofH * f + ny * 0.075, 0, rg); st.rotation.z = -sgn * ang; }
                }
                this._box(0.2, 0.14, len + 0.56, roofDk, 0, baseY + roofH + 0.02, 0, rg); // 屋脊
                const gh = roofH * (span / 2) / half;
                this._prism(span, gh, len, wall, 0, wallH + gh / 2, 0, rg); // 山牆
                if (tmpl === 'house') this._box(0.08, gh * 0.9, 0.06, wood, 0, wallH + gh * 0.45, len / 2 + 0.01, rg);
                else if (!this._lite() && gh > 0.6) for (const zs of [1, -1]) this._box(0.34, 0.34, 0.05, '#4A3A30', 0, wallH + gh * 0.42, zs * (len / 2 + 0.02), rg); // v6.49.0 大建築山牆的通風窗
            }
            // 門(在 +z 面,對齊 doorPixelX)+ 門框＋台階＋門把
            const doorX = z.doorPixelX / TILE - cx;
            if (bid && tmpl !== 'house') this._winPub[bid] = tmpl;
            // v6.54.0 門邊掛一盞小燈籠(共用材質,合併後整鎮一次畫完)＋門前地上一小圈暖光
            if (!this._lanternMat) this._lanternMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#FFE2A0'), emissive: new THREE.Color('#FFA640'), emissiveIntensity: 0 });
            { const lx = doorX + (doorX > 0 ? -0.66 : 0.66); const lg = this._geo('box', () => new THREE.BoxGeometry(1, 1, 1));
              const ln = new THREE.Mesh(lg, this._lanternMat); ln.scale.set(0.24, 0.3, 0.24); ln.position.set(lx, 1.32, d / 2 + 0.16); g.add(ln);
              this._box(0.24, 0.05, 0.24, '#2E2A30', lx, 1.47, d / 2 + 0.16, g); this._box(0.04, 0.04, 0.16, '#2E2A30', lx, 1.5, d / 2 + 0.06, g);
              this._doorGlow.push({ x: cx + lx, z: cz + d / 2 + 0.55 }); }
            this._box(0.98, 1.5, 0.06, wood, doorX, 0.75, d / 2 + 0.01, g);
            this._box(0.8, 1.35, 0.1, '#6B4A2E', doorX, 0.67, d / 2 + 0.02, g);
            this._box(0.06, 0.06, 0.06, '#D9B85C', doorX + 0.28, 0.7, d / 2 + 0.09, g);
            this._box(1.1, 0.12, 0.36, stone, doorX, 0.06, d / 2 + 0.2, g);
            // v6.49.0 民宅門上小雨遮＋兩支托架
            if (tmpl === 'house') { const aw = this._box(1.25, 0.07, 0.5, roofDk, doorX, 1.68, d / 2 + 0.24, g); aw.rotation.x = 0.28; for (const sx of [-0.52, 0.52]) { const br = this._box(0.06, 0.06, 0.34, wood, doorX + sx, 1.56, d / 2 + 0.16, g); br.rotation.x = -0.6; } }
            // 窗戶(夜間發光)
            if (!this._winMat) { this._winMat = this._makeWinMat(); } // v6.28.0 全鎮共用一個窗材質,合併後一次畫完
            const winMat = this._winMat; if (!this._winMats.includes(winMat)) this._winMats.push(winMat);
            const winGeo = this._geo('box', () => new THREE.BoxGeometry(1, 1, 1));
            const shutter = ['#3C7E71', '#4F6F93', '#8C5A3C', roof][h % 4];
            const addWin = (x, y, zz, rot) => {
                const m = new THREE.Mesh(winGeo, winMat); m.scale.set(0.42, 0.42, 0.08); m.position.set(x, y, zz); m.rotation.y = rot; m.userData.bid = bid; g.add(m);
                // v6.43.0 窗框、窗台;民宅加百葉、偶爾一個花槽
                const out = rot === 0 ? Math.sign(zz) : 0, outX = rot !== 0 ? Math.sign(x) : 0;
                const fr = this._box(0.56, 0.56, 0.05, wood, x - outX * 0.01, y, zz - out * 0.01, g); fr.rotation.y = rot;
                if (!this._lite() && rot === 0 && out > 0) { // v6.49.0 正面窗戶加十字木條(只畫面向街道的一面;手機／低畫質不畫)
                    const vb = this._box(0.04, 0.44, 0.03, wood, x + outX * 0.05, y, zz + out * 0.05, g); vb.rotation.y = rot;
                    const hb = this._box(0.44, 0.04, 0.03, wood, x + outX * 0.05, y, zz + out * 0.05, g); hb.rotation.y = rot;
                }
                const sill = this._box(0.62, 0.07, 0.16, stone, x + outX * 0.06, y - 0.3, zz + out * 0.06, g); sill.rotation.y = rot;
                if (tmpl === 'house' && !this._lite()) { // v6.43.0 手機／低畫質不畫百葉與花槽
                    for (const sd of [-1, 1]) { const sh = this._box(0.15, 0.48, 0.04, shutter, x + (rot === 0 ? sd * 0.37 : outX * 0.03), y, zz + (rot === 0 ? out * 0.03 : sd * 0.37), g); sh.rotation.y = rot; }
                    if (((h >>> 3) + Math.round(x * 3 + zz * 5)) % 3 === 0) {
                        const fb = this._box(0.5, 0.12, 0.14, '#8C5A3C', x + outX * 0.1, y - 0.38, zz + out * 0.1, g); fb.rotation.y = rot;
                        for (let k = -1; k <= 1; k++) { const fl = this._box(0.1, 0.1, 0.1, ['#E85C8A', '#F2B13C', '#FFFFFF'][(k + 2 + h) % 3], x + (rot === 0 ? k * 0.15 : outX * 0.1), y - 0.28, zz + (rot === 0 ? out * 0.1 : k * 0.15), g); fl.rotation.y = rot; }
                    }
                }
            };
            if (tmpl === 'town_hall' && (this.tierLv || 0) >= 3) { // v6.57.0 王都:市政廳加鐘塔與王旗
                const tx = w / 2 - 0.9, tz = -d / 2 + 0.9;
                this._box(1.3, wallH + 2.6, 1.3, wall, tx, (wallH + 2.6) / 2, tz, g);
                this._box(0.7, 0.7, 0.06, '#F3EBD6', tx, wallH + 1.9, tz + 0.66, g);
                this._cone(1.0, 1.2, 4, '#7A2E8C', tx, wallH + 3.2, tz, g).rotation.y = Math.PI / 4;
                this._box(0.05, 1.0, 0.05, '#3F3A44', tx, wallH + 4.2, tz, g); this._box(0.5, 0.3, 0.03, '#C9A13A', tx + 0.27, wallH + 4.5, tz, g);
            }
            const rows = style === 2 ? [wallH * 0.36, wallH * 0.76] : [wallH * 0.62]; // v6.57.0 磚造樓房兩層窗
            for (const wy of rows) {
                for (let i = 0; i < Math.max(1, Math.floor(w / 2)); i++) {
                    const wx = -w / 2 + 1 + i * 2 + (w % 2 === 0 ? 0 : 0.5);
                    if (Math.abs(wx - doorX) > 0.7 || wy > 1.6) addWin(wx, wy, d / 2 + 0.02, 0);
                    addWin(wx, wy, -d / 2 - 0.02, 0);
                }
                for (let i = 0; i < Math.max(1, Math.floor(d / 2)); i++) { const wz = -d / 2 + 1 + i * 2; addWin(w / 2 + 0.02, wy, wz, Math.PI / 2); addWin(-w / 2 - 0.02, wy, wz, Math.PI / 2); }
            }
            if (style === 2 && tmpl === 'house' && !this._lite()) { // 二樓小陽台
                this._box(Math.min(1.6, w * 0.5), 0.08, 0.45, '#6E5446', doorX, wallH * 0.56, d / 2 + 0.24, g);
                this._box(Math.min(1.6, w * 0.5), 0.3, 0.04, '#3F3A44', doorX, wallH * 0.56 + 0.18, d / 2 + 0.45, g);
            }
            // 煙囪 / 尖塔 / 招牌等職業特徵
            if (tmpl === 'workshop' || tmpl === 'tavern' || (tmpl === 'house' && h % 3 === 0)) {
                const ch = this._box(0.4, 0.9, 0.4, '#8A6A5A', -w / 2 + 0.8, wallH + roofH * 0.6, -d / 2 + 0.8, g);
                this._box(0.5, 0.08, 0.5, '#6E5446', -w / 2 + 0.8, wallH + roofH * 0.6 + 0.47, -d / 2 + 0.8, g); // v6.43.0 煙囪蓋
                if (tmpl !== 'house') { this._chimneyTops = this._chimneyTops || []; this._chimneyTops.push({ x: cx - w / 2 + 0.8, y: wallH + roofH * 0.6 + 0.5, z: cz - d / 2 + 0.8 }); }
            }
            if (tmpl === 'chapel') { this._box(0.12, 0.9, 0.12, '#D9C3A5', 0, wallH + roofH + 0.4, 0, g); this._box(0.4, 0.12, 0.12, '#D9C3A5', 0, wallH + roofH + 0.6, 0, g); }
            if (tmpl === 'guardpost') { const tw = this._box(1.2, wallH + 1.6, 1.2, wall, w / 2 - 0.6, (wallH + 1.6) / 2, -d / 2 + 0.6, g); this._cone(1.0, 0.7, 4, roof, w / 2 - 0.6, wallH + 1.6 + 0.35, -d / 2 + 0.6, g).rotation.y = Math.PI / 4; }
            if (tmpl === 'town_hall') { this._box(0.14, 1.2, 0.14, '#D9C3A5', w / 2 - 0.5, wallH + roofH + 0.4, 0, g); this._box(0.5, 0.3, 0.04, '#E8732A', w / 2 - 0.2, wallH + roofH + 0.85, 0, g); }
            if (tmpl === 'general_store' || tmpl === 'tavern') this._box(Math.min(w - 0.6, 2.4), 0.06, 0.7, tmpl === 'tavern' ? '#C9533D' : '#3C7E71', doorX, 1.5, d / 2 + 0.36, g);
            this._buildingTops[locId] = wallH + roofH + 0.1;
        }
        // 不屬於盒子建築的牆/屋頂格子(穀倉、礦坑入口等):逐格擠出
        const wallGeo = this._geo('box', () => new THREE.BoxGeometry(1, 1, 1));
        let n = 0; const cells = [];
        for (let z = 0; z < this.rows; z++) for (let x = 0; x < this.cols; x++) {
            const tile = this.grid[z][x];
            const isWall = tile === T.WALL_TOP || tile === T.WALL_FRONT || tile === T.WINDOW || tile === T.DOOR;
            const isRoof = tile === T.ROOF || tile === T.ROOF2;
            if (!isWall && !isRoof) continue;
            if (this._zoneAt(x, z, true)) continue;
            cells.push({ x, z, roof: isRoof, door: tile === T.DOOR }); n++;
        }
        if (n) {
            const walls = this._instanced(wallGeo, '#D9C3A5', n), roofM = this._instanced(wallGeo, roofs[0], n);
            for (const c of cells) {
                const gy = this.groundY(c.x + 0.5, c.z + 0.5);
                this._addInst(walls, c.x + 0.5, gy + 0.7, c.z + 0.5, 1, 1.4, 1, 0, new THREE.Color(c.door ? '#6B4A2E' : '#D9C3A5'));
                this._addInst(roofM, c.x + 0.5, gy + (c.roof ? 1.75 : 1.45), c.z + 0.5, 1.02, c.roof ? 0.7 : 0.1, 1.02, 0, new THREE.Color(c.roof ? roofs[1] : '#B8A58C'));
            }
            walls.instanceMatrix.needsUpdate = true; roofM.instanceMatrix.needsUpdate = true;
            if (walls.instanceColor) walls.instanceColor.needsUpdate = true; if (roofM.instanceColor) roofM.instanceColor.needsUpdate = true;
        }
    }

    // ---------- 主題道具、馬車站 ----------
    _buildProps() {
        const P = TILE;
        if (this.coachStation) {
            const cs = this.coachStation, gx = cs.x + cs.w / 2, gz = cs.y + cs.h / 2;
            this._box(cs.w - 0.6, 0.18, 1.4, '#A8784E', gx, 0.09, cs.y + cs.h - 0.9);
            this._box(0.12, 1.6, 0.12, '#7A4E2E', cs.x + 0.6, 0.8, cs.y + 0.8); this._box(0.12, 1.6, 0.12, '#7A4E2E', cs.x + cs.w - 1.8, 0.8, cs.y + 0.8);
            this._box(cs.w - 1.6, 0.1, 1.2, '#8A4A3A', cs.x + cs.w / 2 - 0.6, 1.62, cs.y + 0.8);
            // 馬車:車廂 + 輪 + 馬
            const g = new THREE.Group(); g.position.set(gx, 0, gz + 0.2); g.userData.noMerge = true; this._static.add(g); this._coach = g;
            this._box(1.6, 1.0, 1.0, '#7A5236', 0, 0.85, 0, g); this._box(1.7, 0.1, 1.1, '#C9533D', 0, 1.4, 0, g);
            for (const [wx, wz] of [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]]) { const w = this._cyl(0.28, 0.28, 0.12, 8, '#3A2A1A', wx, 0.28, wz, g); w.rotation.x = Math.PI / 2; }
            this._box(1.1, 0.6, 0.5, '#8A6A4A', -1.7, 0.75, 0, g); this._box(0.4, 0.5, 0.4, '#8A6A4A', -2.35, 1.0, 0, g);
            for (const lx of [-1.4, -2.0]) for (const lz of [-0.18, 0.18]) this._box(0.12, 0.5, 0.12, '#6A4A2A', lx, 0.25, lz, g);
        }
        const cyl = (r, h, hex, x, y, z) => this._cyl(r, r, h, 10, hex, x, y, z);
        if (this._lighthouse) {
            const lx = this._lighthouse.tx + 0.5, lz = this._lighthouse.ty + 0.5;
            cyl(0.9, 0.5, '#9AA0A6', lx, 0.25, lz);
            for (let i = 0; i < 4; i++) cyl(0.62 - i * 0.05, 1.2, i % 2 ? '#C9533D' : '#F6EEDC', lx, 1.1 + i * 1.2, lz);
            const lamp = this._cyl(0.5, 0.5, 0.7, 10, '#FFE9A8', lx, 5.6, lz, null, { emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0.3 }); this._glowMats.push(lamp.material);
            this._cone(0.65, 0.5, 10, '#6B6F78', lx, 6.2, lz);
        }
        if (this._boats) {
            this._boatMeshes = [];
            for (const b of this._boats) {
                const g = new THREE.Group(); g.position.set(b.x + 0.5, -0.15, b.y + 0.5); g.rotation.y = b.phase; g.userData.noMerge = true; this._static.add(g);
                this._box(1.8, 0.4, 0.8, '#8C5A3C', 0, 0.2, 0, g); this._box(1.4, 0.1, 0.6, '#D9C3A5', 0, 0.42, 0, g);
                if (b.sail) { this._box(0.08, 1.6, 0.08, '#7A4E2E', 0.1, 1.2, 0, g); this._box(0.03, 1.1, 0.8, '#F6EEDC', 0.16, 1.25, 0.2, g); }
                this._boatMeshes.push({ g, phase: b.phase });
            }
        }
        if (this._pier && this._pier.stemX !== undefined) {
            const p = this._pier;
            for (let y = p.stemY0; y <= p.stemY1; y += 2) for (const x of [p.stemX, p.stemX + p.stemW - 1]) this._box(0.16, 1.0, 0.16, '#6B4A2E', x + 0.2, -0.3, y + 0.5);
        }
        if (this._fountain) {
            const fx = this._fountain.x / P, fz = this._fountain.y / P;
            cyl(1.3, 0.35, '#B8B2A8', fx, 0.17, fz); const w = cyl(1.1, 0.1, '#4FB0E6', fx, 0.36, fz); w.material = this._waterMat || w.material;
            cyl(0.22, 0.9, '#B8B2A8', fx, 0.7, fz); cyl(0.55, 0.12, '#B8B2A8', fx, 1.15, fz);
        }
        if (this._firePit) {
            const fx = this._firePit.x / P, fz = this._firePit.y / P;
            for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; this._box(0.3, 0.22, 0.3, '#8A8A8A', fx + Math.cos(a) * 0.7, 0.11, fz + Math.sin(a) * 0.7).rotation.y = a; }
            const flame = this._cone(0.35, 0.7, 6, '#FF8A3D', fx, 0.45, fz, null, { emissive: new THREE.Color('#FF6A1A'), emissiveIntensity: 0.8 }); this._flame = flame;
            for (let i = 0; i < 3; i++) this._box(0.9, 0.14, 0.3, '#8C5A3C', fx + Math.cos(i * 1.2) * 1.8, 0.07, fz + Math.sin(i * 1.2) * 1.8).rotation.y = i * 1.2 + 1.57;
        }
        if (this._elderTree) {
            const ex = this._elderTree.x / P, ez = this._elderTree.y / P;
            this._cyl(0.5, 0.8, 2.6, 7, '#6B4226', ex, 1.3, ez);
            const col = new THREE.Color(this.season === '秋季' ? '#E08A2E' : '#4FA85A');
            for (const [ox, oy, oz, s] of [[0, 3.4, 0, 2.2], [-1.3, 2.9, 0.4, 1.4], [1.2, 3.0, -0.5, 1.5], [0.3, 2.7, 1.3, 1.3]]) { const m = new THREE.Mesh(this._geo('blob', () => new THREE.IcosahedronGeometry(1, 0)), this._mat('#' + col.getHexString())); m.position.set(ex + ox, oy, ez + oz); m.scale.set(s, s * 0.85, s); m.castShadow = true; this._static.add(m); }
        }
        if (this._watchtower) {
            const wx = this._watchtower.x + 1, wz = this._watchtower.y + 1;
            this._box(1.6, 4.2, 1.6, '#A8825A', wx, 2.1, wz); this._box(2.2, 0.2, 2.2, '#8C5A3C', wx, 4.3, wz);
            for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this._box(0.14, 1.0, 0.14, '#7A4E2E', wx + ox, 4.9, wz + oz);
            this._cone(1.7, 0.9, 4, '#6B6F78', wx, 5.85, wz).rotation.y = Math.PI / 4;
        }
        if (this._hotSpring) {
            const h = this._hotSpring;
            this._box(h.w + 0.6, 0.3, h.h + 0.6, '#9AA0A6', h.x + h.w / 2, 0.15, h.y + h.h / 2);
            const w = this._box(h.w, 0.1, h.h, '#7FD1E8', h.x + h.w / 2, 0.32, h.y + h.h / 2, null, { transparent: true, opacity: 0.85 }); w.castShadow = false;
        }
        if (this._tents) for (const tn of this._tents) { const m = this._cone(0.9, 1.3, 5, tn.c, tn.x / P, 0.65, tn.y / P); m.rotation.y = hash2(Math.round(tn.x), Math.round(tn.y)) * 3; }
        if (this._gates) for (const g of this._gates) {
            const gx = g.x + 0.5, gz = g.y + 0.5;
            if (g.vertical) { this._box(0.5, 2.6, 0.5, '#9AA0A6', gx, 1.3, gz - 1.2); this._box(0.5, 2.6, 0.5, '#9AA0A6', gx, 1.3, gz + 1.2); this._box(0.4, 0.3, 3.2, '#8C5A3C', gx, 2.7, gz); }
            else { this._box(0.5, 2.6, 0.5, '#9AA0A6', gx - 1.2, 1.3, gz); this._box(0.5, 2.6, 0.5, '#9AA0A6', gx + 1.2, 1.3, gz); this._box(3.2, 0.3, 0.4, '#8C5A3C', gx, 2.7, gz); }
        }
        if (this._ropeBridges) for (const b of this._ropeBridges) this._box(b.w, 0.12, b.h, '#A8784E', b.x + b.w / 2, 0.02, b.y + b.h / 2);
        if (this._rails) { const r = this._rails; for (let y = Math.min(r.y0, r.y1); y <= Math.max(r.y0, r.y1); y++) { this._box(0.08, 0.06, 1, '#6E6A66', r.x + 0.3, 0.05, y + 0.5); this._box(0.08, 0.06, 1, '#6E6A66', r.x + 0.7, 0.05, y + 0.5); } }
        if (this._chimneys) for (const c of this._chimneys) { this._box(0.35, 0.8, 0.35, '#8A6A5A', c.x / P, 2.1, c.y / P); }
    }

    // ---------- 建成建築、工地、裝飾(資料變動時重建) ----------
    _syncDynamic(completedBuildings) {
        const cb = completedBuildings || [], cs = this.constructionSites || [], dc = this.decorations || [];
        const sig = cb.map(b => (b.buildingKey || b.key) + ':' + b.siteX + ',' + b.siteY).join('|') + '#' + cs.map(s => s.siteX + ',' + s.siteY + ':' + Math.round((s.workDone || 0) / (s.workRequired || 1) * 10)).join('|') + '#' + dc.map(d => d.type + d.x + ',' + d.y).join('|');
        if (sig === this._dynSig) return;
        this._dynSig = sig;
        this._clearGroup(this._dyn); this._dynLabels = [];
        const PLACE = { watchtower: ['guardpost', -2, -2], granary: ['farm', 8, -1], marketplace: ['town_square', 9, -1], well_upgrade: ['well', 0, -1], training_ground: ['guardpost', 7, 0], brewery: ['tavern', -3, -1], garden: ['clinic', -3, -1], school: ['library', -3, 0], farm_irrigation: ['farm', -2, 5], forge_bellows: ['workshop', -3, -1], clinic_upgrade: ['clinic', 6, -1], town_walls: ['town_square', -5, -3],
            // v6.40.0 科技樹新建築
            archive: ['library', 6, -1], warehouse: ['general_store', -4, -2], paved_roads: ['town_square', -4, 6], lecture_hall: ['library', -3, 4], dye_works: ['workshop', 6, 3], bathhouse: ['well', 4, 2], windmill: ['farm', -4, -2], armory: ['guardpost', -2, 6], map_room: ['library', 7, 3],
            clock_tower: ['town_square', 6, 7], aqueduct: ['well', -4, 3], press: ['library', 2, 7], bank: ['general_store', 7, -1], hospital: ['clinic', 7, 4], council_hall: ['town_hall', 8, -1], observatory: ['chapel', 6, -2], theater: ['town_square', 11, 5], statue_plaza: ['town_square', 4, 9], sewers: ['well', 5, -3], barracks: ['guardpost', 7, 5], caravanserai: ['general_store', -4, 5] };
        const ICON_COL = { watchtower: '#6B6F78', granary: '#D2B23D', marketplace: '#C9533D', well_upgrade: '#4FB0E6', training_ground: '#8C5A3C', brewery: '#A85A3A', garden: '#5DB867', school: '#4F6F93', farm_irrigation: '#4FB0E6', forge_bellows: '#6B6F78', clinic_upgrade: '#E8E8F0', town_walls: '#9AA0A6',
            archive: '#B88A4A', warehouse: '#8C6A46', paved_roads: '#9AA0A6', lecture_hall: '#4F6F93', dye_works: '#8C4FA0', bathhouse: '#4FB0E6', windmill: '#D2B23D', armory: '#6B6F78', map_room: '#C9A05A', clock_tower: '#C9533D', aqueduct: '#4FB0E6', press: '#3E4A5A', bank: '#D4AF37', hospital: '#E8E8F0', council_hall: '#B04A3A', observatory: '#2F3E6B', theater: '#A03A6B', statue_plaza: '#B8B2A8', sewers: '#5A6B5A', barracks: '#7A3A2A', caravanserai: '#C98A3A' };
        for (const b of cb) {
            const key = b.buildingKey || b.key; let tx, tz, size = 1;
            if (Number.isFinite(b.siteX)) { tx = b.siteX; tz = b.siteY; size = 2; }
            else { const p = PLACE[key]; if (!p) continue; const z = this.buildingZones[p[0]] || this.natureZones[p[0]] || this.buildingZones.town_square; if (!z) continue; tx = z.x + p[1]; tz = z.y + p[2]; } // v6.40.0 主題地圖沒有該錨點時退到廣場
            const cx = tx + size / 2, cz = tz + size / 2, gy = this.groundY(cx, cz);
            const col = ICON_COL[key] || '#C9A98A';
            const g = new THREE.Group(); g.position.set(cx, gy, cz); this._dyn.add(g);
            this._box(size, 0.15, size, '#B9B3A8', 0, 0.07, 0, g);
            if (key === 'watchtower') { this._box(0.8, 2.6, 0.8, '#A8825A', 0, 1.3, 0, g); this._cone(0.8, 0.5, 4, col, 0, 2.85, 0, g).rotation.y = Math.PI / 4; }
            else if (key === 'town_walls') { this._box(size * 1.4, 1.2, 0.4, col, 0, 0.6, 0, g); }
            else if (key === 'clock_tower' || key === 'observatory') { this._box(0.9, 3.0, 0.9, WALL_PALETTE[hash32(key) % WALL_PALETTE.length], 0, 1.5, 0, g); this._cone(0.9, 0.7, key === 'observatory' ? 10 : 4, col, 0, 3.3, 0, g); } // v6.40.0 高塔類
            else if (key === 'windmill') { this._box(0.9, 2.0, 0.9, '#D9CBB0', 0, 1.0, 0, g); this._box(0.15, 2.2, 0.15, '#8B5A2B', 0, 2.0, 0.55, g); this._box(2.2, 0.15, 0.15, '#8B5A2B', 0, 2.0, 0.55, g); }
            else if (key === 'paved_roads' || key === 'statue_plaza' || key === 'aqueduct' || key === 'sewers') { this._box(size * 0.95, 0.12, size * 0.95, col, 0, 0.16, 0, g); if (key === 'statue_plaza') this._box(0.35, 1.0, 0.35, '#B8B2A8', 0, 0.7, 0, g); if (key === 'aqueduct') for (const ox of [-0.6, 0, 0.6]) this._box(0.25, 1.3, 0.25, '#B8B2A8', ox, 0.8, 0, g); }
            else if (key === 'garden' || key === 'farm_irrigation') { this._box(size * 0.9, 0.2, size * 0.9, col, 0, 0.2, 0, g); }
            else { this._box(size * 0.8, 1.1, size * 0.8, WALL_PALETTE[hash32(key) % WALL_PALETTE.length], 0, 0.65, 0, g); this._cone(size * 0.65, 0.7, 4, col, 0, 1.55, 0, g).rotation.y = Math.PI / 4; }
            this._dynLabels.push({ key: 'cb:' + key + tx + ',' + tz, x: cx, y: gy + (key === 'watchtower' ? 3.3 : 2.2), z: cz, cls: 't3d-label t3d-mini', html: `<span class="t3d-name">${this._esc(t3(b.name || key))}</span>` });
        }
        for (const s of cs) {
            const cx = s.siteX + 1, cz = s.siteY + 1, gy = this.groundY(cx, cz);
            const g = new THREE.Group(); g.position.set(cx, gy, cz); this._dyn.add(g);
            this._box(2, 0.12, 2, '#9B7B52', 0, 0.06, 0, g);
            for (const [ox, oz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) this._box(0.1, 1.6, 0.1, '#8B5A2B', ox, 0.8, oz, g);
            this._box(1.8, 0.08, 0.08, '#8B5A2B', 0, 1.5, -0.85, g); this._box(1.8, 0.08, 0.08, '#8B5A2B', 0, 1.5, 0.85, g);
            this._box(0.9, 0.3, 0.5, '#A0522D', 0.2, 0.27, 0.3, g);
            const prog = Math.min(1, (s.workDone || 0) / (s.workRequired || 1));
            this._dynLabels.push({ key: 'cs:' + s.siteX + ',' + s.siteY, x: cx, y: gy + 2.2, z: cz, cls: 't3d-label t3d-site', html: `<span class="t3d-name">🚧 ${this._esc(t3(s.name || ''))}</span><i class="t3d-bar"><b style="width:${Math.round(prog * 100)}%"></b></i>` });
        }
        for (const d of dc) {
            const x = d.x / TILE + 0.5, z = d.y / TILE + 0.5, gy = this.groundY(x, z);
            if (d.type === 'lamp') { this._box(0.1, 1.4, 0.1, '#3A3A3A', x, gy + 0.7, z, this._dyn); const l = this._box(0.26, 0.3, 0.26, '#FFE9A8', x, gy + 1.5, z, this._dyn, { emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0.3 }); this._glowMats.push(l.material); }
            else if (d.type === 'bench') { this._box(0.9, 0.08, 0.35, '#A8784E', x, gy + 0.4, z, this._dyn); this._box(0.9, 0.3, 0.06, '#A8784E', x, gy + 0.58, z - 0.15, this._dyn); for (const ox of [-0.35, 0.35]) this._box(0.08, 0.4, 0.3, '#6B4A2E', x + ox, gy + 0.2, z, this._dyn); }
            else if (d.type === 'flowerbed') { this._box(1.0, 0.18, 1.0, '#8C5A3C', x, gy + 0.09, z, this._dyn); for (let i = 0; i < 4; i++) this._box(0.18, 0.18, 0.18, ['#E85C8A', '#F2B13C', '#FFFFFF', '#8C4FA0'][i], x - 0.3 + (i % 2) * 0.6, gy + 0.3, z - 0.3 + Math.floor(i / 2) * 0.6, this._dyn); }
            else if (d.type === 'statue') { this._box(0.8, 0.4, 0.8, '#9AA0A6', x, gy + 0.2, z, this._dyn); this._box(0.36, 0.9, 0.3, '#B8B2A8', x, gy + 0.85, z, this._dyn); this._box(0.3, 0.3, 0.3, '#B8B2A8', x, gy + 1.45, z, this._dyn); }
            else if (d.type === 'fountain') { this._cyl(0.8, 0.8, 0.3, 10, '#B8B2A8', x, gy + 0.15, z, this._dyn); this._cyl(0.65, 0.65, 0.1, 10, '#4FB0E6', x, gy + 0.32, z, this._dyn); this._cyl(0.15, 0.15, 0.7, 8, '#B8B2A8', x, gy + 0.6, z, this._dyn); }
            else this._box(0.5, 0.5, 0.5, '#C9A98A', x, gy + 0.25, z, this._dyn);
        }
    }

    // ---------- 場景重建(地圖生成或讀檔後) ----------
    _buildScene() {
        this._sceneBuiltAt = performance.now(); // v6.43.3 剛建好的幾秒不判斷畫質
        if (!this.renderer || !this.grid) return;
        this._sceneSrc = this.grid; this._sceneSeason = this.season || '';
        this._static.traverse((o) => { if (o.isMesh && o.geometry && !Object.values(this._geos).includes(o.geometry)) o.geometry.dispose(); });
        this._static.clear(); this._waterMeshes = []; this._winMats = []; this._glowMats = []; this._boatMeshes = null; this._flame = null; this._chimneyTops = null; this._coach = null; this._coachHome = null; this._caravanAnim = null; // v6.34.1 換圖時馬車狀態歸零
        this._buildTerrain();
        this._buildVegetation();
        this._buildGroundDetail();
        this._buildBuildings();
        this._buildProps();
        this._buildLamps();
        this._mergeStatic();
        // v6.33.0 靜態物件算好世界矩陣就停用自動更新(three 每幀會走訪整棵樹重算矩陣;水面／船／篝火／馬車這些會動的再開回來)
        this._static.updateMatrixWorld(true); this._static.traverse((o) => { o.matrixAutoUpdate = false; });
        for (const w of this._waterMeshes) w.matrixAutoUpdate = true; if (this._boatMeshes) for (const b of this._boatMeshes) b.g.matrixAutoUpdate = true; if (this._flame) this._flame.matrixAutoUpdate = true; if (this._coach) this._coach.matrixAutoUpdate = true;
        this._dynSig = null; this._lmSig = null; // v6.47.0 換地圖要重排地標
        this._buildLabelIndex();
        console.log('[Town3D] scene built:', this._static.children.length, 'nodes');
    }
    // v6.32.0 路燈:廣場四角與每棟有門的建築門口,夜裡燈頭發光、地上一圈暖光暈
    _buildLamps() {
        const spots = [], seen = new Set();
        const add = (x, z) => { const k = Math.round(x) + ',' + Math.round(z); if (seen.has(k)) return; seen.add(k); spots.push({ x, z }); };
        const sq = this.buildingZones['town_square'] || this.natureZones['town_square'];
        if (sq) { add(sq.x + 0.5, sq.y + 0.5); add(sq.x + sq.w - 0.5, sq.y + 0.5); add(sq.x + 0.5, sq.y + sq.h - 0.5); add(sq.x + sq.w - 0.5, sq.y + sq.h - 0.5); }
        for (const z of Object.values(this.buildingZones)) { if (z.doorPixelX === undefined || z.parentLocId) continue; add(z.doorPixelX / TILE + 1.6, z.doorPixelY / TILE + 0.7); }
        if (!spots.length) return;
        if (!this._lampHead) this._lampHead = new THREE.MeshLambertMaterial({ color: new THREE.Color('#FFE9A8'), emissive: new THREE.Color('#FFB347'), emissiveIntensity: 0 });
        if (!this._poolMat) this._poolMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFC27A'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        // 燈頭共用一個材質、走 _mergeStatic 併成一次繪製;光暈是半透明不會被合併,這裡手動把所有圓盤併成一個網格
        const headGeo = this._geo('lamphead', () => new THREE.BoxGeometry(0.28, 0.26, 0.28));
        const circle = new THREE.CircleGeometry(1.4, 16).rotateX(-Math.PI / 2); const cp = circle.getAttribute('position'); const pos = [];
        let n = 0;
        for (const s of spots) {
            const tile = this.grid[Math.floor(s.z)]?.[Math.floor(s.x)]; if (tile === undefined || tile === T.WATER) continue;
            const gy = this.groundY(s.x, s.z);
            this._box(0.1, 1.7, 0.1, '#3F3A44', s.x, gy + 0.85, s.z, this._static);
            const hd = new THREE.Mesh(headGeo, this._lampHead); hd.position.set(s.x, gy + 1.78, s.z); this._static.add(hd);
            if ((this.tierLv || 0) >= 2) { const col = (this.tierLv >= 3 ? ['#7A2E8C', '#C9A13A'] : ['#2E6E9E', '#C9533D'])[n % 2]; this._box(0.04, 0.5, 0.3, col, s.x + 0.09, gy + 1.35, s.z, this._static); } // v6.57.0 城市以上路燈掛旗幟(王都紫金)
            const idx = circle.getIndex(); for (let i = 0; i < idx.count; i++) { const k = idx.getX(i); pos.push(cp.getX(k) + s.x, cp.getY(k) + gy + 0.03, cp.getZ(k) + s.z); }
            n++;
        }
        // v6.54.0 門口燈籠的小光暈(半徑小一點)
        for (const dg of (this._doorGlow || [])) {
            const tile = this.grid[Math.floor(dg.z)]?.[Math.floor(dg.x)]; if (tile === undefined || tile === T.WATER) continue;
            const gy = this.groundY(dg.x, dg.z); const idx = circle.getIndex();
            for (let i = 0; i < idx.count; i++) { const k = idx.getX(i); pos.push(cp.getX(k) * 0.62 + dg.x, cp.getY(k) + gy + 0.035, cp.getZ(k) * 0.62 + dg.z); }
        }
        // v6.54.0 廣場串燈:四角燈柱之間拉一串小燈泡(暖黃、橘、淡粉輪流;每種顏色一個材質,合併後只多三次繪製)
        if (sq) {
            const corners = [[sq.x + 0.5, sq.y + 0.5], [sq.x + sq.w - 0.5, sq.y + 0.5], [sq.x + sq.w - 0.5, sq.y + sq.h - 0.5], [sq.x + 0.5, sq.y + sq.h - 0.5]];
            if (!this._bulbMats) this._bulbMats = ['#FFE08A', '#FFB061', '#FFC4D6'].map(c => new THREE.MeshLambertMaterial({ color: new THREE.Color(c), emissive: new THREE.Color(c), emissiveIntensity: 0 }));
            const bg = this._geo('box', () => new THREE.BoxGeometry(1, 1, 1)); let bi = 0;
            for (let c = 0; c < 4; c++) {
                const [x0, z0] = corners[c], [x1, z1] = corners[(c + 1) % 4]; const len = Math.hypot(x1 - x0, z1 - z0); const nb = Math.max(4, Math.round(len / 0.9));
                for (let i = 1; i < nb; i++) {
                    const f = i / nb, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f; const sag = Math.sin(f * Math.PI) * 0.45;
                    const b = new THREE.Mesh(bg, this._bulbMats[bi++ % 3]); b.scale.set(0.12, 0.14, 0.12); b.position.set(x, this.groundY(x, z) + 1.72 - sag, z); this._static.add(b);
                }
            }
        }
        if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const p = new THREE.Mesh(g, this._poolMat); p.renderOrder = 2; p.frustumCulled = false; this._static.add(p); }
        this._lampCount = n;
    }
    // v6.28.0 靜態方塊依材質合併:幾百個小 Mesh → 每種顏色一個,繪製呼叫 250 → 數十(手機 GPU 提交成本的大頭)
    _mergeStatic() { this._mergeInto(this._static, true); }
    // v6.54.0 玩久了會一直長的圖層(新蓋的建築、裝飾、地標、農地、工坊、墓園、探險／節慶標記)重建後也合併:以前每多一棟就多十幾次繪製,越玩越卡
    _clearGroup(g) { if (!g) return; g.traverse(o => { if (o.isMesh && o.name === 'merged') o.geometry.dispose(); }); g.clear(); g.userData.needMerge = true; }
    _mergeDynamicGroups() { for (const g of [this._dyn, this._lmGroup, this._farmGroup, this._factGroup, this._graveGroup, this._expGroup, this._festGroup]) if (g && g.userData.needMerge) { g.userData.needMerge = false; if (g.children.length) this._mergeInto(g, false); } }
    _mergeInto(root, verbose) {
        const sharedGeos = new Set(Object.values(this._geos));
        const skipMat = new Set([...this._glowMats, this._waterMat].filter(Boolean));
        const groups = new Map(); // material(或 VC)→ { meshes:[] }
        const VC = '__vc__'; // v6.43.0 一般純色材質全部併成一個頂點色網格(一次繪製)
        root.updateMatrixWorld(true);
        const collect = (o, inNoMerge) => {
            const nm = inNoMerge || !!o.userData?.noMerge;
            if (o.isMesh && !o.isInstancedMesh && !nm && sharedGeos.has(o.geometry) && !skipMat.has(o.material) && o !== this._flame && o.material.transparent !== true) {
                const key = o.material.userData?.plain ? VC : o.material;
                let g = groups.get(key); if (!g) { g = { meshes: [] }; groups.set(key, g); }
                g.meshes.push(o);
            }
            for (const c of o.children) collect(c, nm);
        };
        collect(root, false);
        const nmat = new THREE.Matrix3(); const v = new THREE.Vector3();
        let merged = 0, removed = 0;
        for (const [mat, g] of groups) {
            const vc = mat === VC;
            if (!vc && g.meshes.length < 3) continue;
            let total = 0; for (const m of g.meshes) total += m.geometry.attributes.position.count;
            // v6.43.0 法向量存 Int8、顏色存 Uint8(正規化),同樣的畫面記憶體約省一半
            const pos = new Float32Array(total * 3), nor = new Int8Array(total * 3), col = vc ? new Uint8Array(total * 3) : null; let off = 0;
            const bids = mat === this._winMat ? new Float32Array(total) : null; // v6.54.0 窗燈分棟
            for (const m of g.meshes) {
                const pa = m.geometry.attributes.position, na = m.geometry.attributes.normal; nmat.getNormalMatrix(m.matrixWorld);
                if (bids) bids.fill(m.userData.bid || 0, off / 3, off / 3 + pa.count);
                const c = m.material.color;
                for (let i = 0; i < pa.count; i++) {
                    v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld); pos[off] = v.x; pos[off + 1] = v.y; pos[off + 2] = v.z;
                    v.fromBufferAttribute(na, i).applyMatrix3(nmat).normalize(); nor[off] = Math.round(v.x * 127); nor[off + 1] = Math.round(v.y * 127); nor[off + 2] = Math.round(v.z * 127);
                    if (col) { col[off] = Math.round(c.r * 255); col[off + 1] = Math.round(c.g * 255); col[off + 2] = Math.round(c.b * 255); }
                    off += 3;
                }
                m.parent?.remove(m); removed++;
            }
            const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
            if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
            if (bids) geo.setAttribute('aBid', new THREE.BufferAttribute(bids, 1));
            const mesh = new THREE.Mesh(geo, vc ? this._vcMat() : mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'merged'; mesh.frustumCulled = false;
            root.add(mesh); merged++;
        }
        // 清掉只剩空殼的 Group
        const prune = (o) => { for (const c of [...o.children]) { prune(c); if (c.isGroup && !c.children.length && !c.userData?.noMerge) o.remove(c); } };
        prune(root);
        if (verbose) console.log('[Town3D] merged', removed, 'meshes into', merged);
    }
    _buildLabelIndex() {
        this._labelIndex = {}; let n = 1;
        for (const locId of Object.keys(this.labelPositions)) this._labelIndex[locId] = n++;
    }
    _esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    // ---------- 光照、天空、水面 ----------
    _nightAmount() {
        const h = (this.timeHour ?? 12) + (this.timeMinute ?? 0) / 60;
        if (h >= 7 && h < 17) return 0;
        if (h >= 17 && h < 20) return (h - 17) / 3;
        if (h >= 20 || h < 4.5) return 1;
        return 1 - (h - 4.5) / 2.5;
    }
    _updateLighting() {
        const night = this._nightAmount();
        const h = (this.timeHour ?? 12) + (this.timeMinute ?? 0) / 60;
        const sunAng = clamp((h - 6) / 12, -0.1, 1.1) * Math.PI;
        const cx = this.cols / 2, cz = this.rows / 2;
        const dusk = night > 0 && night < 1 ? 1 - Math.abs(night - 0.5) * 2 : 0;
        if (!this._lc) this._lc = { skyDay: new THREE.Color('#BDE3F7'), skyNight: new THREE.Color('#22345E'), skyDusk: new THREE.Color('#F2B48A'), rain: new THREE.Color('#8E99A6'), snow: new THREE.Color('#DDE6EE'), fog: new THREE.Color('#C9CFD6'), sunDay: new THREE.Color('#FFF4DC'), sunDusk: new THREE.Color('#FFB26B'), sunNight: new THREE.Color('#AFC0F0'), hemiDay: new THREE.Color('#CFE9FF'), hemiNight: new THREE.Color('#7383C0'), gDay: new THREE.Color('#8C7A5A'), gNight: new THREE.Color('#3B3E5C'), tmp: new THREE.Color(), tmp2: new THREE.Color() }; // v6.28.0 不每幀 new Color
        const L = this._lc;
        const sky = L.tmp.copy(L.skyDay).lerp(L.skyNight, night).lerp(L.skyDusk, dusk * 0.55);
        const wt = this.weatherType || 'clear';
        const stormy = (wt === 'storm' || wt === 'blizzard') ? 1 : 0; // v6.32.0 暴風雨／暴風雪:天空更暗、光更弱、路燈提早亮
        if (wt === 'rain' || wt === 'storm') sky.lerp(L.rain, 0.55);
        if (stormy) sky.lerp(L.skyNight, 0.35);
        else if (wt === 'snow') sky.lerp(L.snow, 0.5);
        else if (wt === 'fog') sky.lerp(L.fog, 0.6);
        // v6.32.0 暴風雨閃電:偶爾整片天空亮一下、光源跟著閃
        if (wt === 'storm' && !(this._flash > 0.05) && Math.random() < 0.008) this._flash = 1;
        if (this._flash > 0.01) { if (!L.white) L.white = new THREE.Color('#FFFFFF'); sky.lerp(L.white, this._flash * 0.55); this._flash *= 0.78; } else this._flash = 0;
        this.scene.background.copy(sky); this.scene.fog.color.copy(sky);
        // v6.36.0 天氣不再靠整片霧白表現:霧天／雨天的距離霧跟晴天一樣淡,霧由低而密的灰雲、雨雪由粒子呈現
        this.scene.fog.density = 0.005 + night * 0.002;
        if (night < 1) {
            this.sun.position.set(cx + Math.cos(sunAng) * 90, Math.max(8, Math.sin(sunAng) * 90), cz + 40);
        } else {
            this.sun.position.set(cx - 40, 70, cz + 30);
        }
        this.sun.color.copy(L.sunDay).lerp(L.sunDusk, dusk * 0.8).lerp(L.sunNight, night);
        this.sun.intensity = lerp(1.7, 0.9, night) * (wt === 'rain' || wt === 'storm' ? 0.55 : 1) * (stormy ? 0.65 : 1) + (this._flash || 0) * 0.8;
        this.hemi.color.copy(L.hemiDay).lerp(L.hemiNight, night);
        this.hemi.groundColor.copy(L.gDay).lerp(L.gNight, night);
        this.hemi.intensity = lerp(0.95, 0.88, night) + (this._flash || 0) * 1.6;
        // v6.32.0 太陽／月亮圓盤(月亮 18 點升、6 點落;壞天氣幾乎看不到)
        if (this._sunDisc) {
            const R = 230, bad = (wt === 'rain' || wt === 'storm' || wt === 'snow' || wt === 'blizzard' || wt === 'fog') ? 0.12 : 1;
            this._sunDisc.position.set(cx + Math.cos(sunAng) * R, Math.sin(sunAng) * R, cz + 90); this._sunDisc.lookAt(this.camera.position);
            this._sunDisc.material.opacity = clamp(1 - night * 1.4, 0, 1) * bad; this._sunDisc.material.color.copy(L.sunDay).lerp(L.sunDusk, dusk);
            const mh = (h + 12) % 24, moonAng = clamp((mh - 6) / 12, -0.1, 1.1) * Math.PI;
            this._moonDisc.position.set(cx + Math.cos(moonAng) * R, Math.sin(moonAng) * R, cz + 90); this._moonDisc.lookAt(this.camera.position);
            this._moonDisc.material.opacity = clamp((night - 0.4) / 0.4, 0, 1) * 0.95 * bad;
        }
        const glow = Math.max(clamp((night - 0.25) / 0.5, 0, 1), stormy * 0.55);
        if (this._selfLit) this._selfLit.value = 0.42 * Math.max(night, stormy * 0.6); // v6.44.0 村民夜間補光(白天 0)
        for (const m of this._winMats) m.emissiveIntensity = glow * 1.9;
        for (const m of this._glowMats) m.emissiveIntensity = 0.3 + glow * 1.4;
        if (this._poolMat) this._poolMat.opacity = glow * ((wt === 'rain' || wt === 'storm' || wt === 'fog') ? 0.4 : 0.32); // v6.32.0 路燈地上的光暈(v6.54.0 加亮;雨霧天光暈更明顯)
        if (this._lampHead) this._lampHead.emissiveIntensity = 0.2 + glow * 1.5;
        // v6.54.0 夜景:燈籠、串燈(微微閃)、河面月光
        if (this._lanternMat) this._lanternMat.emissiveIntensity = glow * (1.5 + Math.sin(this.animFrame * 0.21) * 0.08);
        if (this._bulbMats) this._bulbMats.forEach((m, i) => { m.emissiveIntensity = glow * (1.3 + Math.sin(this.animFrame * 0.06 + i * 2.1) * 0.25); });
        if (this._waterMat) { if (!this._waterMat.emissive) this._waterMat.emissive = new THREE.Color(); this._waterMat.emissive.setRGB(0.22, 0.3, 0.5).multiplyScalar(Math.max(0, night - 0.3) * (0.55 + Math.sin(this.animFrame * 0.045) * 0.12)); }
        if (this._flame) { this._flame.material.emissiveIntensity = 0.6 + glow * 1.2 + Math.sin(this.animFrame * 0.35) * 0.15; this._flame.scale.y = 0.7 + Math.sin(this.animFrame * 0.5) * 0.08; }
    }
    _updateWater() {
        const f = this.animFrame;
        for (const w of this._waterMeshes) w.position.y = Math.sin(f * 0.03) * 0.03;
        if (this._waterMat) this._waterMat.opacity = 0.78 + Math.sin(f * 0.05) * 0.05;
        if (this._boatMeshes) for (const b of this._boatMeshes) { b.g.position.y = -0.12 + Math.sin(f * 0.04 + b.phase) * 0.06; b.g.rotation.z = Math.sin(f * 0.035 + b.phase) * 0.04; }
        if (this._coach) this._coach.position.y = Math.sin(f * 0.1) * 0.02;
    }

    // ---------- 村民(方塊小人;v6.24 再細修) ----------
    // v6.43.0 村民:每個部位(身體／四肢／工具)各自併成一個頂點色網格 —— 一人約 6 次繪製(以前約 18 次),
    // 省下來的預算拿來加耳朵、鼻子、眉毛、嘴、衣領、腰帶扣、鞋底、袖口等細節
    _partMesh(boxes) {
        const unit = this._geo('box', () => new THREE.BoxGeometry(1, 1, 1));
        const up = unit.attributes.position, un = unit.attributes.normal, n = up.count;
        const pos = new Float32Array(boxes.length * n * 3), nor = new Int8Array(boxes.length * n * 3), col = new Uint8Array(boxes.length * n * 3);
        const c = new THREE.Color(); let o = 0;
        for (const b of boxes) {
            c.set(b[3]);
            for (let k = 0; k < n; k++) {
                pos[o] = up.getX(k) * b[0] + b[4]; pos[o + 1] = up.getY(k) * b[1] + b[5]; pos[o + 2] = up.getZ(k) * b[2] + b[6];
                nor[o] = Math.round(un.getX(k) * 127); nor[o + 1] = Math.round(un.getY(k) * 127); nor[o + 2] = Math.round(un.getZ(k) * 127);
                col[o] = Math.round(c.r * 255); col[o + 1] = Math.round(c.g * 255); col[o + 2] = Math.round(c.b * 255); o += 3;
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true)); g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
        const m = new THREE.Mesh(g, this._agentMat()); m.castShadow = true; m.receiveShadow = true; m.userData.ownGeo = true;
        return m;
    }
    // v6.55.0 人多時遠處的村民改用「整個人合成一塊」的簡化網格:一人 1 次繪製(原本約 5 次)、不投影
    _agentLod(m) {
        if (m.userData.lod) return m.userData.lod;
        const saved = []; for (const c of m.children) if (c.isGroup && /^(leg|arm)/.test(c.name)) { saved.push([c, c.rotation.x]); c.rotation.x = 0; }
        const p0 = m.position.clone(), r0 = m.rotation.clone(); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.updateMatrixWorld(true);
        const parts = []; m.traverse(o => { if (o.isMesh && o.geometry?.attributes?.color && o.parent?.name !== 'tool' && o.visible !== false) parts.push(o); });
        let n = 0; for (const o of parts) n += o.geometry.attributes.position.count;
        const pos = new Float32Array(n * 3), nor = new Int8Array(n * 3), col = new Uint8Array(n * 3); const v = new THREE.Vector3(), nm = new THREE.Matrix3(); let off = 0;
        for (const o of parts) {
            const g = o.geometry, pa = g.attributes.position, na = g.attributes.normal, ca = g.attributes.color; nm.getNormalMatrix(o.matrixWorld);
            for (let i = 0; i < pa.count; i++) {
                v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); pos[off] = v.x; pos[off + 1] = v.y; pos[off + 2] = v.z;
                v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nor[off] = Math.round(v.x * 127); nor[off + 1] = Math.round(v.y * 127); nor[off + 2] = Math.round(v.z * 127);
                col[off] = Math.round(ca.getX(i) * 255); col[off + 1] = Math.round(ca.getY(i) * 255); col[off + 2] = Math.round(ca.getZ(i) * 255); off += 3;
            }
        }
        for (const [c, rx] of saved) c.rotation.x = rx; m.position.copy(p0); m.rotation.copy(r0);
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
        const lod = new THREE.Mesh(geo, this._agentMat()); lod.userData.ownGeo = true; lod.userData.isLod = true; lod.castShadow = false; lod.visible = false;
        // 群組有縮放 1.3:合併時已經算進世界座標,這裡要抵銷
        const s = m.scale.x || 1; lod.scale.setScalar(1 / s); m.add(lod); m.userData.lod = lod; return lod;
    }
    _setAgentFar(m, far) {
        if (m.userData.far === far) return; m.userData.far = far;
        const lod = far ? this._agentLod(m) : m.userData.lod;
        for (const c of m.children) { if (c === lod) continue; c.visible = !far; }
        if (lod) lod.visible = far;
    }
    _disposeAgent(m) { if (!m) return; m.traverse(o => { if (o.isMesh && o.userData.ownGeo) o.geometry.dispose(); }); }
    _agentMesh(aid, agent, pos) {
        const jobKey = pos.job || agent.job?.key || 'default';
        const base = JOB_COLORS[jobKey] || JOB_COLORS.default;
        const c = { ...this._variedColors(base, agent.name || aid, jobKey, agent.look || null) };
        const ap = agent.appear || null; // v6.92.0 年齡段、社會階層、國王、無家可歸
        const sig = jobKey + '|' + lookSig(agent.look) + '|' + (pos.gender || '') + '|' + (typeof LOOK !== 'undefined' ? LOOK.sig(ap) : '');
        let m = this._agentMeshes[aid];
        if (m && m.userData.sig === sig) return m;
        if (m) { this._agentGroup.remove(m); this._disposeAgent(m); }
        m = new THREE.Group(); m.userData = { sig, aid };
        const female = (pos.gender || agent.gender) === 'female';
        const shade = (hex, k) => { const x = new THREE.Color(hex); x.multiplyScalar(k); return '#' + x.getHexString(); };
        // v6.92.0 依年齡與貧富換外觀
        const mix = (hex, to, k) => { const x = new THREE.Color(hex); x.lerp(new THREE.Color(to), k); return '#' + x.getHexString(); };
        const ab = ap?.b || 'a', cls = ap?.cls ?? 1, child = ab === 'c', poor = cls === 0 || !!ap?.hl, king = !!ap?.king;
        if (ab === 'e') c.hair = mix(c.hair, '#BDBDBD', 0.75); else if (ab === 'o') c.hair = '#ECECEC';
        if (poor) { c.body = shade(mix(c.body, '#7A7366', 0.55), 0.82); c.bodyDk = shade(c.body, 0.8); c.pants = shade(mix(c.pants, '#6B6358', 0.5), 0.85); c.boots = '#4A3B2E'; }
        else if (cls >= 3) { c.body = shade(c.body, 1.08); c.bodyDk = shade(c.bodyDk, 1.05); c.boots = cls >= 4 ? '#2B1D14' : c.boots; }
        const skinDk = shade(c.skin, 0.82), hairDk = shade(c.hair, 0.8), bodyLt = shade(c.body, 1.18);
        const body = [];   // [w,h,d,hex,x,y,z]
        const B = (w, h, d, hex, x, y, z) => body.push([w, h, d, hex, x, y, z]);
        // 軀幹、衣領、腰帶與扣環
        B(0.46, 0.5, 0.28, c.body, 0, 0.61, 0);
        B(0.48, 0.08, 0.3, c.bodyDk, 0, 0.4, 0);
        B(0.1, 0.07, 0.02, poor ? '#6B5A45' : '#D9B85C', 0, 0.4, 0.155);
        B(0.3, 0.06, 0.06, cls >= 3 && !poor ? '#F2F2F2' : bodyLt, 0, 0.85, 0.13);
        if (poor) { B(0.13, 0.12, 0.02, mix(c.body, '#A08C6E', 0.6), 0.11, 0.66, 0.145); B(0.15, 0.11, 0.02, mix(c.body, '#5C5247', 0.6), -0.1, 0.52, -0.145); } // 補丁
        if (cls >= 3 && !poor) { B(0.04, 0.04, 0.02, '#D9B85C', 0, 0.71, 0.145); B(0.04, 0.04, 0.02, '#D9B85C', 0, 0.59, 0.145); } // 金扣
        if (cls >= 4 && !poor) { const cape = cls >= 5 ? '#9E1B1B' : '#5E2A84'; B(0.52, 0.66, 0.05, cape, 0, 0.55, -0.17); B(0.5, 0.05, 0.36, cape, 0, 0.87, -0.02); // 披風
            if (cls >= 5) { B(0.54, 0.07, 0.08, '#F5F5F5', 0, 0.87, -0.16); B(0.54, 0.06, 0.07, '#F5F5F5', 0, 0.23, -0.17); } // 白毛邊
            B(0.24, 0.03, 0.02, '#E6C350', 0, 0.82, 0.15); B(0.06, 0.07, 0.02, cls >= 5 ? '#C62828' : '#2E7D32', 0, 0.76, 0.152); } // 金項鍊與墜子
        if (female) B(0.5, 0.16, 0.32, c.body, 0, 0.32, 0); // 裙擺
        // 頭:臉、耳朵、眼睛、眉毛、鼻子、嘴
        B(0.42, 0.4, 0.4, c.skin, 0, 1.08, 0);
        B(0.06, 0.12, 0.1, skinDk, -0.23, 1.07, 0); B(0.06, 0.12, 0.1, skinDk, 0.23, 1.07, 0);
        B(0.07, 0.07, 0.03, '#2B2118', -0.1, 1.1, 0.21); B(0.07, 0.07, 0.03, '#2B2118', 0.1, 1.1, 0.21);
        B(0.1, 0.025, 0.02, hairDk, -0.1, 1.17, 0.21); B(0.1, 0.025, 0.02, hairDk, 0.1, 1.17, 0.21);
        B(0.06, 0.07, 0.05, skinDk, 0, 1.03, 0.215);
        B(0.1, 0.02, 0.02, '#8C4A3C', 0, 0.96, 0.21);
        // 頭髮
        const hairStyle = agent.look?.hair ?? (female ? 1 : 0);
        B(0.46, 0.14, 0.44, c.hair, 0, 1.3, 0);
        B(0.46, 0.2, 0.1, c.hair, 0, 1.2, -0.17);
        if (hairStyle === 1 || hairStyle === 2) B(0.4, 0.45, 0.12, c.hair, 0, 0.98, -0.22);
        if (hairStyle === 2) B(0.12, 0.2, 0.1, hairDk, 0, 0.8, -0.24);
        if (hairStyle === 3) B(0.46, 0.12, 0.08, c.hair, 0, 1.2, 0.18);
        if (hairStyle === 5) B(0.52, 0.2, 0.5, c.hair, 0, 1.33, 0);
        // 職業帽／配件
        const acc = child ? 0 : (agent.look?.acc ?? 0);
        let minerLamp = false;
        if (king) { B(0.46, 0.1, 0.46, '#E6C350', 0, 1.42, 0); for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17], [0, 0.2]]) B(0.07, 0.12, 0.07, '#E6C350', x, 1.52, z); B(0.07, 0.07, 0.02, '#C62828', 0, 1.43, 0.235); } // 王冠
        else if (child) { /* 小孩不戴職業帽 */ }
        else if (acc === 1 || jobKey === 'farmer') { B(0.62, 0.05, 0.62, '#D9B36B', 0, 1.36, 0); B(0.4, 0.16, 0.4, '#D9B36B', 0, 1.45, 0); B(0.42, 0.04, 0.42, '#8C5A3C', 0, 1.39, 0); }
        else if (jobKey === 'guard') { B(0.46, 0.16, 0.46, '#90A4AE', 0, 1.4, 0); B(0.06, 0.12, 0.06, '#C9533D', 0, 1.53, 0); }
        else if (jobKey === 'miner') { B(0.46, 0.16, 0.46, '#D2B23D', 0, 1.4, 0); minerLamp = true; }
        else if (jobKey === 'cook') { B(0.4, 0.26, 0.4, '#FFFFFF', 0, 1.46, 0); B(0.36, 0.3, 0.02, '#F4F4F4', 0, 0.58, 0.15); }
        else if (jobKey === 'mayor') { B(0.4, 0.08, 0.4, '#FFD700', 0, 1.36, 0); B(0.08, 0.08, 0.02, '#E8732A', 0.12, 0.78, 0.15); }
        else if (jobKey === 'doctor') { B(0.5, 0.06, 0.5, '#FFFFFF', 0, 1.36, 0); B(0.06, 0.18, 0.02, '#C9533D', 0.12, 0.68, 0.15); B(0.18, 0.06, 0.02, '#C9533D', 0.12, 0.68, 0.15); }
        else if (jobKey === 'priest') B(0.3, 0.3, 0.3, '#F0E070', 0, 1.46, 0);
        if (acc === 2) { B(0.14, 0.1, 0.03, '#2B2118', -0.1, 1.1, 0.22); B(0.14, 0.1, 0.03, '#2B2118', 0.1, 1.1, 0.22); B(0.08, 0.02, 0.02, '#2B2118', 0, 1.11, 0.22); }
        if (acc === 3) B(0.5, 0.12, 0.34, c.accent, 0, 0.86, 0.02);
        if (jobKey === 'blacksmith') B(0.3, 0.42, 0.04, '#5A4A3A', 0, 0.6, 0.15);
        if (jobKey === 'trader') { B(0.2, 0.22, 0.16, '#8C5A3C', 0.34, 0.5, 0); B(0.04, 0.4, 0.02, '#5A3E2B', 0.12, 0.7, 0.15); }
        m.add(this._partMesh(body));
        // 四肢(各自一個網格,掛在樞紐上擺動):腿＋靴＋鞋底、手臂＋袖口＋手
        const limb = (name, x, pivotY, boxes) => { const g = new THREE.Group(); g.position.set(x, pivotY, 0); g.name = name; g.add(this._partMesh(boxes)); m.add(g); return g; };
        const leg = (x) => limb(x < 0 ? 'legL' : 'legR', x, 0.36, [[0.17, 0.36, 0.18, c.pants, 0, -0.18, 0], [0.2, 0.1, 0.22, c.boots, 0, -0.31, 0.01], [0.21, 0.03, 0.24, shade(c.boots, 0.6), 0, -0.36, 0.01], ...(poor && x > 0 ? [[0.1, 0.08, 0.02, mix(c.pants, '#A08C6E', 0.6), 0, -0.14, 0.095]] : [])]);
        leg(-0.11); leg(0.11);
        const arm = (x) => limb(x < 0 ? 'armL' : 'armR', x, 0.83, [[0.13, 0.42, 0.14, c.body, 0, -0.21, 0], [0.145, 0.06, 0.155, c.bodyDk, 0, -0.38, 0], [0.11, 0.1, 0.12, c.skin, 0, -0.45, 0]]);
        arm(-0.3); const armR = arm(0.3);
        const tool = new THREE.Group(); tool.name = 'tool'; tool.visible = false; tool.position.set(0, -0.45, 0.12); armR.add(tool);
        tool.add(this._partMesh([[0.06, 0.95, 0.06, '#8B6914', 0, 0.2, 0], [0.22, 0.06, 0.08, '#8A8A8A', 0, 0.66, 0.04]]));
        m.userData.tool = tool;
        if (minerLamp) { const l = new THREE.Mesh(this._geo('box', () => new THREE.BoxGeometry(1, 1, 1)), this._mat('#FFE9A8', { emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0.6 })); l.scale.set(0.12, 0.1, 0.06); l.position.set(0, 1.4, 0.24); m.add(l); }
        m.scale.setScalar(1.3 * (child ? 0.68 : ab === 't' ? 0.88 : 1)); m.userData.ab = ab; // v6.92.0 小孩、青少年個子小
        this._agentGroup.add(m); this._agentMeshes[aid] = m;
        return m;
    }
    _updateAgents3D(agents, selectedAgent) {
        const seen = new Set(); const occ = {}; // v6.54.0 每棟裡面醒著／睡著幾個人(決定窗燈)
        const crowd = Object.keys(this.agentPositions).length > 40; // v6.55.0 人多才啟用遠處簡化
        const lodR = Math.max(6, Math.min(16, (this.dist || 30) * 0.35)), lodR2 = lodR * lodR, tx0 = this.target.x, tz0 = this.target.z;
        // v6.32.0 對話中的兩人面對面
        const face = {}; const nowT = Date.now();
        for (const c of (this._activeConvoBubbles || [])) { if (nowT >= c.expiry) continue; const ids = [...new Set((c.bubbles || []).map(b => b.agentId))]; if (ids.length >= 2) { face[ids[0]] = ids[1]; face[ids[1]] = ids[0]; } }
        for (const [aid, pos] of Object.entries(this.agentPositions)) {
            const agent = agents[aid]; if (!agent) continue;
            if (aid === 'player' && this.hidePlayer) continue;
            seen.add(aid);
            const m = this._agentMesh(aid, agent, pos);
            const wx = pos.x / TILE, wz = pos.y / TILE;
            const inside = this._isInsideBuilding(pos.x, pos.y);
            const hidden = !!(inside && this.buildingZones[inside] && this.buildingZones[inside].doorPixelX !== undefined);
            m.visible = !hidden; m.userData.hidden = hidden;
            if (inside) { const b = this._winIdx?.[inside]; if (b) { const o = occ[b] || (occ[b] = [0, 0]); if (agent.activity === 'sleeping') o[1]++; else o[0]++; } }
            if (hidden) continue;
            if (crowd || m.userData.far) { const dx = wx - tx0, dz = wz - tz0; this._setAgentFar(m, crowd && aid !== selectedAgent && dx * dx + dz * dz > lodR2); }
            const gy = this.groundY(wx, wz);
            const walking = pos.walking;
            const ws = walking ? Math.sin((pos.walkStep || 0) * 0.45) : 0;
            m.position.set(wx, gy + (walking ? Math.abs(ws) * 0.04 : 0), wz);
            const dir = pos.dir4 === 'side' ? ((pos.facing || 1) > 0 ? 'right' : 'left') : (pos.dir4 || 'down');
            let rot = dir === 'down' ? 0 : dir === 'up' ? Math.PI : dir === 'right' ? Math.PI / 2 : -Math.PI / 2;
            const fp = !walking && face[aid] ? this.agentPositions[face[aid]] : null; if (fp) rot = Math.atan2(fp.x / TILE - wx, fp.y / TILE - wz);
            m.rotation.y += ((((rot - m.rotation.y) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.25;
            const sleeping = agent.activity === 'sleeping';
            for (const ch of m.children) {
                if (ch.name === 'legL') ch.rotation.x = ws * 0.7; else if (ch.name === 'legR') ch.rotation.x = -ws * 0.7;
                else if (ch.name === 'armL') ch.rotation.x = -ws * 0.6; else if (ch.name === 'armR') ch.rotation.x = ws * 0.6;
            }
            const farming = !walking && pos.atFarm && (pos.job === 'farmer' || pos.activity === 'working') && aid !== 'player';
            if (farming || m.userData.farming) {
                const sw = farming ? Math.max(0, Math.sin(this.animFrame * 0.15 + (aid.charCodeAt(0) || 0))) : 0;
                for (const ch of m.children) if (ch.name === 'armR') ch.rotation.x = -2.2 + sw * 1.4;
                if (m.userData.tool) m.userData.tool.visible = farming;
                m.userData.farming = farming;
            }
            m.rotation.x = sleeping && !walking ? -Math.PI / 2 * 0.9 : 0;
            if (sleeping && !walking) m.position.y = gy + 0.32;
            if (aid === selectedAgent) {
                if (!this._selRing) { this._selRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color('#E8732A'), transparent: true, opacity: 0.85, side: THREE.DoubleSide })); this._selRing.rotation.x = -Math.PI / 2; this.scene.add(this._selRing); }
                this._selRing.visible = true; this._selRing.position.set(wx, gy + 0.03, wz);
                const s = 1 + Math.sin(this.animFrame * 0.12) * 0.08; this._selRing.scale.set(s, s, 1);
            }
        }
        if (this._selRing && (!selectedAgent || !seen.has(selectedAgent) || this._agentMeshes[selectedAgent]?.userData.hidden)) this._selRing.visible = false;
        this._updateWindowLights(occ);
        for (const aid of Object.keys(this._agentMeshes)) if (!seen.has(aid)) { this._agentGroup.remove(this._agentMeshes[aid]); this._disposeAgent(this._agentMeshes[aid]); delete this._agentMeshes[aid]; }
    }

    // v6.54.0 窗燈:有人醒著就亮;全家睡了就暗;沒人在家只留一點點;酒館等公共建築 22 點前都亮著。慢慢淡入淡出
    _updateWindowLights(occ) {
        const L = this._winLit; if (!L || !this._winIdx) return; L[0] = 1;
        const h = (this.timeHour ?? 12) + (this.timeMinute ?? 0) / 60; const evening = h >= 16 && h < 22;
        for (const b of Object.values(this._winIdx)) {
            if (!b) continue; const o = occ[b];
            let want = o && o[0] ? 1 : o && o[1] ? 0.04 : 0.14;
            if (this._winPub?.[b] && evening) want = Math.max(want, this._winPub[b] === 'tavern' ? 1 : 0.6);
            L[b] += (want - L[b]) * 0.06;
        }
    }

    // ---------- v6.51.0 寵物與動物:模型朝 +x;位置在畫面端算(跟著主人、在家門口或廣場附近閒晃) ----------
    _petMesh(p) {
        const sig = p.sp + '|' + p.color;
        let m = this._petMeshes?.[p.id]; if (m && m.userData.sig === sig) return m;
        if (!this._petMeshes) { this._petMeshes = {}; this._petGroup = new THREE.Group(); this.scene.add(this._petGroup); }
        if (m) { this._petGroup.remove(m); this._disposeAgent(m); }
        const c = p.color, dk = (() => { const x = new THREE.Color(c); x.multiplyScalar(0.7); return '#' + x.getHexString(); })();
        const body = [], tail = [];
        if (p.sp === 'dog') {
            body.push([0.5, 0.24, 0.24, c, 0, 0.3, 0], [0.2, 0.2, 0.2, c, 0.3, 0.44, 0], [0.12, 0.09, 0.12, dk, 0.44, 0.4, 0], [0.04, 0.04, 0.04, '#1E1A16', 0.5, 0.42, 0],
                [0.05, 0.11, 0.08, dk, 0.27, 0.58, 0.08], [0.05, 0.11, 0.08, dk, 0.27, 0.58, -0.08], [0.03, 0.03, 0.03, '#1E1A16', 0.4, 0.48, 0.06], [0.03, 0.03, 0.03, '#1E1A16', 0.4, 0.48, -0.06]);
            for (const [x, z] of [[0.17, 0.08], [0.17, -0.08], [-0.17, 0.08], [-0.17, -0.08]]) body.push([0.07, 0.2, 0.07, dk, x, 0.1, z]);
            tail.push([0.2, 0.05, 0.05, c, -0.1, 0.02, 0]);
        } else if (p.sp === 'cat') {
            body.push([0.36, 0.17, 0.16, c, 0, 0.2, 0], [0.16, 0.15, 0.15, c, 0.21, 0.31, 0], [0.05, 0.07, 0.04, dk, 0.21, 0.41, 0.05], [0.05, 0.07, 0.04, dk, 0.21, 0.41, -0.05],
                [0.02, 0.03, 0.03, '#3A5A2A', 0.295, 0.33, 0.04], [0.02, 0.03, 0.03, '#3A5A2A', 0.295, 0.33, -0.04], [0.02, 0.02, 0.03, '#D98C8C', 0.295, 0.29, 0]);
            for (const [x, z] of [[0.12, 0.05], [0.12, -0.05], [-0.12, 0.05], [-0.12, -0.05]]) body.push([0.05, 0.12, 0.05, c, x, 0.06, z]);
            tail.push([0.05, 0.28, 0.05, c, -0.02, 0.14, 0]);
        } else {
            body.push([0.22, 0.18, 0.18, c, 0, 0.2, 0], [0.06, 0.12, 0.14, dk, -0.12, 0.27, 0], [0.11, 0.12, 0.11, c, 0.1, 0.35, 0], [0.06, 0.03, 0.04, '#E8A23A', 0.18, 0.35, 0],
                [0.06, 0.05, 0.03, '#C9332D', 0.1, 0.43, 0], [0.025, 0.025, 0.03, '#1E1A16', 0.15, 0.37, 0.05], [0.025, 0.025, 0.03, '#1E1A16', 0.15, 0.37, -0.05],
                [0.03, 0.12, 0.03, '#E8A23A', 0.02, 0.06, 0.05], [0.03, 0.12, 0.03, '#E8A23A', 0.02, 0.06, -0.05]);
        }
        m = new THREE.Group(); m.userData = { sig, x: null, z: null, tx: 0, tz: 0, wait: 0, seed: (p.id.charCodeAt(p.id.length - 1) || 1) };
        m.add(this._partMesh(body));
        if (tail.length && !this._lite()) { const tg = new THREE.Group(); tg.name = 'tail'; tg.position.set(p.sp === 'dog' ? -0.25 : -0.18, p.sp === 'dog' ? 0.38 : 0.25, 0); tg.add(this._partMesh(tail)); m.add(tg); }
        else if (tail.length) { m.children[0].geometry.dispose(); m.remove(m.children[0]); m.add(this._partMesh(body.concat(tail.map(b => [b[0], b[1], b[2], b[3], b[4] + (p.sp === 'dog' ? -0.25 : -0.18), b[5] + (p.sp === 'dog' ? 0.38 : 0.25), b[6]])))); }
        m.scale.setScalar(1.25);
        this._petGroup.add(m); this._petMeshes[p.id] = m;
        return m;
    }
    _zoneSpot(locId) {
        const z = this.buildingZones[locId] || this.natureZones[locId]; if (!z) return null;
        if (z.doorPixelX !== undefined) return { x: z.doorPixelX / TILE, z: (z.doorPixelY !== undefined ? z.doorPixelY / TILE : z.y + z.h) + 0.6, r: 1.1 };
        return { x: z.x + z.w / 2, z: z.y + z.h / 2, r: Math.max(1, Math.min(z.w, z.h) / 2 - 0.5), ring: locId === 'town_square' }; // 廣場中間有噴泉,繞著外圈走
    }
    _updatePets3D(pets) {
        if (!pets.length && !this._petMeshes) return;
        const seen = new Set(); const now = performance.now(); const dt = Math.min(0.1, (now - (this._petT || now)) / 1000); this._petT = now;
        for (const p of pets) {
            const m = this._petMesh(p); seen.add(p.id); const u = m.userData;
            const op = p.owner && this.agentPositions[p.owner]; const om = p.owner && this._agentMeshes[p.owner];
            const follow = op && om && om.visible && !om.userData.hidden && (p.sp === 'dog' || (u.seed % 3 !== 0)); // 有的貓比較獨立,不跟
            let speed = p.sp === 'dog' ? 2.6 : p.sp === 'cat' ? 1.8 : 1.0;
            if (follow) {
                const ox = op.x / TILE, oz = op.y / TILE; const ang = (u.seed % 8) / 8 * Math.PI * 2;
                u.tx = ox + Math.cos(ang) * 0.75; u.tz = oz + Math.sin(ang) * 0.75; if (op.walking) speed *= 1.4;
            } else {
                const spot = this._zoneSpot(p.home || 'town_square') || this._zoneSpot('town_square'); if (!spot) { m.visible = false; continue; }
                if (u.x === null) { const a0 = Math.random() * Math.PI * 2, r0 = spot.r * (spot.ring ? 0.7 : 0.4); u.x = spot.x + Math.cos(a0) * r0; u.z = spot.z + Math.sin(a0) * r0; u.tx = u.x; u.tz = u.z; }
                u.wait -= dt;
                if (u.wait <= 0 && Math.hypot(u.tx - u.x, u.tz - u.z) < 0.05) { const a = Math.random() * Math.PI * 2, r = spot.ring ? spot.r * (0.55 + Math.random() * 0.45) : Math.random() * spot.r; u.tx = spot.x + Math.cos(a) * r; u.tz = spot.z + Math.sin(a) * r; u.wait = 2 + Math.random() * 5; }
            }
            if (u.x === null) { u.x = u.tx; u.z = u.tz; }
            const dx = u.tx - u.x, dz = u.tz - u.z, d = Math.hypot(dx, dz);
            const moving = d > (follow ? 0.35 : 0.04);
            if (moving) { const step = Math.min(d, speed * dt * (follow && d > 3 ? 2 : 1)); u.x += dx / d * step; u.z += dz / d * step; m.rotation.y += ((((Math.atan2(-dz, dx) - m.rotation.y) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.2; }
            m.visible = true;
            const gy = this.groundY(u.x, u.z); const ph = this.animFrame * 0.35 + u.seed;
            m.position.set(u.x, gy + (moving ? Math.abs(Math.sin(ph)) * 0.05 : 0), u.z);
            const tg = m.children.find(c => c.name === 'tail'); if (tg) tg.rotation.y = Math.sin(ph * (p.sp === 'dog' ? 1.6 : 0.4)) * (p.sp === 'dog' ? 0.6 : 0.3);
            if (p.sp === 'chicken' && !moving) m.rotation.z = Math.max(0, Math.sin(ph * 0.5)) * 0.35; else m.rotation.z = 0; // 雞在啄地
        }
        for (const id of Object.keys(this._petMeshes || {})) if (!seen.has(id)) { this._petGroup.remove(this._petMeshes[id]); this._disposeAgent(this._petMeshes[id]); delete this._petMeshes[id]; }
    }

    // ---------- HTML 標籤層 ----------
    _ov(key, cls, html) {
        let el = this._ovPool.get(key);
        if (!el) { el = document.createElement('div'); el.className = cls; this.overlay.appendChild(el); this._ovPool.set(key, el); el._html = null; }
        if (el._html !== html) { el.innerHTML = html; el._html = html; }
        if (el.className !== cls) el.className = cls;
        this._ovUsed.add(key);
        return el;
    }
    _place(el, wx, wy, wz, opts) {
        const p = this._project(wx, wy, wz);
        if (!p || p.x < -80 || p.y < -60 || p.x > this._viewW + 80 || p.y > this._viewH + 60) { el.style.display = 'none'; return false; }
        const s = opts?.noScale ? 1 : clamp(1.25 - p.d / 90, 0.55, 1);
        const tr = `translate(-50%,-100%) translate3d(${p.x.toFixed(0)}px,${p.y.toFixed(0)}px,0) scale(${s.toFixed(2)})`;
        if (el._tr !== tr) { el._tr = tr; el.style.transform = tr; el.style.zIndex = String(Math.round(1000 - p.d)); } // v6.28.0 沒動就不寫 DOM
        if (el.style.display) el.style.display = '';
        return true;
    }
    _updateOverlays(agents, selectedAgent) {
        if (!this.overlay) return;
        this._ovUsed.clear();
        const now = Date.now();
        // 建築 / 地點名牌(編號圓牌)
        for (const [locId, lp] of Object.entries(this.labelPositions)) {
            const z = this.buildingZones[locId] || this.natureZones[locId];
            const top = this._buildingTops?.[locId] ?? (z && z.doorPixelX === undefined ? 1.2 : 2.6);
            const cx = z ? z.x + z.w / 2 : lp.x / TILE, cz = z ? z.y + z.h / 2 : lp.y / TILE;
            const n = this._labelIndex?.[locId] || '';
            const el = this._ov('loc:' + locId, 't3d-label' + (locId === this._hoverLoc ? ' is-hot' : ''), `<span class="t3d-num">${n}</span><span class="t3d-name">${this._esc(t3(lp.name))}</span>`);
            if (!el._bound) { el._bound = true; el.addEventListener('click', (e) => { e.stopPropagation(); this._lastTapExact = true; this.focusLocation(locId); if (this.onClick) this.onClick(locId); }); }
            this._place(el, cx, top + 0.3, cz);
        }
        const extraLabels = [].concat(this._lmLabels || [], this._dynLabels || [], this._factLabels || [], this._expLabels || [], this._industryLabels(), this._graveLabel ? [this._graveLabel] : [], this._festLabel ? [this._festLabel] : [], this._caravanLabel ? [this._caravanLabel] : []);
        for (const d of extraLabels) { const el = this._ov(d.key, d.cls, d.html); this._place(el, d.x, d.y, d.z); }
        // 村民名牌、表情、睡眠
        const shownBubble = new Set();
        const convos = (this._activeConvoBubbles || []).filter(c => now < c.expiry);
        this._activeConvoBubbles = convos;
        const talking = new Set(); for (const c of convos) for (const b of (c.bubbles || [])) talking.add(b.agentId);
        for (const [aid, pos] of Object.entries(this.agentPositions)) {
            const agent = agents[aid]; const m = this._agentMeshes[aid];
            if (!agent || !m || !m.visible) continue;
            const wx = pos.x / TILE, wz = pos.y / TILE, gy = m.position.y;
            const isSel = aid === selectedAgent;
            const emote = this.agentEmotes?.[aid];
            if (m.userData.far && !isSel && !emote && !talking.has(aid)) continue; // v6.55.0 人多時遠處的人不掛名牌(選取、有表情、在說話的照常)
            const sleeping = agent.activity === 'sleeping' && !this.agentPositions[aid]?.walking; // v6.44.2 還在走回家的路上不冒 zzz(看起來像夢遊)
            const extra = sleeping ? ' <i class="t3d-zzz">z z z</i>' : emote ? ` <i class="t3d-emo">${emote}</i>` : '';
            let office = ''; try { const W = window.rimtownApp?.world; const bd = W && typeof TIERS !== 'undefined' ? TIERS.badge(W, W.agents[aid]) : null; if (bd && bd.cls !== 'former') office = `<b class="t3d-office t3d-office-${bd.cls}">${bd.icon} ${this._esc(bd.text)}</b>`; } catch (e) {} // v6.56.0 官職標籤
            const el = this._ov('ag:' + aid, 't3d-tag' + (isSel ? ' is-sel' : '') + (aid === 'player' ? ' is-player' : '') + (office ? ' has-office' : ''), `${office}${this._esc(t3(agent.name || aid))}${extra}`);
            this._place(el, wx, gy + 0.3 + 1.85 * ((m.scale.y || 1.3) / 1.3), wz); // v6.92.0 小孩的名牌跟著放低
            if (!el._bound) { el._bound = true; el.addEventListener('click', (e) => { e.stopPropagation(); if (this.onAgentClick) this.onAgentClick(aid); }); }
        }
        // 對話泡泡
        for (const c of convos) for (const b of c.bubbles) {
            if (shownBubble.has(b.agentId)) continue;
            const pos = this.agentPositions[b.agentId]; const m = this._agentMeshes[b.agentId];
            if (!pos || !m || !m.visible) continue;
            shownBubble.add(b.agentId);
            const full = String(b.text || ''); const text = clipText(full, 56); // v6.36.0 截斷補省略號
            const el = this._ov('bb:' + b.agentId, 't3d-bubble', `<b>${this._esc(t3(b.speaker || ''))}</b>${this._esc(t3(text))}`);
            this._place(el, pos.x / TILE, m.position.y + 0.3 + 2.2 * ((m.scale.y || 1.3) / 1.3), pos.y / TILE);
        }
        // 浮動特效
        const fx = this._floatFx;
        if (fx && fx.length) {
            for (let i = fx.length - 1; i >= 0; i--) {
                const f = fx[i]; f.life++;
                f.x += f.vx || 0; f.y += f.vy || 0; if (f.grav) f.vy += f.grav;
                if (f.life >= f.maxLife) { fx.splice(i, 1); continue; }
                const a = f.life < 8 ? f.life / 8 : f.life > f.maxLife - 14 ? (f.maxLife - f.life) / 14 : 1;
                const el = this._ov('fx:' + (f._id || (f._id = Math.random())), 't3d-fx', `<span style="color:${this._esc(f.color || '#ffe45e')}">${this._esc(f.text)}</span>`);
                if (this._place(el, f.x / TILE, 1.6 - (f.y / TILE), f.y / TILE)) el.style.opacity = a.toFixed(2);
            }
        }
        // 點擊移動指示
        if (this._moveIndicator && now < this._moveIndicator.expiry) {
            const mi = this._moveIndicator; const el = this._ov('mi', 't3d-move', '◎');
            this._place(el, mi.x / TILE, 0.4, mi.y / TILE, { noScale: true });
        }
        for (const [key, el] of this._ovPool) if (!this._ovUsed.has(key)) { if (/^(fx|bb|cb|cs|fac|exp|ind|carav|fest|grave):?/.test(key)) { el.remove(); this._ovPool.delete(key); } else el.style.display = 'none'; }
    }

    // ---------- v6.24.0 粒子(雨／雪／煙／螢火蟲／節慶彩紙)----------
    _fxInit() {
        if (this._fx) return;
        const mk = (n, mat, lines) => {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3 * (lines ? 2 : 1)), 3));
            g.setDrawRange(0, 0);
            const m = lines ? new THREE.LineSegments(g, mat) : new THREE.Points(g, mat);
            m.frustumCulled = false; m.renderOrder = 5; this.scene.add(m);
            return { mesh: m, cap: n, list: [] };
        };
        this._fx = {
            rain: mk(this.lowQuality ? 700 : 2200, new THREE.LineBasicMaterial({ color: new THREE.Color('#9FB8D8'), transparent: true, opacity: 0.7 }), true), // v6.36.0 雨更明顯:更多、更深、更長
            snow: mk(this.lowQuality ? 500 : 1400, new THREE.PointsMaterial({ color: new THREE.Color('#FFFFFF'), size: 0.28, transparent: true, opacity: 0.95, depthWrite: false })),
            smoke: mk(300, new THREE.PointsMaterial({ color: new THREE.Color('#C9C4BC'), size: 0.5, transparent: true, opacity: 0.35, depthWrite: false })),
            firefly: mk(200, new THREE.PointsMaterial({ color: new THREE.Color('#D9FF7A'), size: 0.22, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })),
            fest: mk(400, new THREE.PointsMaterial({ color: new THREE.Color('#FFD54F'), size: 0.22, transparent: true, opacity: 0.95, depthWrite: false, vertexColors: false })),
            leaf: mk(150, new THREE.PointsMaterial({ color: new THREE.Color('#C98A3A'), size: 0.16, transparent: true, opacity: 0.8, depthWrite: false })),
        };
        // 星空:夜晚才看得到
        const n = 420, pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.3, r = 260; pos[i * 3] = this.cols / 2 + Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = this.rows / 2 + Math.sin(a) * Math.cos(e) * r; }
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this._stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color('#FFFFFF'), size: 1.6, transparent: true, opacity: 0, depthWrite: false, fog: false }));
        this._stars.frustumCulled = false; this.scene.add(this._stars);
        this._skyInit();
    }
    // v6.32.0 太陽／月亮、低多邊形雲、鳥群(掛在 scene,不隨地圖重建)
    _skyInit() {
        const disc = (hex, r) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0, fog: false, depthWrite: false })); m.frustumCulled = false; m.renderOrder = -2; this.scene.add(m); return m; };
        this._sunDisc = disc('#FFE9A8', 9); this._moonDisc = disc('#F2F4F8', 6);
        // 雲:全部方塊放在一個 InstancedMesh 裡(一次繪製呼叫),每朵雲記自己的位置與速度,每幀重算矩陣
        const n = this.lowQuality ? 4 : this.isMobile ? 6 : 9; this._clouds = []; const parts = [];
        this._cloudMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#FFFFFF'), emissive: new THREE.Color('#FFFFFF'), emissiveIntensity: 0.35, transparent: true, opacity: 0.92 }); // 側面不要灰,看起來才蓬
        // v6.34.1 一朵一朵的棉花雲:一顆大方塊 + 周圍 4–6 顆小方塊 + 頂上 1–2 顆,底部切齊、頂部蓬;每朵約 7–10 格寬、彼此至少隔 14 格
        // 高度 13–16(屋頂上方一點)、每朵 5–7 格:俯瞰(鏡頭 40–93)看到一朵朵小雲帶著影子飄過;鏡頭降到雲層附近或以下就淡掉只留影子
        const placed = [];
        for (let i = 0; i < n; i++) {
            let gx = 0, gz = 0;
            for (let tries = 0; tries < 20; tries++) { gx = Math.random() * (this.cols + 30) - 15; gz = Math.random() * this.rows; if (placed.every(p => Math.hypot(p[0] - gx, p[1] - gz) > 12)) break; }
            placed.push([gx, gz]);
            const S = 0.62 + Math.random() * 0.3; // 整朵的尺度(每朵約 5–7 格)
            const g = { x: gx, y: 13 + Math.random() * 3, z: gz, v: 0.004 + Math.random() * 0.006, parts: [] };
            const puff = (ox, oz, w, h, d, lift) => g.parts.push({ ox: ox * S, oz: oz * S, oy: (h * S) / 2 + (lift || 0) * S, sx: w * S, sy: h * S, sz: d * S });
            puff(0, 0, 3.4, 1.7, 2.6, 0);                                   // 主體
            const k = 4 + Math.floor(Math.random() * 3);
            for (let j = 0; j < k; j++) { const a = j / k * Math.PI * 2 + Math.random() * 0.6, r = 1.6 + Math.random() * 0.9, w = 1.4 + Math.random() * 1.0; puff(Math.cos(a) * r, Math.sin(a) * r * 0.75, w, 0.8 + Math.random() * 0.5, w * 0.8, 0); }
            puff((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.8, 1.9, 1.1, 1.5, 1.1); // 頂上的蓬
            if (Math.random() < 0.6) puff((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.2, 1.2, 0.8, 1.0, 1.6);
            for (const p of g.parts) parts.push(g);
            this._clouds.push(g);
        }
        this._cloudMesh = new THREE.InstancedMesh(this._geo('box', () => new THREE.BoxGeometry(1, 1, 1)), this._cloudMat, parts.length);
        this._cloudMesh.frustumCulled = false; this._cloudMesh.castShadow = false; this._cloudMesh.receiveShadow = false; this.scene.add(this._cloudMesh);
        // 地面雲影:同樣一個 InstancedMesh,扁平深色方塊貼地,白天才看得到
        this._cloudShadowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#1E2A3A'), transparent: true, opacity: 0.12, depthWrite: false });
        this._cloudShadow = new THREE.InstancedMesh(this._geo('box', () => new THREE.BoxGeometry(1, 1, 1)), this._cloudShadowMat, parts.length);
        this._cloudShadow.frustumCulled = false; this._cloudShadow.renderOrder = 1; this.scene.add(this._cloudShadow);
        this._cloudM4 = new THREE.Matrix4(); this._cloudQ = new THREE.Quaternion(); this._cloudP = new THREE.Vector3(); this._cloudS = new THREE.Vector3();
        if (!this.lowQuality) {
            const nb = 7; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nb * 4 * 3), 3));
            this._birds = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color('#2B2118'), transparent: true, opacity: 0.75 }));
            this._birds.frustumCulled = false; this._birds.userData = { n: nb, a: 0 }; this.scene.add(this._birds);
        }
    }
    _fxSpawn(type, p) { const f = this._fx[type]; if (f.list.length < f.cap) f.list.push(p); }
    // v6.32.0 天空:雲飄、鳥群繞圈(白天、沒下雨雪)、樹冠風搖的 uniform
    _updateSky(night, wt, frame) {
        const bad = wt === 'rain' || wt === 'storm' || wt === 'snow' || wt === 'blizzard';
        if (this._clouds) {
            const c = this._cloudMat.color.setRGB(1, 1, 1); c.lerp(this._lc?.skyNight || c, night * 0.75); if (bad || wt === 'fog') c.lerp(this._lc?.rain || c, 0.6);
            // v6.34.1 雲本體只在鏡頭明顯高於雲層時顯示(俯瞰看一朵朵小雲帶影子飄過);鏡頭降到 28 以下開始淡、22 以下只剩雲影,不會再有整片霧白
            const camY = this.camera ? this.camera.position.y : 0; const camFade = clamp((camY - 22) / 6, 0, 1);
            this._cloudMat.opacity = (wt === 'fog' || bad ? 0.96 : 0.9) * camFade; this._cloudMesh.visible = camFade > 0.02;
            this._cloudMat.emissiveIntensity = (wt === 'fog' || bad) ? 0.08 : 0.35; // 陰雨霧的雲不發亮,才像灰雲
            // v6.36.0 霧天／陰雨雪:雲放大 1.4 倍、壓低 2 格,天空被一朵朵灰雲蓋住,地面不再霧白
            const cs = (wt === 'fog') ? 1.45 : bad ? 1.3 : 1, cy = (wt === 'fog') ? -2 : bad ? -1 : 0;
            const day = 1 - night; this._cloudShadowMat.opacity = 0.14 * day * (bad ? 0.4 : wt === 'fog' ? 0.3 : 1); this._cloudShadow.visible = this._cloudShadowMat.opacity > 0.01;
            const span = this.cols + 30, sp = wt === 'storm' || wt === 'blizzard' ? 3 : 1; let idx = 0;
            for (const g of this._clouds) {
                g.x += g.v * sp; if (g.x > this.cols + 15) g.x -= span;
                for (const p of g.parts) {
                    this._cloudM4.compose(this._cloudP.set(g.x + p.ox * cs, g.y + cy + p.oy * cs, g.z + p.oz * cs), this._cloudQ, this._cloudS.set(p.sx * cs, p.sy * cs, p.sz * cs)); this._cloudMesh.setMatrixAt(idx, this._cloudM4);
                    this._cloudM4.compose(this._cloudP.set(g.x + p.ox * cs + 3, 0.04, g.z + p.oz * cs + 2), this._cloudQ, this._cloudS.set(p.sx * 0.9 * cs, 0.02, p.sz * 0.9 * cs)); this._cloudShadow.setMatrixAt(idx, this._cloudM4); // 雲影往太陽反方向偏一點
                    idx++;
                }
            }
            this._cloudMesh.instanceMatrix.needsUpdate = true; this._cloudShadow.instanceMatrix.needsUpdate = true;
        }
        if (this._birds) {
            const b = this._birds, u = b.userData; const show = night < 0.35 && !bad && wt !== 'fog'; b.visible = show;
            if (show) {
                u.a += 0.004; const arr = b.geometry.attributes.position.array; const cx = this.cols / 2 + Math.cos(u.a * 0.3) * 9, cz = this.rows / 2 + Math.sin(u.a * 0.23) * 9;
                for (let i = 0; i < u.n; i++) {
                    const a = u.a + i * 0.5, r = 9 + (i % 3) * 1.5; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = 15 + Math.sin(a * 2 + i) * 0.6;
                    const flap = Math.sin(frame * 0.25 + i) * 0.3, hx = -Math.sin(a), hz = Math.cos(a), o = i * 12, wl = 0.5;
                    arr[o] = x + hz * wl; arr[o + 1] = y + flap; arr[o + 2] = z - hx * wl; arr[o + 3] = x; arr[o + 4] = y; arr[o + 5] = z;
                    arr[o + 6] = x; arr[o + 7] = y; arr[o + 8] = z; arr[o + 9] = x - hz * wl; arr[o + 10] = y + flap; arr[o + 11] = z + hx * wl;
                }
                b.geometry.attributes.position.needsUpdate = true;
            }
        }
        const sh = this._canopy?.userData.shader; if (sh) { sh.uniforms.uTime.value = frame / 60; sh.uniforms.uWind.value = wt === 'storm' || wt === 'blizzard' ? 2.6 : bad ? 1.5 : 0.7; }
    }
    // v6.54.0 夏夜螢火蟲:晴朗的夏天晚上,草地樹邊一閃一閃(一個 Points,一次繪製)
    _updateFireflies() {
        const night = this._nightAmount(), wt = this.weatherType || 'clear';
        const on = this.season === '夏季' && night > 0.55 && (wt === 'clear' || wt === 'cloudy');
        if (!on) { if (this._ff) this._ff.visible = false; return; }
        if (!this._ff || this._ffSrc !== this.grid) {
            if (this._ff) { this.scene.remove(this._ff); this._ff.geometry.dispose(); }
            const n = this._lite() ? 22 : 48, seeds = [];
            for (let tries = 0; seeds.length < n && tries < n * 30; tries++) {
                const x = 2 + Math.random() * (this.cols - 4), z = 2 + Math.random() * (this.rows - 4); const tile = this.grid[Math.floor(z)]?.[Math.floor(x)];
                if (tile === undefined || tile === T.WATER || this._isInsideBuilding?.(x * TILE, z * TILE)) continue;
                seeds.push({ x, z, y: this.groundY(x, z) + 0.4 + Math.random() * 1.1, p: Math.random() * 6.28, s: 0.4 + Math.random() * 0.6 });
            }
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seeds.length * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(seeds.length * 3), 3));
            const m = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
            this._ff = new THREE.Points(g, m); this._ff.frustumCulled = false; this._ff.userData.seeds = seeds; this._ffSrc = this.grid; this.scene.add(this._ff);
        }
        this._ff.visible = true;
        const f = this.animFrame * 0.016, seeds = this._ff.userData.seeds, pa = this._ff.geometry.attributes.position, ca = this._ff.geometry.attributes.color, k = clamp((night - 0.55) / 0.3, 0, 1);
        for (let i = 0; i < seeds.length; i++) {
            const q = seeds[i], t = f * q.s + q.p;
            pa.setXYZ(i, q.x + Math.sin(t * 0.7) * 0.6, q.y + Math.sin(t * 1.3) * 0.18, q.z + Math.cos(t * 0.6) * 0.6);
            const b = Math.max(0, Math.sin(t * 2.2)) ** 3 * k; ca.setXYZ(i, 0.85 * b, 1.0 * b, 0.45 * b);
        }
        pa.needsUpdate = true; ca.needsUpdate = true;
    }
    _updateParticles() {
        this._fxInit();
        const f = this._fx, frame = this.animFrame, night = this._nightAmount();
        const tx = this.target.x, tz = this.target.z, R = Math.min(30, this.dist * 0.8);
        const wt = this.weatherType || 'clear';
        const heavy = wt === 'storm' || wt === 'blizzard';
        const q = this.lowQuality ? 0.45 : this.isMobile ? 0.6 : 1; // v6.28.0
        if (wt === 'rain' || wt === 'storm') for (let i = 0; i < Math.round((heavy ? 40 : 24) * q); i++) this._fxSpawn('rain', { x: tx + (Math.random() - 0.5) * R * 2, y: 10 + Math.random() * 8, z: tz + (Math.random() - 0.5) * R * 2, vx: heavy ? 0.12 : 0.03, vy: -0.55 - Math.random() * 0.2, vz: 0, life: 60 });
        if (wt === 'snow' || wt === 'blizzard') for (let i = 0; i < Math.round((heavy ? 18 : 9) * q); i++) this._fxSpawn('snow', { x: tx + (Math.random() - 0.5) * R * 2, y: 9 + Math.random() * 6, z: tz + (Math.random() - 0.5) * R * 2, vx: heavy ? 0.06 : 0.01, vy: -0.06 - Math.random() * 0.04, vz: 0, life: 400, ph: Math.random() * 6.28 });
        if (frame % 10 === 0 && this._chimneyTops) for (const c of this._chimneyTops) if (Math.random() < 0.6) this._fxSpawn('smoke', { x: c.x + (Math.random() - 0.5) * 0.2, y: c.y, z: c.z + (Math.random() - 0.5) * 0.2, vx: (Math.random() - 0.5) * 0.01 + 0.012, vy: 0.025 + Math.random() * 0.012, vz: (Math.random() - 0.5) * 0.01, life: 90 + Math.random() * 40, maxLife: 130 });
        if (night > 0.6 && frame % 6 === 0) for (const z of Object.values(this.natureZones)) if (Math.random() < 0.25 * q) this._fxSpawn('firefly', { x: z.x + Math.random() * z.w, y: 0.4 + Math.random() * 1.4, z: z.y + Math.random() * z.h, vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.5) * 0.01, vz: (Math.random() - 0.5) * 0.02, life: 120 + Math.random() * 100, ph: Math.random() * 6.28 });
        if (this.season === '秋季' && frame % 12 === 0) { const fz = this.natureZones['forest']; if (fz && Math.random() < 0.6) this._fxSpawn('leaf', { x: fz.x + Math.random() * fz.w, y: 2.5 + Math.random(), z: fz.y + Math.random() * fz.h, vx: 0.015 + Math.random() * 0.01, vy: -0.018, vz: 0.01, life: 160, ph: Math.random() * 6.28 }); }
        const fest = this.festivalData?.activeFestival;
        if (fest && frame % 4 === 0) { const sq = this.buildingZones['town_square'] || this.natureZones['town_square']; if (sq) for (let i = 0; i < 3; i++) this._fxSpawn('fest', { x: sq.x + Math.random() * sq.w, y: 4 + Math.random() * 3, z: sq.y + Math.random() * sq.h, vx: (Math.random() - 0.5) * 0.02, vy: -0.02 - Math.random() * 0.02, vz: (Math.random() - 0.5) * 0.02, life: 150, ph: Math.random() * 6.28 }); }
        for (const [type, fx] of Object.entries(f)) {
            const arr = fx.mesh.geometry.attributes.position.array; let n = 0;
            for (let i = fx.list.length - 1; i >= 0; i--) {
                const p = fx.list[i]; p.life--;
                p.x += p.vx; p.y += p.vy; p.z += p.vz;
                if (type === 'snow' || type === 'leaf') p.x += Math.sin(frame * 0.05 + p.ph) * 0.01;
                if (type === 'firefly') { p.vx += (Math.random() - 0.5) * 0.004; p.vz += (Math.random() - 0.5) * 0.004; p.vx *= 0.97; p.vz *= 0.97; }
                if (type === 'fest') { p.x += Math.sin(frame * 0.1 + p.ph) * 0.02; }
                if (p.life <= 0 || p.y < -0.3 || (type === 'smoke' && p.y > 12)) { fx.list.splice(i, 1); continue; }
                if (type === 'rain') { arr[n * 6] = p.x; arr[n * 6 + 1] = p.y; arr[n * 6 + 2] = p.z; arr[n * 6 + 3] = p.x - p.vx * 2.2; arr[n * 6 + 4] = p.y - p.vy * 2.2; arr[n * 6 + 5] = p.z; }
                else { arr[n * 3] = p.x; arr[n * 3 + 1] = p.y; arr[n * 3 + 2] = p.z; }
                n++;
            }
            fx.mesh.geometry.setDrawRange(0, type === 'rain' ? n * 2 : n);
            fx.mesh.geometry.attributes.position.needsUpdate = true;
            fx.mesh.visible = n > 0;
        }
        if (f.firefly.mesh.visible) f.firefly.mesh.material.opacity = 0.55 + Math.sin(frame * 0.12) * 0.35;
        if (this._stars) { this._stars.material.opacity = clamp((night - 0.5) * 2, 0, 1) * 0.9; this._stars.visible = this._stars.material.opacity > 0.02; }
        this._updateSky(night, wt, frame);
        // 燈塔夜間光束
        if (this._lighthouse) {
            if (!this._beam) {
                const g = new THREE.ConeGeometry(2.2, 34, 12, 1, true); g.rotateX(-Math.PI / 2); g.translate(0, 0, 17);
                this._beam = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE9A8'), transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
                this._beam.position.set(this._lighthouse.tx + 0.5, 5.6, this._lighthouse.ty + 0.5); this.scene.add(this._beam);
            }
            const on = night > 0.5 || this.lighthouseUpgraded && night > 0.2;
            this._beam.visible = on; if (on) { this._beam.rotation.y = frame * 0.012; this._beam.material.opacity = 0.1 + night * 0.1; }
        }
    }

    // ---------- v6.24.0 農田、工廠、墓園、探索標記、節慶 ----------
    // v6.47.0 地標:圍著廣場排一圈石座＋碑,名牌用 overlay(最多 6 座)
    _syncLandmarks() {
        const L = Array.isArray(this.landmarks) ? this.landmarks : [];
        const sig = L.map(x => x.name + x.icon).join('|') + '|' + (this.grid ? 1 : 0);
        if (sig === this._lmSig) return; this._lmSig = sig;
        if (!this._lmGroup) { this._lmGroup = new THREE.Group(); this.scene.add(this._lmGroup); }
        this._clearGroup(this._lmGroup); this._lmLabels = [];
        const sq = this.buildingZones['town_square'] || this.natureZones['town_square']; if (!sq || !L.length) return;
        const spots = [[0.4, 0.4], [sq.w - 1.4, 0.4], [0.4, sq.h - 1.4], [sq.w - 1.4, sq.h - 1.4], [sq.w / 2 - 0.5, 0.4], [sq.w / 2 - 0.5, sq.h - 1.4]]; // 廣場四角＋兩邊中間(在廣場裡,不會壓到路或房子)
        L.slice(-6).forEach((x, i) => {
            const [ox, oz] = spots[i]; const cx = sq.x + ox + 0.5, cz = sq.y + oz + 0.5, gy = this.groundY(cx, cz);
            this._box(0.9, 0.25, 0.9, '#8C8578', cx, gy + 0.125, cz, this._lmGroup);
            this._box(0.5, 0.9, 0.5, '#B9AE98', cx, gy + 0.7, cz, this._lmGroup);
            this._box(0.6, 0.12, 0.6, '#D9C9A3', cx, gy + 1.21, cz, this._lmGroup);
            this._lmLabels.push({ key: 'lm:' + i, cls: 't3d-label t3d-landmark', html: `<span class="t3d-num">${this._esc(x.icon || '🗿')}</span><span class="t3d-name">${this._esc(typeof t3 === 'function' ? t3(x.name) : x.name)}</span>`, x: cx, y: gy + 1.9, z: cz });
        });
    }
    _syncExtras(extraData) {
        const farm = extraData?.farm, proc = extraData?.processing;
        const plots = farm?.plots || [];
        const fz = this.buildingZones['farm'] || this.natureZones['farm'];
        const fsig = fz ? plots.map(p => p.state + (p.crop || '') + Math.round((p.growthProgress || 0) * 5)).join(',') : '';
        if (fsig !== this._farmSig) {
            this._farmSig = fsig;
            if (!this._farmGroup) { this._farmGroup = new THREE.Group(); this.scene.add(this._farmGroup); }
            this._clearGroup(this._farmGroup);
            if (fz) {
                const CROP = { wheat: '#E8C840', potato: '#8B7355', rice: '#B8D860', corn: '#C8A830', cotton: '#E0D8D0', flowers: '#F080A0', herbs: '#389830', mushroom: '#C0A878', sugarcane: '#90C870', tea: '#407830', grapes: '#8060A0', golden_wheat: '#FFD700', dragon_fruit: '#E83860' };
                const sx = fz.x - 3, sz = fz.y + fz.h + 1, ps = 14 / TILE, gap = 2 / TILE;
                plots.forEach((plot, i) => {
                    const cx = sx + (i % 4) * (ps + gap) + ps / 2, cz = sz + Math.floor(i / 4) * (ps + gap) + ps / 2, gy = this.groundY(cx, cz);
                    const soil = plot.state === 'empty' ? '#8B7355' : '#5A3A20';
                    this._box(ps, 0.1, ps, soil, cx, gy + 0.05, cz, this._farmGroup);
                    if (plot.state === 'tilled') for (let r = 0; r < 3; r++) this._box(ps * 0.9, 0.04, 0.08, '#4A2A15', cx, gy + 0.12, cz - ps / 3 + r * ps / 3, this._farmGroup);
                    if (plot.state === 'growing' || plot.state === 'ready') {
                        const pr = plot.state === 'ready' ? 1 : (plot.growthProgress || 0);
                        const h = 0.12 + pr * 0.5, col = pr < 0.35 ? '#7EC850' : pr < 0.7 ? '#5CAD42' : (CROP[plot.crop] || '#8BC34A');
                        for (let k = 0; k < 4; k++) this._box(0.14, h, 0.14, col, cx - ps / 4 + (k % 2) * ps / 2, gy + 0.1 + h / 2, cz - ps / 4 + Math.floor(k / 2) * ps / 2, this._farmGroup);
                        if (plot.state === 'ready') this._box(ps * 0.5, 0.14, ps * 0.5, '#FFD700', cx, gy + 0.2 + h, cz, this._farmGroup).material = this._mat('#FFD700', { emissive: new THREE.Color('#FFB300'), emissiveIntensity: 0.4 });
                    }
                });
            }
        }
        // 工廠地塊
        const fplots = this._getFactoryPlots ? this._getFactoryPlots() : [];
        const facts = proc?.builtFactories || {};
        const fkeys = Object.keys(facts);
        const psig = fplots.length ? fkeys.map(k => k + (facts[k].status || '') + Math.round((facts[k].buildProgress || 0) / (facts[k].buildRequired || 1) * 10)).join(',') + '|' + fplots.length : '';
        if (psig !== this._factSig) {
            this._factSig = psig; this._factLabels = [];
            if (!this._factGroup) { this._factGroup = new THREE.Group(); this.scene.add(this._factGroup); }
            this._clearGroup(this._factGroup);
            const ROOFS = ['#C85040', '#4878B8', '#8858A8', '#3A8A58', '#C88030', '#B84878', '#607890'];
            fplots.forEach((pl, i) => {
                const cx = pl.x + pl.w / 2, cz = pl.y + pl.h / 2, gy = this.groundY(cx, cz);
                const key = fkeys[i], fac = key ? facts[key] : null, def = fac && typeof FACTORIES !== 'undefined' ? FACTORIES[key] : null;
                if (!fac || !def) { this._box(pl.w, 0.08, pl.h, '#A9A196', cx, gy + 0.04, cz, this._factGroup); this._box(0.9, 0.2, 0.4, '#C8A060', cx, gy + 0.18, cz, this._factGroup); this._box(0.9, 0.2, 0.4, '#A0522D', cx, gy + 0.38, cz, this._factGroup); return; }
                if (fac.status === 'building') {
                    this._box(pl.w, 0.1, pl.h, '#9B7B52', cx, gy + 0.05, cz, this._factGroup);
                    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this._box(0.1, 1.8, 0.1, '#8B5A2B', cx + ox * (pl.w / 2 - 0.3), gy + 0.9, cz + oz * (pl.h / 2 - 0.3), this._factGroup);
                    const pr = Math.min(1, (fac.buildProgress || 0) / (fac.buildRequired || 1));
                    this._factLabels.push({ key: 'fac:' + key, x: cx, y: gy + 2.4, z: cz, cls: 't3d-label t3d-site', html: `<span class="t3d-name">🚧 ${this._esc(t3(def.name))}</span><i class="t3d-bar"><b style="width:${Math.round(pr * 100)}%"></b></i>` });
                    return;
                }
                const wallH = 1.6;
                this._box(pl.w - 0.3, wallH, pl.h - 0.3, '#D9C3A5', cx, gy + wallH / 2, cz, this._factGroup);
                this._box(pl.w, 0.12, pl.h, ROOFS[i % ROOFS.length], cx, gy + wallH + 0.06, cz, this._factGroup);
                const r = this._cone(1, 0.7, 4, ROOFS[i % ROOFS.length], cx, gy + wallH + 0.45, cz, this._factGroup); r.rotation.y = Math.PI / 4; r.scale.set(pl.w * 0.72, 0.7, pl.h * 0.72);
                this._box(0.3, 0.9, 0.3, '#8A6A5A', cx + pl.w / 2 - 0.5, gy + wallH + 0.6, cz - pl.h / 2 + 0.5, this._factGroup);
                this._chimneyTops = this._chimneyTops || []; if (!this._chimneyTops.some(c => c.key === key)) this._chimneyTops.push({ key, x: cx + pl.w / 2 - 0.5, y: gy + wallH + 1.1, z: cz - pl.h / 2 + 0.5 });
                this._factLabels.push({ key: 'fac:' + key, x: cx, y: gy + wallH + 1.3, z: cz, cls: 't3d-label t3d-mini' + (fac.status === 'active' ? ' is-active' : ''), html: `<span class="t3d-name">${this._esc(def.icon || '')}${this._esc(t3(def.name))}</span>` });
            });
        }
        // 墓園(教堂旁)
        const graves = this.graveyardData || [];
        const gz = this.natureZones['graveyard'];
        const gkey = (graves.length || 0) + (gz ? `@${gz.x},${gz.y}` : '');
        if (gkey !== this._graveN) {
            this._graveN = gkey;
            if (!this._graveGroup) { this._graveGroup = new THREE.Group(); this.scene.add(this._graveGroup); }
            this._clearGroup(this._graveGroup); this._graveLabel = null;
            if (gz) {
                // v6.85.0 固定墓園:柵欄是地圖格子;這裡放墓碑(最近 15 座,一排 5 座)、柏樹與紀念石,沒人過世也有這塊地
                const stone = '#7A8898', face = '#C9D2DA', old = '#8E8A80';
                const cx0 = gz.x + 1.2, cz0 = gz.y + 1.1;
                graves.slice(-15).forEach((g, i) => {
                    const x = cx0 + (i % 5) * 0.95, z = cz0 + Math.floor(i / 5) * 1.0, gy = this.groundY(x, z);
                    const col = i < Math.max(0, Math.min(graves.length, 15) - 5) ? old : stone; // 越早的墓碑顏色越舊
                    this._box(0.4, 0.55, 0.14, col, x, gy + 0.27, z, this._graveGroup);
                    const top = this._cyl(0.2, 0.2, 0.14, 10, col, x, gy + 0.55, z, this._graveGroup); top.rotation.x = Math.PI / 2;
                    this._box(0.05, 0.25, 0.03, face, x, gy + 0.4, z + 0.08, this._graveGroup); this._box(0.16, 0.05, 0.03, face, x, gy + 0.46, z + 0.08, this._graveGroup);
                });
                const tx = gz.x + gz.w - 1.4, tz = gz.y + 1.2, tgy = this.groundY(tx, tz);
                this._cyl(0.08, 0.1, 0.5, 6, '#5B4636', tx, tgy + 0.25, tz, this._graveGroup);
                this._cyl(0.02, 0.42, 1.8, 7, '#2F5A3A', tx, tgy + 1.35, tz, this._graveGroup); // 柏樹
                const mx = gz.x + gz.w - 1.4, mz = gz.y + gz.h - 1.8, mgy = this.groundY(mx, mz);
                this._box(0.7, 0.18, 0.4, '#6E747C', mx, mgy + 0.09, mz, this._graveGroup);
                this._box(0.5, 0.7, 0.18, '#8A9099', mx, mgy + 0.5, mz, this._graveGroup); // 紀念石
            } else if (graves.length) {
                const ch = this.buildingZones['chapel'] || this.natureZones['chapel'];
                const bx = ch ? ch.x + ch.w + 1 : this.cols - 8, bz = ch ? ch.y : this.rows - 8;
                graves.slice(-10).forEach((g, i) => {
                    const x = bx + (i % 5) * 0.875 + 0.4, z = bz + Math.floor(i / 5) * 1.1 + 0.4, gy = this.groundY(x, z);
                    this._box(0.4, 0.55, 0.14, '#7A8898', x, gy + 0.27, z, this._graveGroup);
                    const top = this._cyl(0.2, 0.2, 0.14, 10, '#7A8898', x, gy + 0.55, z, this._graveGroup); top.rotation.x = Math.PI / 2;
                    this._box(0.05, 0.25, 0.03, '#C9D2DA', x, gy + 0.4, z + 0.08, this._graveGroup); this._box(0.16, 0.05, 0.03, '#C9D2DA', x, gy + 0.46, z + 0.08, this._graveGroup);
                });
                this._graveLabel = { key: 'grave', x: bx + 2.2, y: 1.4, z: bz + 0.4, cls: 't3d-label t3d-mini', html: `<span class="t3d-name">🪦 ${this._esc(t3('墓園'))}</span>` };
            }
        }
        // 探索據點(地圖邊緣旗幟)
        const ex = this.explorationData;
        const zones = ex?.discoveredZones ? Object.keys(ex.discoveredZones) : [];
        const active = new Set((ex?.activeExpeditions || []).map(e => e.zoneId));
        const esig = zones.join(',') + '|' + [...active].join(',');
        if (esig !== this._expSig) {
            this._expSig = esig; this._expLabels = [];
            if (!this._expGroup) { this._expGroup = new THREE.Group(); this.scene.add(this._expGroup); }
            this._clearGroup(this._expGroup);
            const icons = { deep_forest: '🌲', ancient_ruins: '🏛', abandoned_mine: '⛏', mountain_pass: '⛰', riverside_cave: '🕳', cursed_swamp: '🌿' };
            const names = { deep_forest: '幽深森林', ancient_ruins: '古代遺跡', abandoned_mine: '廢棄礦坑', mountain_pass: '山間隘口', riverside_cave: '河畔洞窟', cursed_swamp: '詛咒沼澤' };
            const spots = [[2, 2], [this.cols - 4, 2], [2, this.rows - 3], [this.cols - 4, this.rows - 3], [Math.floor(this.cols / 2), 1], [Math.floor(this.cols / 2), this.rows - 2]];
            zones.forEach((zid, i) => {
                if (i >= spots.length) return;
                const [x, z] = spots[i], gy = this.groundY(x + 0.5, z + 0.5), isA = active.has(zid);
                this._box(0.1, 2.2, 0.1, '#7A4E2E', x + 0.5, gy + 1.1, z + 0.5, this._expGroup);
                this._box(0.9, 0.5, 0.05, isA ? '#FFB300' : '#8FB8E8', x + 0.95, gy + 1.9, z + 0.5, this._expGroup);
                this._expLabels.push({ key: 'exp:' + zid, x: x + 0.5, y: gy + 2.6, z: z + 0.5, cls: 't3d-label t3d-mini' + (isA ? ' is-active' : ''), html: `<span class="t3d-name">${icons[zid] || '?'} ${this._esc(t3(names[zid] || zid))}</span>` });
            });
        }
        // 節慶:廣場彩旗
        const fest = this.festivalData?.activeFestival;
        const fid = fest ? (fest.id || fest.name || 'f') : '';
        if (fid !== this._festId) {
            this._festId = fid;
            if (!this._festGroup) { this._festGroup = new THREE.Group(); this.scene.add(this._festGroup); }
            this._clearGroup(this._festGroup); this._festLabel = null;
            const sq = this.buildingZones['town_square'] || this.natureZones['town_square'];
            if (fest && sq) {
                const cols = ['#FFD54F', '#FF69B4', '#00CED1', '#FF6347', '#98FB98'];
                const corners = [[sq.x, sq.y], [sq.x + sq.w, sq.y], [sq.x + sq.w, sq.y + sq.h], [sq.x, sq.y + sq.h]];
                for (const [cx, cz] of corners) this._box(0.12, 2.6, 0.12, '#7A4E2E', cx, 1.3, cz, this._festGroup);
                for (let e = 0; e < 4; e++) {
                    const [x0, z0] = corners[e], [x1, z1] = corners[(e + 1) % 4], n = Math.max(3, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.1));
                    for (let k = 1; k < n; k++) { const tt = k / n, sag = Math.sin(tt * Math.PI) * 0.35; const fl = this._box(0.32, 0.4, 0.04, cols[(e * 7 + k) % cols.length], x0 + (x1 - x0) * tt, 2.4 - sag, z0 + (z1 - z0) * tt, this._festGroup); fl.rotation.y = (e % 2) ? 0 : Math.PI / 2; }
                }
                this._festLabel = { key: 'fest', x: sq.x + sq.w / 2, y: 3.6, z: sq.y + sq.h / 2, cls: 't3d-label t3d-fest', html: `<span class="t3d-name">${this._esc(fest.icon || '🎉')} ${this._esc(t3(fest.name || ''))}</span>` };
            }
        }
        this._industryData = extraData?.industry || null;
    }
    _industryLabels() {
        const out = []; const inds = this._industryData?.industries; if (!inds) return out;
        const LOC = { lumber: 'workshop', quarry: 'workshop', farming: 'farm', mining: 'workshop' };
        let idx = 0;
        for (const [key, ind] of Object.entries(inds)) {
            const z = this.buildingZones[LOC[key] || 'town_square'] || this.natureZones[LOC[key] || 'town_square']; if (!z) continue;
            const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[key] : null; if (!def) continue;
            out.push({ key: 'ind:' + key, x: z.x + 0.8 + idx * 1.8, y: (this._buildingTops?.[LOC[key]] ?? 1.2) + 0.1, z: z.y + z.h, cls: 't3d-label t3d-mini t3d-ind' + (ind.level >= 4 ? ' lv4' : ind.level >= 2 ? ' lv2' : ''), html: `<span class="t3d-name">${this._esc(def.icon || '')}Lv${ind.level}</span>` });
            idx++;
        }
        return out;
    }
    // 商隊進城動畫(showCaravan 由 app 呼叫)
    // v6.34.1 只有一台馬車:之前另外造一台複製品從站裡開到廣場再消失,站裡那台還停著,動畫期間鎮上有兩台。
    // 現在讓站裡那台自己動:從靠近馬車站的地圖邊緣開進來、停回站裡原位(帶著「某某的商隊」小標籤)。
    _updateCaravan() {
        const an = this._caravanAnim, g = this._coach;
        if (this._caravanMesh) { this.scene.remove(this._caravanMesh); this._caravanMesh = null; } // 舊的複製品(讀檔／重建殘留)
        if (!an || !g) { if (g && this._coachHome) { g.position.x = this._coachHome.x; g.position.z = this._coachHome.z; g.rotation.y = 0; this._coachHome = null; } this._caravanLabel = null; if (an && !g) this._caravanAnim = null; return; }
        const DUR = 520, el = this.animFrame - an.t0;
        if (!this._coachHome) this._coachHome = { x: g.position.x, z: g.position.z };
        const home = this._coachHome;
        if (el > DUR) { this._caravanAnim = null; g.position.x = home.x; g.position.z = home.z; g.rotation.y = 0; this._coachHome = null; this._caravanLabel = null; return; }
        const fromRight = home.x > this.cols / 2; const startX = fromRight ? this.cols + 5 : -5;
        const p = Math.min(1, el / (DUR * 0.6)), ease = 1 - Math.pow(1 - p, 2);
        const x = startX + (home.x - startX) * ease;
        g.position.x = x; g.position.z = home.z; g.rotation.y = fromRight ? 0 : Math.PI; // 馬頭朝前進方向(站在右邊就往左開)
        this._caravanLabel = an.label ? { key: 'carav', x, y: 2.6, z: home.z, cls: 't3d-label t3d-mini', html: `<span class="t3d-name">${this._esc(an.label)}</span>` } : null;
    }
    // 效能自動降級:連續 3 秒平均幀長 > 40ms → 關陰影、降解析度
    _updateQuality(now) {
        if (this.lowQuality || this.lockQuality || !this.renderer) return;
        // v6.43.3 剛建好場景、分頁在背景時不算(載入與 JIT 那幾秒本來就慢);要連續兩段 3 秒都太慢才降級
        if (document.hidden || now - (this._sceneBuiltAt || 0) < 8000) { this._qt0 = 0; return; }
        if (!this._qt0) { this._qt0 = now; this._qn = 0; return; }
        this._qn++;
        if (now - this._qt0 >= 3000) {
            const avg = (now - this._qt0) / this._qn;
            this._qBad = (avg > 40 && this._qn > 20) ? (this._qBad || 0) + 1 : 0;
            if (this._qBad >= 2) this.setLowQuality(true, true);
            this._qt0 = now; this._qn = 0;
        }
    }
    setLowQuality(on, auto = false) {
        const wasLite = this._lite();
        this.lowQuality = !!on;
        if (!this.renderer) return;
        if (wasLite !== this._lite() && this.grid && this._sceneSrc) { try { this._buildScene(); } catch (e) { console.warn('[Town3D] rebuild on quality change', e); } } // v6.43.0 細節等級跟著換
        this.renderer.shadowMap.enabled = !on && !this.isMobile;
        this.sun.castShadow = !on && !this.isMobile;
        this._dpr = this._targetDpr();
        this.renderer.setPixelRatio(this._dpr); this._needsResize = true;
        this.scene.traverse((o) => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
        if (!auto) { try { localStorage.setItem('rimtown_3d_quality', on ? 'low' : 'high'); localStorage.setItem('rimtown_3d_q_by', 'user'); } catch (e) {} } // v6.43.3 自動降級只在這次有效,不寫進設定
        console.log('[Town3D] quality', on ? 'low' : 'high', auto ? '(auto)' : '');
    }

    // ---------- 主渲染 ----------
    generateLayout(locations, theme) {
        super.generateLayout(locations, theme);
        this.themeKey = theme || "frontier";
        this._sceneSrc = null;
        this.target.set(this.cols / 2, 0, this.rows / 2); this._focusTo = null;
    }
    render(agents, selectedAgent, playerLoc, completedBuildings, extraData) {
        this._checkResize();
        if (!this.renderer || !this.grid || !this._viewW || this._ctxLost) return;
        if (this.lowQuality && (this._halfTick = !this._halfTick)) return; // v6.33.0 低畫質:3D 只畫 30fps(村民移動由 updateAgents 每幀算,不受影響)
        this.animFrame++;
        const styleSig = (this.tierLv || 0) + '|' + (this.eraStyle ?? 1) + '|' + (this.houseVer || 0); // v6.57.0 等級／時代／翻修有變就重建
        if (this._sceneSrc !== this.grid || this._sceneSeason !== (this.season || '') || this._styleSig !== styleSig) { this._styleSig = styleSig; this._buildScene(); }
        this._syncDynamic(completedBuildings);
        this._syncExtras(extraData);
        this._syncLandmarks(); // v6.47.0 村民提案立的地標
        this._updateCamera();
        this._updateLighting();
        this._updateWater();
        this._updateParticles();
        try { this._updateFireflies(); } catch (e) {} // v6.54.0
        this._updateCaravan();
        this._updateAgents3D(agents || {}, selectedAgent);
        try { this._mergeDynamicGroups(); } catch (e) { console.warn('[Town3D] merge', e); }
        try { this._updatePets3D(extraData?.pets || []); } catch (e) {} // v6.51.0 寵物與動物
        this.renderer.render(this.scene, this.camera);
        const ovEvery = this.lowQuality ? 3 : this.isMobile ? 2 : 1; // v6.28.0 手機隔幀、低畫質每三幀更新標籤層(DOM 寫入是手機 CPU 大頭)
        // v6.43.3 鏡頭在動(拖曳、縮放、跟拍、閒置環繞)時每幀都更新:以前標籤跟不上畫面,一頓一頓的;鏡頭靜止才省著更新
        const ce = this.camera.matrixWorld.elements; const camSig = ce[12] * 7.1 + ce[13] * 3.3 + ce[14] * 1.7 + ce[0] * 11.3 + ce[2] * 5.9 + ce[8] * 2.3 + (this.camera.zoom || 1);
        const camMoved = this._ovCamSig === undefined || Math.abs(camSig - this._ovCamSig) > 1e-4;
        if (camMoved || this.animFrame % ovEvery === 0) { this._ovCamSig = camSig; this._updateOverlays(agents || {}, selectedAgent); }
        this._updateQuality(performance.now());
    }
    // 2D 專用的即時重繪入口在 3D 不需要;保留以免外部呼叫報錯
    _buildStaticLayer() {} _postProcessArt() {} _drawSitePreview() {}
}

window.Town3D = Town3D;
})();

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
        try { this.lowQuality = localStorage.getItem('rimtown_3d_quality') === 'low'; } catch (e) { this.lowQuality = false; }
        if (this.lowQuality) this._dpr = 1;
        // 軌道相機:看向 target(地圖座標,1 格 = 1 單位),yaw/pitch/dist
        this.target = new THREE.Vector3(this.cols / 2, 0, this.rows / 2);
        this.yaw = -0.45; this.pitch = 0.95; this.dist = this.isMobile ? 58 : 50;
        this.minPitch = 0.38; this.maxPitch = 1.35; this.minDist = 9; this.maxDist = 95;

        try {
            this.renderer = new THREE.WebGLRenderer({ canvas: this.glCanvas, antialias: !this.isMobile && !this.lowQuality, alpha: false, powerPreference: 'high-performance' });
        } catch (e) { console.warn('[Town3D] WebGL 初始化失敗', e); this.renderer = null; return; }
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
        this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.03;
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

    _checkResize() {
        const parent = this.glCanvas?.parentElement;
        if (!parent || !this.renderer) return;
        const rect = parent.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        if (w < 1 || h < 1) { this._needsResize = true; return; }
        const dpr = this.lowQuality ? 1 : Math.min(window.devicePixelRatio || 1, 2);
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
        if (this._focusTo) {
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
    focusMap(px, py, dist) { this._focusTo = { x: px / TILE, z: py / TILE, dist: dist || null }; }
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
            ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
            this.followPlayer = false; this._focusTo = null;
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
            e.preventDefault();
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
        super._handleTap(clientX, clientY);
    }

    // ---------- 材質 / 幾何快取 ----------
    _mat(hex, opts) {
        const key = hex + (opts ? JSON.stringify(opts) : '');
        if (!this._mats[key]) this._mats[key] = new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(hex) }, opts || {}));
        return this._mats[key];
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
        let hex = GROUND_COLORS[tile];
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
            // 兩個三角形(非索引 → 平面著色)
            push(pos, x, y00, z); push(pos, x, y01, z + 1); push(pos, x + 1, y10, z);
            push(pos, x + 1, y10, z); push(pos, x, y01, z + 1); push(pos, x + 1, y11, z + 1);
            const c = this._groundColor(this._isWaterLike(tile) ? T.WATER : tile, x, z);
            for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
            if (this._isWaterLike(tile)) {
                const wy = -0.22;
                push(wpos, x, wy, z); push(wpos, x, wy, z + 1); push(wpos, x + 1, wy, z);
                push(wpos, x + 1, wy, z); push(wpos, x, wy, z + 1); push(wpos, x + 1, wy, z + 1);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
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
    _instanced(geo, hex, count, flat) {
        const m = new THREE.InstancedMesh(geo, this._mat(hex, flat ? null : null), Math.max(1, count));
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
            const trunks = this._instanced(this._geo('trunk', () => new THREE.CylinderGeometry(0.12, 0.17, 1, 6)), '#7A4E2E', nTree);
            const blobs = this._instanced(this._geo('blob', () => new THREE.IcosahedronGeometry(1, 0)), '#ffffff', Math.max(1, lists.tree.length));
            const cones = this._instanced(this._geo('cone6', () => new THREE.ConeGeometry(1, 1, 6)), '#ffffff', Math.max(1, lists.pine.length * 2));
            for (const t of lists.tree) {
                const ox = (hash2(t.x, t.z, 21) - 0.5) * 0.5, oz = (hash2(t.x, t.z, 22) - 0.5) * 0.5;
                const gx = t.x + 0.5 + ox, gz = t.z + 0.5 + oz, gy = this.groundY(gx, gz);
                const s = 0.85 + t.r * 0.5, th = 0.7 * s;
                this._addInst(trunks, gx, gy + th / 2, gz, 1, th, 1);
                this._addInst(blobs, gx, gy + th + 0.55 * s, gz, 0.62 * s, 0.7 * s, 0.62 * s, t.r * 6.28, canopyCol(t.r, false));
            }
            for (const t of lists.pine) {
                const ox = (hash2(t.x, t.z, 21) - 0.5) * 0.5, oz = (hash2(t.x, t.z, 22) - 0.5) * 0.5;
                const gx = t.x + 0.5 + ox, gz = t.z + 0.5 + oz, gy = this.groundY(gx, gz);
                const s = 0.9 + t.r * 0.5, th = 0.5 * s;
                this._addInst(trunks, gx, gy + th / 2, gz, 1, th, 1);
                const c = canopyCol(t.r, true);
                this._addInst(cones, gx, gy + th + 0.6 * s, gz, 0.58 * s, 1.2 * s, 0.58 * s, t.r * 3, c);
                this._addInst(cones, gx, gy + th + 1.15 * s, gz, 0.42 * s, 0.9 * s, 0.42 * s, t.r * 3 + 0.5, c);
            }
            trunks.instanceMatrix.needsUpdate = true; blobs.instanceMatrix.needsUpdate = true; cones.instanceMatrix.needsUpdate = true;
            if (blobs.instanceColor) blobs.instanceColor.needsUpdate = true; if (cones.instanceColor) cones.instanceColor.needsUpdate = true;
        }
        if (lists.bush.length) {
            const m = this._instanced(this._geo('blob', () => new THREE.IcosahedronGeometry(1, 0)), '#ffffff', lists.bush.length);
            for (const b of lists.bush) { const s = 0.3 + b.r * 0.18; this._addInst(m, b.x + 0.5, this.groundY(b.x + 0.5, b.z + 0.5) + s * 0.6, b.z + 0.5, s * 1.2, s, s * 1.2, b.r * 6, canopyCol(b.r * 0.9, false)); }
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
        const roofs = ROOF_PALETTE[theme] || ROOF_PALETTE.frontier;
        this._buildingTops = {};
        for (const [locId, z] of Object.entries(this.buildingZones)) {
            if (z.doorPixelX === undefined) continue; // 住宅區父層、農田、礦場、廣場等不是盒子建築
            const h = hash32(locId);
            const tmpl = LOCATION_BUILDING[locId] || (z.parentLocId ? 'house' : 'house');
            const w = z.w, d = z.h; // 範圍含屋頂列,當作完整腳印
            const cx = z.x + w / 2, cz = z.y + d / 2;
            const big = w * d >= 30;
            const wallH = tmpl === 'house' ? 1.5 + (h % 3) * 0.15 : big ? 2.4 : 2.0;
            const wall = WALL_PALETTE[h % WALL_PALETTE.length];
            const roof = roofs[(h >>> 4) % roofs.length];
            const g = new THREE.Group(); g.position.set(cx, 0, cz); this._static.add(g);
            this._box(w, wallH + 0.3, d, wall, 0, wallH / 2 - 0.15, 0, g);
            // 屋頂:四角錐(矩形底)+ 屋簷
            const roofH = tmpl === 'chapel' ? 1.8 : big ? 1.3 : 1.0;
            const r = this._cone(1, roofH, 4, roof, 0, wallH + roofH / 2, 0, g); r.rotation.y = Math.PI / 4; r.scale.set((w + 0.5) * 0.707, roofH, (d + 0.5) * 0.707);
            this._box(w + 0.5, 0.12, d + 0.5, roof, 0, wallH + 0.02, 0, g);
            // 門(在 +z 面,對齊 doorPixelX)
            const doorX = z.doorPixelX / TILE - cx;
            this._box(0.8, 1.35, 0.1, '#6B4A2E', doorX, 0.67, d / 2 + 0.02, g);
            // 窗戶(夜間發光)
            const winMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#9CC8E8'), emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0 });
            this._winMats.push(winMat);
            const winGeo = this._geo('box', () => new THREE.BoxGeometry(1, 1, 1));
            const addWin = (x, y, zz, rot) => { const m = new THREE.Mesh(winGeo, winMat); m.scale.set(0.42, 0.42, 0.08); m.position.set(x, y, zz); m.rotation.y = rot; g.add(m); };
            const wy = wallH * 0.62;
            for (let i = 0; i < Math.max(1, Math.floor(w / 2)); i++) {
                const wx = -w / 2 + 1 + i * 2 + (w % 2 === 0 ? 0 : 0.5);
                if (Math.abs(wx - doorX) > 0.7) addWin(wx, wy, d / 2 + 0.02, 0);
                addWin(wx, wy, -d / 2 - 0.02, 0);
            }
            for (let i = 0; i < Math.max(1, Math.floor(d / 2)); i++) { const wz = -d / 2 + 1 + i * 2; addWin(w / 2 + 0.02, wy, wz, Math.PI / 2); addWin(-w / 2 - 0.02, wy, wz, Math.PI / 2); }
            // 煙囪 / 尖塔 / 招牌等職業特徵
            if (tmpl === 'workshop' || tmpl === 'tavern' || (tmpl === 'house' && h % 3 === 0)) {
                const ch = this._box(0.4, 0.9, 0.4, '#8A6A5A', -w / 2 + 0.8, wallH + roofH * 0.6, -d / 2 + 0.8, g);
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
            const g = new THREE.Group(); g.position.set(gx, 0, gz + 0.2); this._static.add(g); this._coach = g;
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
                const g = new THREE.Group(); g.position.set(b.x + 0.5, -0.15, b.y + 0.5); g.rotation.y = b.phase; this._static.add(g);
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
        this._dyn.clear(); this._dynLabels = [];
        const PLACE = { watchtower: ['guardpost', -2, -2], granary: ['farm', 8, -1], marketplace: ['town_square', 9, -1], well_upgrade: ['well', 0, -1], training_ground: ['guardpost', 7, 0], brewery: ['tavern', -3, -1], garden: ['clinic', -3, -1], school: ['library', -3, 0], farm_irrigation: ['farm', -2, 5], forge_bellows: ['workshop', -3, -1], clinic_upgrade: ['clinic', 6, -1], town_walls: ['town_square', -5, -3] };
        const ICON_COL = { watchtower: '#6B6F78', granary: '#D2B23D', marketplace: '#C9533D', well_upgrade: '#4FB0E6', training_ground: '#8C5A3C', brewery: '#A85A3A', garden: '#5DB867', school: '#4F6F93', farm_irrigation: '#4FB0E6', forge_bellows: '#6B6F78', clinic_upgrade: '#E8E8F0', town_walls: '#9AA0A6' };
        for (const b of cb) {
            const key = b.buildingKey || b.key; let tx, tz, size = 1;
            if (Number.isFinite(b.siteX)) { tx = b.siteX; tz = b.siteY; size = 2; }
            else { const p = PLACE[key]; if (!p) continue; const z = this.buildingZones[p[0]] || this.natureZones[p[0]]; if (!z) continue; tx = z.x + p[1]; tz = z.y + p[2]; }
            const cx = tx + size / 2, cz = tz + size / 2, gy = this.groundY(cx, cz);
            const col = ICON_COL[key] || '#C9A98A';
            const g = new THREE.Group(); g.position.set(cx, gy, cz); this._dyn.add(g);
            this._box(size, 0.15, size, '#B9B3A8', 0, 0.07, 0, g);
            if (key === 'watchtower') { this._box(0.8, 2.6, 0.8, '#A8825A', 0, 1.3, 0, g); this._cone(0.8, 0.5, 4, col, 0, 2.85, 0, g).rotation.y = Math.PI / 4; }
            else if (key === 'town_walls') { this._box(size * 1.4, 1.2, 0.4, col, 0, 0.6, 0, g); }
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
        if (!this.renderer || !this.grid) return;
        this._sceneSrc = this.grid; this._sceneSeason = this.season || '';
        this._static.traverse((o) => { if (o.isMesh && o.geometry && !Object.values(this._geos).includes(o.geometry)) o.geometry.dispose(); });
        this._static.clear(); this._waterMeshes = []; this._winMats = []; this._glowMats = []; this._boatMeshes = null; this._flame = null; this._chimneyTops = null;
        this._buildTerrain();
        this._buildVegetation();
        this._buildBuildings();
        this._buildProps();
        this._dynSig = null;
        this._buildLabelIndex();
        console.log('[Town3D] scene built:', this._static.children.length, 'nodes');
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
        const skyDay = new THREE.Color('#BDE3F7'), skyNight = new THREE.Color('#1C2742'), skyDusk = new THREE.Color('#F2B48A');
        const sky = skyDay.clone().lerp(skyNight, night).lerp(skyDusk, dusk * 0.55);
        const wt = this.weatherType || 'clear';
        if (wt === 'rain' || wt === 'storm') sky.lerp(new THREE.Color('#8E99A6'), 0.55);
        else if (wt === 'snow') sky.lerp(new THREE.Color('#DDE6EE'), 0.5);
        else if (wt === 'fog') sky.lerp(new THREE.Color('#C9CFD6'), 0.6);
        this.scene.background.copy(sky); this.scene.fog.color.copy(sky);
        this.scene.fog.density = (wt === 'fog' ? 0.016 : wt === 'rain' || wt === 'storm' ? 0.009 : 0.006) + night * 0.002;
        if (night < 1) {
            this.sun.position.set(cx + Math.cos(sunAng) * 90, Math.max(8, Math.sin(sunAng) * 90), cz + 40);
        } else {
            this.sun.position.set(cx - 40, 70, cz + 30);
        }
        const sunCol = new THREE.Color('#FFF4DC').lerp(new THREE.Color('#FFB26B'), dusk * 0.8).lerp(new THREE.Color('#9FB2E6'), night);
        this.sun.color.copy(sunCol);
        this.sun.intensity = lerp(1.7, 0.75, night) * (wt === 'rain' || wt === 'storm' ? 0.55 : 1);
        this.hemi.color.copy(new THREE.Color('#CFE9FF').lerp(new THREE.Color('#4A5A8A'), night));
        this.hemi.groundColor.copy(new THREE.Color('#8C7A5A').lerp(new THREE.Color('#2A2638'), night));
        this.hemi.intensity = lerp(0.95, 0.7, night);
        const glow = clamp((night - 0.25) / 0.5, 0, 1);
        for (const m of this._winMats) m.emissiveIntensity = glow * 1.2;
        for (const m of this._glowMats) m.emissiveIntensity = 0.3 + glow * 1.4;
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
    _agentMesh(aid, agent, pos) {
        const jobKey = pos.job || agent.job?.key || 'default';
        const base = JOB_COLORS[jobKey] || JOB_COLORS.default;
        const c = this._variedColors(base, agent.name || aid, jobKey, agent.look || null);
        const sig = jobKey + '|' + lookSig(agent.look) + '|' + (pos.gender || '');
        let m = this._agentMeshes[aid];
        if (m && m.userData.sig === sig) return m;
        if (m) { this._agentGroup.remove(m); }
        m = new THREE.Group(); m.userData = { sig, aid };
        const box = (w, h, d, hex, x, y, z, name) => { const b = this._box(w, h, d, hex, x, y, z, m); b.name = name || ''; return b; };
        const female = (pos.gender || agent.gender) === 'female';
        // 腿、身體、手臂、頭、頭髮、眼睛
        const limb = (w, h, d, hex, x, pivotY, z, name) => { const g = new THREE.Group(); g.position.set(x, pivotY, z); g.name = name; m.add(g); this._box(w, h, d, hex, 0, -h / 2, 0, g); return g; };
        const legL = limb(0.17, 0.36, 0.18, c.pants, -0.11, 0.36, 0, 'legL'), legR = limb(0.17, 0.36, 0.18, c.pants, 0.11, 0.36, 0, 'legR');
        this._box(0.2, 0.1, 0.22, c.boots, 0, -0.31, 0.01, legL); this._box(0.2, 0.1, 0.22, c.boots, 0, -0.31, 0.01, legR);
        box(0.46, 0.5, 0.28, c.body, 0, 0.61, 0, 'body');
        box(0.46, 0.08, 0.3, c.bodyDk, 0, 0.4, 0);
        const armL = limb(0.13, 0.42, 0.14, c.body, -0.3, 0.83, 0, 'armL'), armR = limb(0.13, 0.42, 0.14, c.body, 0.3, 0.83, 0, 'armR');
        this._box(0.11, 0.1, 0.12, c.skin, 0, -0.45, 0, armL); this._box(0.11, 0.1, 0.12, c.skin, 0, -0.45, 0, armR);
        box(0.42, 0.4, 0.4, c.skin, 0, 1.08, 0, 'head');
        const hairStyle = agent.look?.hair ?? (female ? 1 : 0);
        box(0.46, 0.14, 0.44, c.hair, 0, 1.3, 0, 'hair');
        box(0.46, 0.2, 0.1, c.hair, 0, 1.2, -0.17); // 後腦
        if (hairStyle === 1 || hairStyle === 2) box(0.4, 0.45, 0.12, c.hair, 0, 0.98, -0.22); // 長髮/馬尾
        if (hairStyle === 3) box(0.46, 0.12, 0.08, c.hair, 0, 1.2, 0.18); // 齊瀏海
        if (hairStyle === 5) { box(0.52, 0.2, 0.5, c.hair, 0, 1.33, 0); }
        box(0.07, 0.07, 0.03, '#2B2118', -0.1, 1.1, 0.21); box(0.07, 0.07, 0.03, '#2B2118', 0.1, 1.1, 0.21);
        // 職業帽 / 配件
        const acc = agent.look?.acc ?? 0;
        if (acc === 1 || jobKey === 'farmer') { box(0.62, 0.05, 0.62, '#D9B36B', 0, 1.36, 0); box(0.4, 0.16, 0.4, '#D9B36B', 0, 1.45, 0); }
        else if (jobKey === 'guard') box(0.46, 0.16, 0.46, '#90A4AE', 0, 1.4, 0);
        else if (jobKey === 'miner') { box(0.46, 0.16, 0.46, '#D2B23D', 0, 1.4, 0); const l = box(0.12, 0.1, 0.06, '#FFE9A8', 0, 1.4, 0.24); l.material = this._mat('#FFE9A8', { emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0.6 }); }
        else if (jobKey === 'cook') box(0.4, 0.26, 0.4, '#FFFFFF', 0, 1.46, 0);
        else if (jobKey === 'mayor') { box(0.4, 0.08, 0.4, '#FFD700', 0, 1.36, 0); }
        else if (jobKey === 'doctor') box(0.5, 0.06, 0.5, '#FFFFFF', 0, 1.36, 0);
        else if (jobKey === 'priest') box(0.3, 0.3, 0.3, '#F0E070', 0, 1.46, 0);
        if (acc === 2) { box(0.14, 0.1, 0.03, '#2B2118', -0.1, 1.1, 0.22); box(0.14, 0.1, 0.03, '#2B2118', 0.1, 1.1, 0.22); }
        if (acc === 3) box(0.5, 0.12, 0.34, c.accent, 0, 0.86, 0.02);
        if (jobKey === 'blacksmith') box(0.3, 0.42, 0.04, '#5A4A3A', 0, 0.6, 0.15);
        const tool = new THREE.Group(); tool.name = 'tool'; tool.visible = false; tool.position.set(0, -0.45, 0.12); armR.add(tool);
        this._box(0.06, 0.95, 0.06, '#8B6914', 0, 0.2, 0, tool); this._box(0.22, 0.06, 0.08, '#8A8A8A', 0, 0.66, 0.04, tool);
        m.userData.tool = tool;
        if (jobKey === 'trader') box(0.2, 0.22, 0.16, '#8C5A3C', 0.34, 0.5, 0);
        m.scale.setScalar(1.3);
        this._agentGroup.add(m); this._agentMeshes[aid] = m;
        return m;
    }
    _updateAgents3D(agents, selectedAgent) {
        const seen = new Set();
        for (const [aid, pos] of Object.entries(this.agentPositions)) {
            const agent = agents[aid]; if (!agent) continue;
            if (aid === 'player' && this.hidePlayer) continue;
            seen.add(aid);
            const m = this._agentMesh(aid, agent, pos);
            const wx = pos.x / TILE, wz = pos.y / TILE;
            const inside = this._isInsideBuilding(pos.x, pos.y);
            const hidden = !!(inside && this.buildingZones[inside] && this.buildingZones[inside].doorPixelX !== undefined);
            m.visible = !hidden; m.userData.hidden = hidden;
            if (hidden) continue;
            const gy = this.groundY(wx, wz);
            const walking = pos.walking;
            const ws = walking ? Math.sin((pos.walkStep || 0) * 0.45) : 0;
            m.position.set(wx, gy + (walking ? Math.abs(ws) * 0.04 : 0), wz);
            const dir = pos.dir4 === 'side' ? ((pos.facing || 1) > 0 ? 'right' : 'left') : (pos.dir4 || 'down');
            const rot = dir === 'down' ? 0 : dir === 'up' ? Math.PI : dir === 'right' ? Math.PI / 2 : -Math.PI / 2;
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
        for (const aid of Object.keys(this._agentMeshes)) if (!seen.has(aid)) { this._agentGroup.remove(this._agentMeshes[aid]); delete this._agentMeshes[aid]; }
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
        el.style.display = '';
        el.style.transform = `translate(-50%,-100%) translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) scale(${s.toFixed(3)})`;
        el.style.zIndex = String(Math.round(1000 - p.d));
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
            if (!el._bound) { el._bound = true; el.addEventListener('click', (e) => { e.stopPropagation(); this.focusLocation(locId); if (this.onClick) this.onClick(locId); }); }
            this._place(el, cx, top + 0.3, cz);
        }
        const extraLabels = [].concat(this._dynLabels || [], this._factLabels || [], this._expLabels || [], this._industryLabels(), this._graveLabel ? [this._graveLabel] : [], this._festLabel ? [this._festLabel] : [], this._caravanLabel ? [this._caravanLabel] : []);
        for (const d of extraLabels) { const el = this._ov(d.key, d.cls, d.html); this._place(el, d.x, d.y, d.z); }
        // 村民名牌、表情、睡眠
        const shownBubble = new Set();
        const convos = (this._activeConvoBubbles || []).filter(c => now < c.expiry);
        this._activeConvoBubbles = convos;
        for (const [aid, pos] of Object.entries(this.agentPositions)) {
            const agent = agents[aid]; const m = this._agentMeshes[aid];
            if (!agent || !m || !m.visible) continue;
            const wx = pos.x / TILE, wz = pos.y / TILE, gy = m.position.y;
            const isSel = aid === selectedAgent;
            const emote = this.agentEmotes?.[aid];
            const sleeping = agent.activity === 'sleeping';
            const extra = sleeping ? ' <i class="t3d-zzz">z z z</i>' : emote ? ` <i class="t3d-emo">${emote}</i>` : '';
            const el = this._ov('ag:' + aid, 't3d-tag' + (isSel ? ' is-sel' : '') + (aid === 'player' ? ' is-player' : ''), `${this._esc(t3(agent.name || aid))}${extra}`);
            this._place(el, wx, gy + 2.15, wz);
            if (!el._bound) { el._bound = true; el.addEventListener('click', (e) => { e.stopPropagation(); if (this.onAgentClick) this.onAgentClick(aid); }); }
        }
        // 對話泡泡
        for (const c of convos) for (const b of c.bubbles) {
            if (shownBubble.has(b.agentId)) continue;
            const pos = this.agentPositions[b.agentId]; const m = this._agentMeshes[b.agentId];
            if (!pos || !m || !m.visible) continue;
            shownBubble.add(b.agentId);
            const text = String(b.text || '').substring(0, 40);
            const el = this._ov('bb:' + b.agentId, 't3d-bubble', `<b>${this._esc(t3(b.speaker || ''))}</b>${this._esc(t3(text))}`);
            this._place(el, pos.x / TILE, m.position.y + 2.5, pos.y / TILE);
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
            rain: mk(this.lowQuality ? 500 : 1400, new THREE.LineBasicMaterial({ color: new THREE.Color('#BFD6F2'), transparent: true, opacity: 0.45 }), true),
            snow: mk(this.lowQuality ? 400 : 1000, new THREE.PointsMaterial({ color: new THREE.Color('#FFFFFF'), size: 0.18, transparent: true, opacity: 0.9, depthWrite: false })),
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
    }
    _fxSpawn(type, p) { const f = this._fx[type]; if (f.list.length < f.cap) f.list.push(p); }
    _updateParticles() {
        this._fxInit();
        const f = this._fx, frame = this.animFrame, night = this._nightAmount();
        const tx = this.target.x, tz = this.target.z, R = Math.min(30, this.dist * 0.8);
        const wt = this.weatherType || 'clear';
        const heavy = wt === 'storm' || wt === 'blizzard';
        const q = this.lowQuality ? 0.45 : 1;
        if (wt === 'rain' || wt === 'storm') for (let i = 0; i < Math.round((heavy ? 26 : 14) * q); i++) this._fxSpawn('rain', { x: tx + (Math.random() - 0.5) * R * 2, y: 10 + Math.random() * 8, z: tz + (Math.random() - 0.5) * R * 2, vx: heavy ? 0.12 : 0.03, vy: -0.55 - Math.random() * 0.2, vz: 0, life: 60 });
        if (wt === 'snow' || wt === 'blizzard') for (let i = 0; i < Math.round((heavy ? 12 : 5) * q); i++) this._fxSpawn('snow', { x: tx + (Math.random() - 0.5) * R * 2, y: 9 + Math.random() * 6, z: tz + (Math.random() - 0.5) * R * 2, vx: heavy ? 0.06 : 0.01, vy: -0.06 - Math.random() * 0.04, vz: 0, life: 400, ph: Math.random() * 6.28 });
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
                if (type === 'rain') { arr[n * 6] = p.x; arr[n * 6 + 1] = p.y; arr[n * 6 + 2] = p.z; arr[n * 6 + 3] = p.x - p.vx * 1.2; arr[n * 6 + 4] = p.y - p.vy * 1.2; arr[n * 6 + 5] = p.z; }
                else { arr[n * 3] = p.x; arr[n * 3 + 1] = p.y; arr[n * 3 + 2] = p.z; }
                n++;
            }
            fx.mesh.geometry.setDrawRange(0, type === 'rain' ? n * 2 : n);
            fx.mesh.geometry.attributes.position.needsUpdate = true;
            fx.mesh.visible = n > 0;
        }
        if (f.firefly.mesh.visible) f.firefly.mesh.material.opacity = 0.55 + Math.sin(frame * 0.12) * 0.35;
        if (this._stars) { this._stars.material.opacity = clamp((night - 0.5) * 2, 0, 1) * 0.9; this._stars.visible = this._stars.material.opacity > 0.02; }
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
    _syncExtras(extraData) {
        const farm = extraData?.farm, proc = extraData?.processing;
        const plots = farm?.plots || [];
        const fz = this.buildingZones['farm'] || this.natureZones['farm'];
        const fsig = fz ? plots.map(p => p.state + (p.crop || '') + Math.round((p.growthProgress || 0) * 5)).join(',') : '';
        if (fsig !== this._farmSig) {
            this._farmSig = fsig;
            if (!this._farmGroup) { this._farmGroup = new THREE.Group(); this.scene.add(this._farmGroup); }
            this._farmGroup.clear();
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
            this._factGroup.clear();
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
        if ((graves.length || 0) !== this._graveN) {
            this._graveN = graves.length;
            if (!this._graveGroup) { this._graveGroup = new THREE.Group(); this.scene.add(this._graveGroup); }
            this._graveGroup.clear(); this._graveLabel = null;
            if (graves.length) {
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
            this._expGroup.clear();
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
            this._festGroup.clear(); this._festLabel = null;
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
    _updateCaravan() {
        const an = this._caravanAnim;
        if (!an) { if (this._caravanMesh) this._caravanMesh.visible = false; return; }
        const DUR = 520, el = this.animFrame - an.t0;
        if (el > DUR) { this._caravanAnim = null; if (this._caravanMesh) this._caravanMesh.visible = false; return; }
        if (!this._caravanMesh) {
            const g = new THREE.Group(); this.scene.add(g); this._caravanMesh = g;
            this._box(1.6, 1.0, 1.0, '#7A5236', 0, 0.85, 0, g); this._box(1.7, 0.1, 1.1, '#C9A86A', 0, 1.4, 0, g);
            this._box(0.5, 0.35, 0.5, '#A1887F', -0.3, 1.6, 0, g); this._box(0.5, 0.3, 0.4, '#8D6E63', 0.35, 1.58, 0.1, g);
            for (const [wx, wz] of [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]]) { const w = this._cyl(0.28, 0.28, 0.12, 8, '#3A2A1A', wx, 0.28, wz, g); w.rotation.x = Math.PI / 2; }
            this._box(1.1, 0.6, 0.5, '#8A6A4A', -1.7, 0.75, 0, g); this._box(0.4, 0.5, 0.4, '#8A6A4A', -2.35, 1.0, 0, g);
            for (const lx of [-1.4, -2.0]) for (const lz of [-0.18, 0.18]) this._box(0.12, 0.5, 0.12, '#6A4A2A', lx, 0.25, lz, g);
        }
        const cs = this.coachStation || { x: this.cols - 7 };
        const startX = cs.x + 2, endX = 41, z = 21.5;
        const p = Math.min(1, el / (DUR * 0.55)), ease = 1 - Math.pow(1 - p, 2);
        const x = startX + (endX - startX) * ease;
        const g = this._caravanMesh; g.visible = el < DUR * 0.9;
        g.position.set(x, this.groundY(x, z) + (p < 1 ? Math.abs(Math.sin(el / 4)) * 0.05 : 0), z);
        g.rotation.y = endX < startX ? 0 : Math.PI;
        this._caravanLabel = an.label && g.visible ? { key: 'carav', x, y: 2.6, z, cls: 't3d-label t3d-mini', html: `<span class="t3d-name">${this._esc(an.label)}</span>` } : null;
    }
    // 效能自動降級:連續 3 秒平均幀長 > 40ms → 關陰影、降解析度
    _updateQuality(now) {
        if (this.lowQuality || !this.renderer) return;
        if (!this._qt0) { this._qt0 = now; this._qn = 0; return; }
        this._qn++;
        if (now - this._qt0 >= 3000) {
            const avg = (now - this._qt0) / this._qn;
            if (avg > 40 && this._qn > 20) this.setLowQuality(true);
            this._qt0 = now; this._qn = 0;
        }
    }
    setLowQuality(on) {
        this.lowQuality = !!on;
        if (!this.renderer) return;
        this.renderer.shadowMap.enabled = !on && !this.isMobile;
        this.sun.castShadow = !on && !this.isMobile;
        this._dpr = on ? 1 : Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.setPixelRatio(this._dpr); this._needsResize = true;
        this.scene.traverse((o) => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
        try { localStorage.setItem('rimtown_3d_quality', on ? 'low' : 'high'); } catch (e) {}
        console.log('[Town3D] quality', on ? 'low' : 'high');
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
        if (!this.renderer || !this.grid || !this._viewW) return;
        this.animFrame++;
        if (this._sceneSrc !== this.grid || this._sceneSeason !== (this.season || '')) this._buildScene();
        this._syncDynamic(completedBuildings);
        this._syncExtras(extraData);
        this._updateCamera();
        this._updateLighting();
        this._updateWater();
        this._updateParticles();
        this._updateCaravan();
        this._updateAgents3D(agents || {}, selectedAgent);
        this.renderer.render(this.scene, this.camera);
        this._updateOverlays(agents || {}, selectedAgent);
        this._updateQuality(performance.now());
    }
    // 2D 專用的即時重繪入口在 3D 不需要;保留以免外部呼叫報錯
    _buildStaticLayer() {} _postProcessArt() {} _drawSitePreview() {}
}

window.Town3D = Town3D;
})();

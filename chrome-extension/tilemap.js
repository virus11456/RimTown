// ============================================================
// RimTown Pixel Art Tile Map Renderer
// ============================================================

const TILE = 16; // tile size in pixels

// Tile type constants
const T = {
    GRASS:0, GRASS2:1, GRASS3:2, DIRT:3, STONE_PATH:4,
    WALL_TOP:5, WALL_FRONT:6, FLOOR:7, FLOOR2:8, DOOR:9,
    WATER:10, WATER2:11, TREE_TRUNK:12, TREE_TOP:13, TREE_TOP2:14,
    ROOF:15, ROOF2:16, FENCE_H:17, FENCE_V:18,
    CROP1:19, CROP2:20, CROP3:21, FLOWER1:22, FLOWER2:23,
    BUSH:24, ROCK:25, BARREL:26, CRATE:27,
    TABLE:28, CHAIR:29, BED:30, ANVIL:31, FURNACE:32,
    COUNTER:33, BOOKSHELF:34, WELL:35, ALTAR:36,
    SAND:37, BRIDGE:38, STALL:39, WEAPON_RACK:40,
    WINDOW:41, DARK_FLOOR:42, RUG:43, CAULDRON:44,
    // v5.75.0 海風鎮海岸主題:棧橋木板、鹽田、曬網架
    PIER:45, SALT:46, NET:47,
    // v5.76.0 礦山鎮:碎石路、裂谷、礦車軌道、雪頂
    GRAVEL:48, CHASM:49, RAIL:50, SNOW:51,
};

// Color palette for each tile [primary, secondary, highlight, accent]
// Vibrant lush style inspired by RPG pixel art tilemaps
const TILE_BUILDING_TEMPLATES = {
    tavern: {
        w:10, h:8, doorX:5, doorY:7,
        tiles: [
            [5,5,5,41,5,5,41,5,5,5],
            [6,8,28,29,7,7,28,29,8,6],
            [6,7,28,29,7,7,28,29,7,6],
            [41,7,7,7,43,7,7,7,7,41],
            [6,33,33,33,33,7,7,7,7,6],
            [6,7,7,7,7,7,26,26,7,6],
            [6,8,7,7,7,7,7,7,8,6],
            [6,6,6,6,6,9,6,6,6,6],
        ]
    },
    clinic: {
        w:8, h:7, doorX:4, doorY:6,
        tiles: [
            [5,5,41,5,5,41,5,5],
            [6,8,30,7,7,30,8,6],
            [6,7,30,7,7,30,7,6],
            [41,7,7,8,8,7,7,41],
            [6,7,28,7,44,7,7,6],
            [6,8,7,7,7,7,8,6],
            [6,6,6,6,9,6,6,6],
        ]
    },
    workshop: {
        w:8, h:7, doorX:4, doorY:6,
        tiles: [
            [5,5,5,41,5,5,5,5],
            [6,7,31,7,7,32,7,6],
            [6,7,7,7,7,7,27,6],
            [41,7,7,28,7,7,27,41],
            [6,7,7,7,7,7,7,6],
            [6,26,7,7,7,7,26,6],
            [6,6,6,6,9,6,6,6],
        ]
    },
    house: {
        w:6, h:5, doorX:3, doorY:4,
        tiles: [
            [5,5,41,5,5,5],
            [6,8,30,7,8,6],
            [6,7,7,7,28,6],
            [6,7,7,29,7,6],
            [6,6,6,9,6,6],
        ]
    },
    general_store: {
        w:8, h:7, doorX:4, doorY:6,
        tiles: [
            [5,5,5,41,5,5,5,5],
            [6,39,39,7,7,39,39,6],
            [6,7,7,7,7,7,7,6],
            [41,27,27,7,7,27,27,41],
            [6,7,7,7,7,7,7,6],
            [6,26,7,7,7,7,26,6],
            [6,6,6,6,9,6,6,6],
        ]
    },
    farm_building: {
        w:6, h:4, doorX:3, doorY:3,
        tiles: [
            [5,5,5,5,5,5],
            [6,7,26,27,7,6],
            [6,7,7,7,7,6],
            [6,6,6,9,6,6],
        ]
    },
    guardpost: {
        w:6, h:5, doorX:3, doorY:4,
        tiles: [
            [5,5,5,5,5,5],
            [6,7,40,40,7,6],
            [6,7,7,7,7,6],
            [6,7,28,7,29,6],
            [6,6,6,9,6,6],
        ]
    },
    chapel: {
        w:8, h:7, doorX:4, doorY:6,
        tiles: [
            [5,5,5,41,41,5,5,5],
            [6,7,7,36,36,7,7,6],
            [6,7,7,7,7,7,7,6],
            [41,7,29,43,43,29,7,41],
            [6,7,29,7,7,29,7,6],
            [6,7,7,43,43,7,7,6],
            [6,6,6,6,9,6,6,6],
        ]
    },
    library: {
        w:8, h:6, doorX:4, doorY:5,
        tiles: [
            [5,5,41,5,5,41,5,5],
            [6,34,34,7,7,34,34,6],
            [6,7,7,8,8,7,7,6],
            [41,7,28,29,28,29,7,41],
            [6,8,7,7,7,7,8,6],
            [6,6,6,6,9,6,6,6],
        ]
    },
    town_hall: {
        w:9, h:7, doorX:4, doorY:6,
        tiles: [
            [5,5,5,41,5,41,5,5,5],
            [6,8,7,7,7,7,7,8,6],
            [6,7,34,7,43,7,34,7,6],
            [41,7,7,28,28,28,7,7,41],
            [6,7,7,29,43,29,7,7,6],
            [6,8,7,7,7,7,7,8,6],
            [6,6,6,6,9,6,6,6,6],
        ]
    },
};

// Map location IDs to building templates
const LOCATION_BUILDING = {
    tavern: 'tavern',
    clinic: 'clinic',
    workshop: 'workshop',
    general_store: 'general_store',
    guardpost: 'guardpost',
    chapel: 'chapel',
    library: 'library',
    town_hall: 'town_hall',
    farm: 'farm_building',
    quarry: 'farm_building',
    residential_north: 'house',
    residential_south: 'house',
    residential_east: 'house',
};

// v6.98.0 村民自訂外觀常數(LOOK_SKINS／LOOK_HAIR_COLORS／LOOK_SHIRTS／lookSig)與職業配色 JOB_COLORS 搬到 villager3d.js(必須比本檔早載入)


class PixelTileMap {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cols = 80;
        this.rows = 60;
        this.grid = null;
        this.tileCache = {};
        this.agentPositions = {}; // {agentId: {x, y, targetX, targetY}}
        // v4.2.0 礦石鎮式直接操作
        this.playerInput = { x: 0, y: 0 };  // 鍵盤/搖桿方向輸入(-1..1)
        this.followPlayer = false;           // 手動移動時鏡頭跟隨(手動平移會取消)
        this.agentEmotes = {};               // {agentId: emoji} 愛恨糾葛頭上表情
        this.onPlayerMoved = null;           // 手動移動回呼 (x, y)
        this.buildingZones = {}; // {locationId: {x,y,w,h,doorPixelX,doorPixelY}}
        this.natureZones = {};   // {locationId: {x,y,w,h}}
        this.labelPositions = {};
        this.animFrame = 0;
        this.waterFrame = 0;
        this._lastWaterTick = 0;
        this.onClick = null;
        this.onAgentClick = null;
        this.chatTarget = null; // currently active chat target agent ID
        // Ambient particles
        this._particles = [];
        this._particleTimer = 0;
        // Day/night cycle
        this.timeHour = 12;
        this.timeMinute = 0;
        this._setupCanvas();
        // v6.34.0 2D 繪圖層已移除(3D 是唯一畫面;WebGL 不可用時只提示),不再預先畫 2D 貼圖
    }

    _setupCanvas() {
        // Internal map size
        this.mapWidth = this.cols * TILE;
        this.mapHeight = this.rows * TILE;
        // Viewport / camera
        this.camX = 0;
        this.camY = 0;
        this.zoom = 0; // will be set on first resize
        this.minZoom = 1;
        this.maxZoom = 4;
        this._dpr = window.devicePixelRatio || 1;
        this._viewW = 0;
        this._viewH = 0;
        this._needsResize = true;
        // Observe container resize (multiple fallbacks for reliability)
        this._resizeObserver = new ResizeObserver(() => { this._needsResize = true; });
        this._resizeObserver.observe(this.canvas.parentElement);
        window.addEventListener('resize', () => { this._needsResize = true; });
        // --- Interaction: click, pan, pinch-to-zoom ---
        this._setupInteraction();
    }

    // Called at the start of every render frame
    _checkResize() {
        // Measure PARENT container, not canvas — canvas size can feedback-loop
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        if (w < 1 || h < 1) { this._needsResize = true; return; }
        const dpr = window.devicePixelRatio || 1;
        const needsUpdate = this._needsResize || Math.abs(this._viewW - w) > 1 || Math.abs(this._viewH - h) > 1 || dpr !== this._dpr;
        if (!needsUpdate) return;
        this._needsResize = false;
        this._dpr = dpr;
        this._viewW = w;
        this._viewH = h;
        // Set canvas buffer to match display at native resolution
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        // Compute minimum zoom so map covers the viewport (no empty borders)
        const newMinZoom = Math.max(w / this.mapWidth, h / this.mapHeight);
        this.minZoom = newMinZoom;
        // On first init or if zoom is below minimum, set to fit
        if (this.zoom < this.minZoom) this.zoom = this.minZoom;
        // v4.3.6 預設縮放拉近(角色看得清楚):手機 ~2x、桌面 ~1.6x,只在首次套用
        if (!this._initialZoomApplied && this._viewW > 0) {
            this._initialZoomApplied = true;
            const wanted = this._viewW <= 820 ? 2.0 : 1.6;
            this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, wanted));
            this.followPlayer = true;
        }
        this._clampCamera();
    }

    _clampCamera() {
        if (!this._viewW) return;
        // Viewport size in map coordinates
        const vw = this._viewW / this.zoom;
        const vh = this._viewH / this.zoom;
        this.camX = Math.max(0, Math.min(this.camX, this.mapWidth - vw));
        this.camY = Math.max(0, Math.min(this.camY, this.mapHeight - vh));
    }

    // Convert screen (client) coords to map coords
    _screenToMap(sx, sy) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (sx - rect.left) / this.zoom + this.camX;
        const y = (sy - rect.top) / this.zoom + this.camY;
        return { x, y };
    }

    _setupInteraction() {
        let pointers = new Map(); // active pointers for multitouch
        let lastPinchDist = 0;
        let lastPinchCenter = null;
        let isPanning = false;
        let panStartX = 0, panStartY = 0, camStartX = 0, camStartY = 0;
        let tapStart = 0;
        let tapPos = null;
        const TAP_THRESHOLD = 10; // px
        const TAP_TIME = 300; // ms

        // --- Pointer events for unified mouse+touch ---
        this.canvas.addEventListener('pointerdown', (e) => {
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 1) {
                isPanning = true;
                panStartX = e.clientX; panStartY = e.clientY;
                camStartX = this.camX; camStartY = this.camY;
                tapStart = Date.now();
                tapPos = { x: e.clientX, y: e.clientY };
            }
            if (pointers.size === 2) {
                isPanning = false;
                const pts = [...pointers.values()];
                lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
                lastPinchCenter = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            }
            e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('pointermove', (e) => {
            if (!pointers.has(e.pointerId)) return;
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (pointers.size === 1 && isPanning) {
                const dx = (e.clientX - panStartX) / this.zoom;
                const dy = (e.clientY - panStartY) / this.zoom;
                // 手動平移 → 取消鏡頭跟隨(有實際位移才算)
                if (Math.abs(dx) + Math.abs(dy) > 3) this.followPlayer = false;
                this.camX = camStartX - dx;
                this.camY = camStartY - dy;
                this._clampCamera();
            }

            if (pointers.size === 2) {
                const pts = [...pointers.values()];
                const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
                const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

                if (lastPinchDist > 0) {
                    const scale = dist / lastPinchDist;
                    const oldZoom = this.zoom;
                    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * scale));
                    // Zoom toward pinch center
                    const rect = this.canvas.getBoundingClientRect();
                    const cx = (center.x - rect.left) / oldZoom + this.camX;
                    const cy = (center.y - rect.top) / oldZoom + this.camY;
                    this.camX = cx - (center.x - rect.left) / this.zoom;
                    this.camY = cy - (center.y - rect.top) / this.zoom;
                    this._clampCamera();
                }
                lastPinchDist = dist;
                lastPinchCenter = center;
            }
            e.preventDefault();
        }, { passive: false });

        const pointerEnd = (e) => {
            pointers.delete(e.pointerId);
            if (pointers.size < 2) { lastPinchDist = 0; lastPinchCenter = null; }
            if (pointers.size === 0) {
                // Check if this was a tap (short, small movement)
                if (isPanning && tapPos && Date.now() - tapStart < TAP_TIME) {
                    const dx = Math.abs(e.clientX - tapPos.x);
                    const dy = Math.abs(e.clientY - tapPos.y);
                    if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) {
                        this._handleTap(e.clientX, e.clientY);
                    }
                }
                isPanning = false;
                tapPos = null;
            }
        };
        this.canvas.addEventListener('pointerup', pointerEnd);
        this.canvas.addEventListener('pointercancel', pointerEnd);

        // Mouse wheel zoom (desktop)
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const oldZoom = this.zoom;
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * delta));
            // Zoom toward cursor
            const cx = (e.clientX - rect.left) / oldZoom + this.camX;
            const cy = (e.clientY - rect.top) / oldZoom + this.camY;
            this.camX = cx - (e.clientX - rect.left) / this.zoom;
            this.camY = cy - (e.clientY - rect.top) / this.zoom;
            this._clampCamera();
        }, { passive: false });

        // v5.60.0 建築選址模式:滑鼠移動時更新佔地預覽框位置(桌面版)
        this.canvas.addEventListener('pointermove', (e) => {
            if (!this.sitePreview) return;
            this.sitePreview.hoverPx = this._screenToMap(e.clientX, e.clientY);
        });
    }

    _handleTap(clientX, clientY) {
        // v4.8.0 裝飾擺放模式:交給 app 處理原始地圖座標,回傳 true 表示已消費
        if (this.onTapRaw) {
            const m = this._screenToMap(clientX, clientY);
            if (this.onTapRaw(m.x, m.y)) return;
        }
        const { x: px, y: py } = this._screenToMap(clientX, clientY);
        // Check if an agent was tapped
        let closestAgent = null;
        let closestDist = Infinity;
        // When already chatting, use smaller hit area so location clicks are easier
        const baseHitSize = Math.max(16, 24 / this.zoom);
        const hitSize = this.chatTarget ? Math.min(baseHitSize, 12) : baseHitSize;
        for (const [aid, pos] of Object.entries(this.agentPositions)) {
            if (aid === 'player') continue;
            const dx = Math.abs(px - pos.x);
            const dy = Math.abs(py - (pos.y - 8));
            if (dx < hitSize && dy < hitSize) {
                const dist = dx * dx + dy * dy;
                if (dist < closestDist) {
                    closestDist = dist;
                    closestAgent = aid;
                }
            }
        }
        if (closestAgent) {
            if (this.onAgentClick) this.onAgentClick(closestAgent);
            return;
        }
        // v5.57.0 馬車站點擊:開啟跨鎮旅行對話
        if (this.coachStation && this.onCoachClick) {
            const cs = this.coachStation;
            if (px >= cs.x * TILE && px < (cs.x + cs.w) * TILE && py >= cs.y * TILE && py < (cs.y + cs.h) * TILE) {
                this.onCoachClick();
                return;
            }
        }
        // Check location zones — first try exact zone hit, then find nearest
        if (this.onClick) {
            // Exact zone click — prioritize smaller sub-zones (individual houses) over parent zones
            let hitLocId = null;
            let hitZone = null;
            let hitArea = Infinity;
            for (const [locId, zone] of Object.entries(this.buildingZones)) {
                if (px >= zone.x * TILE && px < (zone.x + zone.w) * TILE &&
                    py >= zone.y * TILE && py < (zone.y + zone.h) * TILE) {
                    const area = zone.w * zone.h;
                    if (area < hitArea) {
                        hitArea = area;
                        hitLocId = locId;
                        hitZone = zone;
                    }
                }
            }
            if (hitLocId) {
                this._moveIndicator = { x: px, y: py, expiry: Date.now() + 1500 };
                this._playerClickTarget = { x: px, y: py };
                this.onClick(hitLocId);
                return;
            }
            for (const [locId, zone] of Object.entries(this.natureZones)) {
                if (px >= zone.x * TILE && px < (zone.x + zone.w) * TILE &&
                    py >= zone.y * TILE && py < (zone.y + zone.h) * TILE) {
                    this._moveIndicator = { x: px, y: py, expiry: Date.now() + 1500 };
                    this._playerClickTarget = { x: px, y: py };
                    this.onClick(locId);
                    return;
                }
            }
            // Clicked on empty space — find nearest location and move player there
            // Also set a custom walk target so the player walks to the exact pixel clicked
            let bestLoc = null, bestDist = Infinity;
            const allZones = { ...this.buildingZones, ...this.natureZones };
            for (const [locId, zone] of Object.entries(allZones)) {
                const cx = (zone.x + zone.w / 2) * TILE;
                const cy = (zone.y + zone.h / 2) * TILE;
                const dist = (px - cx) ** 2 + (py - cy) ** 2;
                if (dist < bestDist) { bestDist = dist; bestLoc = locId; }
            }
            if (bestLoc) {
                // Show move indicator at the exact click position
                this._moveIndicator = { x: px, y: py, expiry: Date.now() + 1500 };
                // Set custom walk target for player to walk to exact click position
                this._playerClickTarget = { x: px, y: py };
                this.onClick(bestLoc);
            }
        }
    }

    // v4.5.0:屋頂依建築 hash 配色(4 色)+ 收集夜光窗戶
    _postProcessArt() { } // v6.34.0 2D 繪圖已移除;Town3D 覆寫
    _buildStaticLayer() { } // v6.34.0 2D 繪圖已移除;Town3D 覆寫
    // v6.85.0 每個城鎮都有一塊固定的墓園:版面畫完再找一塊空地(各主題有建議位置,找不到就整張圖掃)
    generateLayout(locations, theme) {
        this._generateLayoutCore(locations, theme);
        try { this._placeGraveyard(); } catch (e) { console.warn('[RimTown] graveyard', e); }
    }
    _placeGraveyard() {
        if (!this.grid || !this.grid.length) return;
        const GW = 8, GH = 5, H = this.grid.length, W = this.grid[0].length;
        const PREF = { frontier: [[50, 3], [4, 3], [14, 3]], harbor: [[56, 3], [60, 3]], mountain: [[48, 22], [4, 51], [29, 41]], forest: [[52, 3], [60, 3]], market: [[50, 3], [40, 3]] };
        const OK = new Set([T.GRASS, T.GRASS2, T.GRASS3, T.FLOWER1, T.FLOWER2, T.BUSH, T.ROCK, T.TREE_TOP, T.TREE_TOP2, T.TREE_TRUNK]);
        const rects = [...Object.values(this.buildingZones || {}), ...Object.values(this.natureZones || {})].map(z => ({ x: z.x, y: z.y, w: z.w || 4, h: z.h || 4 }));
        if (this.coachStation) rects.push(this.coachStation);
        // 舊存檔:避開已經蓋好／施工中的選址建築與裝飾;也避開目前的工廠地基,工廠才不會因為多了墓園而換位置
        for (const b of (this.sitedCompleted || [])) rects.push({ x: b.siteX, y: b.siteY, w: 2, h: 2 });
        for (const p of (this.constructionSites || [])) rects.push({ x: p.siteX, y: p.siteY, w: 2, h: 2 });
        for (const d of (this.decorations || [])) rects.push({ x: d.x, y: d.y, w: 1, h: 1 });
        let plots = []; try { this._factoryPlots = null; plots = (this._getFactoryPlots?.() || []).slice(0, 16); } catch (e) {}
        const hit = (x, y, r, m) => x + GW + m > r.x && x - m < r.x + r.w && y + GH + m > r.y && y - m < r.y + r.h;
        const fits = (x, y) => {
            if (x < 2 || y < (this.themeKey === 'mountain' ? 8 : 3) || x + GW > W - 2 || y + GH > H - 3) return false; // 礦山鎮 0～6 列是山壁
            for (let yy = y; yy < y + GH; yy++) for (let xx = x; xx < x + GW; xx++) if (!OK.has(this.grid[yy][xx])) return false;
            if (rects.some(r => hit(x, y, r, 1))) return false;
            if (plots.some(r => hit(x, y, r, 2))) return false;
            return true;
        };
        let at = null;
        for (const [x, y] of (PREF[this.themeKey] || [])) if (fits(x, y)) { at = [x, y]; break; }
        if (!at) { outer: for (let y = 3; y < H - GH - 3; y++) for (let x = 2; x < W - GW - 2; x++) if (fits(x, y)) { at = [x, y]; break outer; } }
        if (!at) return;
        const [gx, gy] = at;
        for (let yy = gy; yy < gy + GH; yy++) for (let xx = gx; xx < gx + GW; xx++) {
            const edgeX = xx === gx || xx === gx + GW - 1, edgeY = yy === gy || yy === gy + GH - 1;
            const gate = yy === gy + GH - 1 && (xx === gx + 3 || xx === gx + 4);
            this.grid[yy][xx] = gate ? T.DIRT : edgeY ? T.FENCE_H : edgeX ? T.FENCE_V : ((xx + yy) % 3 ? T.GRASS3 : T.GRASS2);
        }
        if (gy + GH < H) for (const xx of [gx + 3, gx + 4]) { const tt = this.grid[gy + GH][xx]; if (OK.has(tt)) this.grid[gy + GH][xx] = T.DIRT; }
        this.natureZones.graveyard = { x: gx, y: gy, w: GW, h: GH };
        const nm = { harbor: '望海墓園', mountain: '山坡墓地', forest: '林間墓地', market: '城郊墓園' }[this.themeKey] || '墓園';
        this.labelPositions.graveyard = { x: (gx + GW / 2) * TILE, y: gy * TILE - 4, name: nm };
        this._factoryPlots = null; // 地基重算時把墓園算進去
    }
    _generateLayoutCore(locations, theme) {
        // v5.75.0 主題地圖:海風鎮走海岸版面(海面/沙灘/棧橋/燈塔),其他鎮維持內陸版面
        this.themeKey = theme || 'frontier';
        this._blockWater = this.themeKey === 'harbor';
        this._boats = null; this._lighthouse = null; this._pier = null;
        this._rails = null; this._chimneys = null; this._hotSpring = null; this._ropeBridges = null; // v5.76.0
        this._firePit = null; this._elderTree = null; this._watchtower = null; this._deer = null; this._fireflySpots = null; // v5.77.0
        this._gates = null; this._pennants = null; this._tents = null; this._fountain = null; // v5.78.0
        // Fill with varied grass types for natural look
        this.grid = Array.from({length: this.rows}, (_, y) =>
            Array.from({length: this.cols}, (_, x) => {
                const n = (x * 7 + y * 13 + x * y * 3) % 10;
                return n < 5 ? T.GRASS : n < 8 ? T.GRASS2 : T.GRASS3;
            })
        );
        this.buildingZones = {};
        this.natureZones = {};
        this.labelPositions = {};
        this._factoryPlots = null; // v5.54.1 重新產圖時重算工廠地基
        this._houseSubZones = {}; // v5.62.0 重新產圖時清掉舊鎮的房子與住戶分配,切鎮不殘留
        this._agentHouseMap = {};
        this._extraHouseCount = 0;
        // v5.57.0 馬車站:東側大路盡頭,通往別的城鎮
        this.coachStation = { x: this.cols - 7, y: 18, w: 5, h: 5 };

        // Add grass variation
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const r = ((x * 7 + y * 13 + x*y) % 17);
                if (r < 5) this.grid[y][x] = T.GRASS2;
                else if (r < 8) this.grid[y][x] = T.GRASS3;
            }
        }
        if (this.themeKey === 'harbor') { this._layoutHarbor(locations); return; }
        if (this.themeKey === 'mountain') { this._layoutMountain(locations); return; } // v5.76.0
        if (this.themeKey === 'forest') { this._layoutForest(locations); return; } // v5.77.0
        if (this.themeKey === 'market') { this._layoutMarket(locations); return; } // v5.78.0

        // Add border trees
        for (let x = 0; x < this.cols; x++) {
            for (let dy = 0; dy < 3; dy++) {
                if ((x + dy) % 2 === 0) { this.grid[dy][x] = T.TREE_TOP; this.grid[this.rows-1-dy][x] = T.TREE_TOP2; }
                else { this.grid[dy][x] = T.TREE_TOP2; this.grid[this.rows-1-dy][x] = T.TREE_TOP; }
            }
        }
        for (let y = 3; y < this.rows-3; y++) {
            for (let dx = 0; dx < 2; dx++) {
                this.grid[y][dx] = (y+dx) % 2 === 0 ? T.TREE_TOP : T.TREE_TOP2;
                this.grid[y][this.cols-1-dx] = (y+dx) % 2 === 0 ? T.TREE_TOP : T.TREE_TOP2;
            }
        }

        // Define fixed positions for building zones on the grid
        const FIXED_POSITIONS = {
            // Social - center area
            town_square:  { x:32, y:24, type:'square' },
            tavern:       { x:18, y:22, type:'building' },
            chapel:       { x:50, y:14, type:'building' },
            park:         { x:6,  y:22, type:'nature' },
            well:         { x:36, y:32, type:'well' },

            // Work - spread around
            town_hall:    { x:30, y:10, type:'building' },
            farm:         { x:6,  y:40, type:'farm' },
            quarry:       { x:62, y:42, type:'mine' },
            workshop:     { x:50, y:28, type:'building' },
            general_store:{ x:18, y:12, type:'building' },
            clinic:       { x:48, y:38, type:'building' },
            library:      { x:62, y:14, type:'building' },
            guardpost:    { x:6,  y:10, type:'building' },

            // Residential - larger clusters with 4 houses each
            residential_north:{ x:28, y:3,  type:'house_cluster' },
            residential_south:{ x:16, y:44, type:'house_cluster' },
            residential_east: { x:62, y:26, type:'house_cluster' },

            // Nature
            forest:  { x:4,  y:32, type:'forest' },
            river:   { x:40, y:48, type:'river' },
            hill:    { x:70, y:5,  type:'hill' },
            cave:    { x:70, y:50, type:'cave' },
            lake:    { x:55, y:50, type:'lake' },
            meadow:  { x:10, y:52, type:'meadow' },
        };

        // Draw roads first - main horizontal and vertical roads
        const roadY1 = 20, roadY2 = 38;
        const roadX1 = 26, roadX2 = 46;

        // Horizontal roads
        for (let x = 3; x < this.cols - 2; x++) {
            this.grid[roadY1][x] = T.DIRT;
            this.grid[roadY1+1][x] = T.DIRT;
            this.grid[roadY2][x] = T.DIRT;
            this.grid[roadY2+1][x] = T.DIRT;
        }
        // Vertical roads
        for (let y = 3; y < this.rows - 3; y++) {
            this.grid[y][roadX1] = T.DIRT;
            this.grid[y][roadX1+1] = T.DIRT;
            this.grid[y][roadX2] = T.DIRT;
            this.grid[y][roadX2+1] = T.DIRT;
        }

        // Stone path for town square area
        for (let y = 22; y < 30; y++) {
            for (let x = 30; x < 40; x++) {
                this.grid[y][x] = T.STONE_PATH;
            }
        }

        // Place each location
        const locEntries = Object.entries(locations);
        for (const [locId, loc] of locEntries) {
            const fp = FIXED_POSITIONS[locId];
            if (!fp) continue;
            const bx = Math.min(fp.x, this.cols - 12);
            const by = Math.min(fp.y, this.rows - 10);

            switch (fp.type) {
                case 'building': this._placeBuilding(locId, bx, by, loc.name); break;
                case 'house_cluster': this._placeHouseCluster(locId, bx, by, loc.name); break;
                case 'farm': this._placeFarm(locId, bx, by, loc.name); break;
                case 'mine': this._placeMine(locId, bx, by, loc.name); break;
                case 'square': this._placeSquare(locId, bx, by, loc.name); break;
                case 'well': this._placeWell(locId, bx, by, loc.name); break;
                case 'forest': this._placeForest(locId, bx, by, loc.name); break;
                case 'river': this._placeRiver(locId, bx, by, loc.name); break;
                case 'hill': this._placeHill(locId, bx, by, loc.name); break;
                case 'cave': this._placeCave(locId, bx, by, loc.name); break;
                case 'lake': this._placeLake(locId, bx, by, loc.name); break;
                case 'meadow': this._placeMeadow(locId, bx, by, loc.name); break;
                case 'nature': this._placeNatureArea(locId, bx, by, loc.name); break;
            }
        }

        // Scatter random decorations
        for (let i = 0; i < 30; i++) {
            const x = 3 + ((i * 17 + 7) % (this.cols - 6));
            const y = 4 + ((i * 13 + 11) % (this.rows - 8));
            if (this.grid[y][x] === T.GRASS || this.grid[y][x] === T.GRASS2 || this.grid[y][x] === T.GRASS3) {
                const deco = [T.FLOWER1, T.FLOWER2, T.BUSH, T.ROCK][i % 4];
                this.grid[y][x] = deco;
            }
        }
    }

    _placeBuilding(locId, x, y, name) {
        const templateKey = LOCATION_BUILDING[locId] || 'house';
        const tmpl = TILE_BUILDING_TEMPLATES[templateKey] || TILE_BUILDING_TEMPLATES.house;
        const w = tmpl.w, h = tmpl.h;

        // Place roof row above building
        for (let rx = 0; rx < w; rx++) {
            if (y > 0) this.grid[y][x + rx] = T.ROOF;
        }

        // Place building tiles
        for (let ty = 0; ty < h; ty++) {
            for (let tx = 0; tx < w; tx++) {
                if (y + ty + 1 < this.rows && x + tx < this.cols) {
                    this.grid[y + ty + 1][x + tx] = tmpl.tiles[ty][tx];
                }
            }
        }

        // Clear doorstep area (2 tiles wide in front of door for easier entry)
        const doorTileX = x + tmpl.doorX;
        const doorTileY = y + h + 1; // tile row just below door
        for (let dy = 0; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const cx = doorTileX + dx, cy = doorTileY + dy;
                if (cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows) {
                    const t = this.grid[cy][cx];
                    if (t === T.GRASS || t === T.GRASS2 || t === T.GRASS3) {
                        this.grid[cy][cx] = T.DIRT;
                    }
                }
            }
        }
        // Connect to nearest road with dirt path
        this._connectToRoad(doorTileX, doorTileY);

        const doorPxX = (doorTileX + 0.5) * TILE;
        const doorPxY = (doorTileY + 0.5) * TILE; // on the doorstep tile
        this.buildingZones[locId] = { x, y, w, h: h + 1, doorPixelX: doorPxX, doorPixelY: doorPxY };
        this.labelPositions[locId] = { x: (x + w/2) * TILE, y: y * TILE - 4, name };
    }

    _placeHouseCluster(locId, x, y, name) {
        // Place 4 houses in a 2x2 grid with a small path between them
        const house = TILE_BUILDING_TEMPLATES.house;
        const gapX = 1; // gap between houses horizontally
        const gapY = 2; // gap between house rows (for path)
        const positions = [
            { dx: 0, dy: 0 },
            { dx: house.w + gapX, dy: 0 },
            { dx: 0, dy: house.h + gapY + 1 },
            { dx: house.w + gapX, dy: house.h + gapY + 1 },
        ];
        // Store individual house sub-zones
        this._houseSubZones = this._houseSubZones || {};
        let houseIdx = 0;
        for (const p of positions) {
            const hx = x + p.dx, hy = y + p.dy;
            if (hx + house.w >= this.cols || hy + house.h + 1 >= this.rows) continue;
            for (let rx = 0; rx < house.w; rx++) {
                if (hy < this.rows) this.grid[hy][hx + rx] = T.ROOF;
            }
            for (let ty = 0; ty < house.h; ty++) {
                for (let tx = 0; tx < house.w; tx++) {
                    if (hy + ty + 1 < this.rows && hx + tx < this.cols) {
                        this.grid[hy + ty + 1][hx + tx] = house.tiles[ty][tx];
                    }
                }
            }
            // Clear doorstep area for easier entry
            const doorTX = hx + house.doorX;
            const doorTY = hy + house.h + 1;
            for (let ddy = 0; ddy <= 1; ddy++) {
                for (let ddx = -1; ddx <= 1; ddx++) {
                    const cx = doorTX + ddx, cy = doorTY + ddy;
                    if (cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows) {
                        const tt = this.grid[cy][cx];
                        if (tt === T.GRASS || tt === T.GRASS2 || tt === T.GRASS3) {
                            this.grid[cy][cx] = T.DIRT;
                        }
                    }
                }
            }
            this._connectToRoad(doorTX, doorTY);
            // Register each house as a sub-zone with door position
            const subId = `${locId}_${houseIdx}`;
            const doorPxX = (doorTX + 0.5) * TILE;
            const doorPxY = (doorTY + 0.5) * TILE;
            const interiorX = (hx + house.w / 2) * TILE;
            const interiorY = (hy + house.h / 2 + 1) * TILE;
            this._houseSubZones[subId] = {
                x: hx, y: hy, w: house.w, h: house.h + 1,
                doorPixelX: doorPxX, doorPixelY: doorPxY,
                interiorX, interiorY,
                parentLocId: locId, houseIndex: houseIdx
            };
            this.buildingZones[subId] = {
                x: hx, y: hy, w: house.w, h: house.h + 1,
                doorPixelX: doorPxX, doorPixelY: doorPxY,
                parentLocId: locId
            };
            houseIdx++;
        }
        // Draw small path between the two rows of houses
        const pathY = y + house.h + 1;
        for (let px = 0; px < house.w * 2 + gapX; px++) {
            for (let py = 0; py < gapY; py++) {
                if (pathY + py < this.rows && x + px < this.cols) {
                    this.grid[pathY + py][x + px] = T.STONE_PATH;
                }
            }
        }
        const totalW = house.w * 2 + gapX;
        const totalH = (house.h + 1) * 2 + gapY;
        this.buildingZones[locId] = { x, y, w: totalW, h: totalH };
        this.labelPositions[locId] = { x: (x + totalW/2) * TILE, y: y * TILE - 4, name };
    }

    _placeFarm(locId, x, y, name) {
        const barn = TILE_BUILDING_TEMPLATES.farm_building;
        // Place barn
        for (let rx = 0; rx < barn.w; rx++) this.grid[y][x + rx] = T.ROOF2;
        for (let ty = 0; ty < barn.h; ty++) {
            for (let tx = 0; tx < barn.w; tx++) {
                if (y+ty+1 < this.rows) this.grid[y+ty+1][x+tx] = barn.tiles[ty][tx];
            }
        }
        // Place crop fields
        const fy = y + barn.h + 2;
        for (let cy = 0; cy < 4; cy++) {
            for (let cx = 0; cx < 8; cx++) {
                if (fy+cy < this.rows && x+cx < this.cols) {
                    this.grid[fy+cy][x+cx] = [T.CROP1, T.CROP2, T.CROP3][(cx+cy)%3];
                }
            }
        }
        // Fence around crops
        for (let cx = -1; cx <= 8; cx++) {
            if (x+cx >= 0 && x+cx < this.cols) {
                if (fy-1 >= 0) this.grid[fy-1][x+cx] = T.FENCE_H;
                if (fy+4 < this.rows) this.grid[fy+4][x+cx] = T.FENCE_H;
            }
        }

        this._connectToRoad(x + barn.doorX, y + barn.h + 1);
        this.buildingZones[locId] = { x, y, w: 8, h: barn.h + 7 };
        this.labelPositions[locId] = { x: (x + 4) * TILE, y: y * TILE - 4, name };
    }

    _placeMine(locId, x, y, name) {
        // Rock formation with cave entrance
        for (let dy = 0; dy < 4; dy++) {
            for (let dx = 0; dx < 6; dx++) {
                if (y+dy < this.rows && x+dx < this.cols) {
                    this.grid[y+dy][x+dx] = T.ROCK;
                }
            }
        }
        // Cave entrance
        if (y+3 < this.rows) { this.grid[y+3][x+2] = T.DARK_FLOOR; this.grid[y+3][x+3] = T.DARK_FLOOR; }
        if (y+2 < this.rows) { this.grid[y+2][x+2] = T.DARK_FLOOR; this.grid[y+2][x+3] = T.DARK_FLOOR; }

        this._connectToRoad(x + 3, y + 4);
        this.buildingZones[locId] = { x, y, w: 6, h: 4 };
        this.labelPositions[locId] = { x: (x + 3) * TILE, y: y * TILE - 4, name };
    }

    _placeSquare(locId, x, y, name) {
        // Already placed stone path, just add decorations
        // Fountain in center
        this.grid[y+3][x+4] = T.WELL;
        this.grid[y+3][x+5] = T.WELL;
        this.grid[y+4][x+4] = T.WELL;
        this.grid[y+4][x+5] = T.WELL;
        // Benches
        this.grid[y+2][x+2] = T.CHAIR;
        this.grid[y+2][x+7] = T.CHAIR;
        this.grid[y+5][x+2] = T.CHAIR;
        this.grid[y+5][x+7] = T.CHAIR;
        // Flowers
        this.grid[y+1][x+1] = T.FLOWER1;
        this.grid[y+1][x+8] = T.FLOWER2;
        this.grid[y+6][x+1] = T.FLOWER2;
        this.grid[y+6][x+8] = T.FLOWER1;

        this.buildingZones[locId] = { x, y, w: 10, h: 8 };
        this.labelPositions[locId] = { x: (x + 5) * TILE, y: y * TILE - 4, name };
    }

    _placeWell(locId, x, y, name) {
        this.grid[y][x] = T.WELL;
        this.grid[y][x+1] = T.WELL;
        this.grid[y+1][x] = T.WELL;
        this.grid[y+1][x+1] = T.WELL;
        this.buildingZones[locId] = { x: x-1, y: y-1, w: 4, h: 4 };
        this.labelPositions[locId] = { x: (x + 1) * TILE, y: (y - 1) * TILE, name };
    }

    _placeForest(locId, x, y, name) {
        const W = 7, H = 6;
        for (let dy = 0; dy < H; dy++) {
            for (let dx = 0; dx < W; dx++) {
                if (y+dy >= this.rows || x+dx >= this.cols) continue;
                const r = (dx * 7 + dy * 5) % 8;
                if (r < 3) this.grid[y+dy][x+dx] = T.TREE_TOP;
                else if (r < 5) this.grid[y+dy][x+dx] = T.TREE_TOP2;
                else if (r === 5) this.grid[y+dy][x+dx] = T.BUSH;
                else this.grid[y+dy][x+dx] = T.GRASS3;
            }
        }
        // Tree trunks along bottom edge
        for (let dx = 1; dx < W-1; dx += 2) {
            if (y+H-1 < this.rows && x+dx < this.cols) this.grid[y+H-1][x+dx] = T.TREE_TRUNK;
        }
        // Small clearing with flowers
        if (y+2 < this.rows && x+3 < this.cols) { this.grid[y+2][x+3] = T.GRASS2; this.grid[y+2][x+2] = T.FLOWER2; }
        if (y+3 < this.rows && x+4 < this.cols) this.grid[y+3][x+4] = T.FLOWER1;

        this.natureZones[locId] = { x, y, w: W, h: H };
        this.labelPositions[locId] = { x: (x + W/2) * TILE, y: y * TILE - 4, name };
    }

    _placeRiver(locId, x, y, name) {
        for (let dy = 0; dy < 4; dy++) {
            for (let dx = 0; dx < 8; dx++) {
                if (y+dy < this.rows && x+dx < this.cols) {
                    // Wavy river shape
                    const wave = Math.floor(Math.sin(dx * 0.8) * 1.5);
                    if (dy >= 1 + wave && dy <= 2 + wave) {
                        this.grid[y+dy][x+dx] = (dx + dy) % 2 === 0 ? T.WATER : T.WATER2;
                    } else {
                        this.grid[y+dy][x+dx] = T.SAND;
                    }
                }
            }
        }
        // Bridge
        if (y+1 < this.rows && x+4 < this.cols) { this.grid[y+1][x+4] = T.BRIDGE; this.grid[y+2][x+4] = T.BRIDGE; }

        this.natureZones[locId] = { x, y, w: 8, h: 4 };
        this.labelPositions[locId] = { x: (x + 4) * TILE, y: y * TILE - 4, name };
    }

    _placeHill(locId, x, y, name) {
        for (let dy = 0; dy < 4; dy++) {
            for (let dx = 0; dx < 5; dx++) {
                if (y+dy < this.rows && x+dx < this.cols) {
                    this.grid[y+dy][x+dx] = T.ROCK;
                }
            }
        }
        // Grass on top
        if (y+1 < this.rows) { this.grid[y+1][x+2] = T.GRASS3; this.grid[y+1][x+3] = T.FLOWER1; }
        this.natureZones[locId] = { x, y, w: 5, h: 4 };
        this.labelPositions[locId] = { x: (x + 2.5) * TILE, y: y * TILE - 4, name };
    }

    _placeCave(locId, x, y, name) {
        for (let dy = 0; dy < 3; dy++) {
            for (let dx = 0; dx < 5; dx++) {
                if (y+dy < this.rows && x+dx < this.cols) this.grid[y+dy][x+dx] = T.ROCK;
            }
        }
        if (y+2 < this.rows) { this.grid[y+2][x+2] = T.DARK_FLOOR; this.grid[y+1][x+2] = T.DARK_FLOOR; }
        this.natureZones[locId] = { x, y, w: 5, h: 3 };
        this.labelPositions[locId] = { x: (x + 2.5) * TILE, y: y * TILE - 4, name };
    }

    _placeLake(locId, x, y, name) {
        const W = 8, H = 6;
        for (let dy = 0; dy < H; dy++) {
            for (let dx = 0; dx < W; dx++) {
                if (y+dy >= this.rows || x+dx >= this.cols) continue;
                const cx2 = 3.5, cy2 = 2.5;
                const dist = ((dx-cx2)*(dx-cx2))/12 + ((dy-cy2)*(dy-cy2))/5;
                if (dist < 0.8) {
                    this.grid[y+dy][x+dx] = (dx+dy) % 2 === 0 ? T.WATER : T.WATER2;
                } else if (dist < 1.3) {
                    this.grid[y+dy][x+dx] = T.SAND;
                } else if (dist < 1.8) {
                    // Grass border with flowers
                    const r = (dx*3+dy*5) % 4;
                    this.grid[y+dy][x+dx] = r === 0 ? T.FLOWER2 : r === 1 ? T.FLOWER1 : T.GRASS2;
                }
            }
        }
        // Rocks on shore
        if (y+1 < this.rows && x < this.cols) this.grid[y+1][x] = T.ROCK;
        if (y+H-1 < this.rows && x+W-1 < this.cols) this.grid[y+H-1][x+W-1] = T.ROCK;
        // Bush on edge
        if (y < this.rows && x+W-1 < this.cols) this.grid[y][x+W-1] = T.BUSH;

        this.natureZones[locId] = { x, y, w: W, h: H };
        this.labelPositions[locId] = { x: (x + W/2) * TILE, y: y * TILE - 4, name };
    }

    _placeMeadow(locId, x, y, name) {
        const W = 7, H = 5;
        for (let dy = 0; dy < H; dy++) {
            for (let dx = 0; dx < W; dx++) {
                if (y+dy >= this.rows || x+dx >= this.cols) continue;
                const r = (dx * 3 + dy * 7 + dx * dy) % 8;
                if (r === 0 || r === 3) this.grid[y+dy][x+dx] = T.FLOWER1;
                else if (r === 1 || r === 5) this.grid[y+dy][x+dx] = T.FLOWER2;
                else if (r === 6) this.grid[y+dy][x+dx] = T.BUSH;
                else this.grid[y+dy][x+dx] = T.GRASS2;
            }
        }
        // Rocks accent
        if (y+2 < this.rows && x+1 < this.cols) this.grid[y+2][x+1] = T.ROCK;
        // Stone path through meadow
        if (y+H-1 < this.rows && x+3 < this.cols) this.grid[y+H-1][x+3] = T.STONE_PATH;
        this.natureZones[locId] = { x, y, w: W, h: H };
        this.labelPositions[locId] = { x: (x + W/2) * TILE, y: y * TILE - 4, name };
    }

    _placeNatureArea(locId, x, y, name) {
        const W = 7, H = 6;
        for (let dy = 0; dy < H; dy++) {
            for (let dx = 0; dx < W; dx++) {
                if (y+dy >= this.rows || x+dx >= this.cols) continue;
                const r = (dx * 5 + dy * 3 + dx * dy * 2) % 10;
                if (r < 2) this.grid[y+dy][x+dx] = T.TREE_TOP;
                else if (r === 2) this.grid[y+dy][x+dx] = T.TREE_TOP2;
                else if (r === 3) this.grid[y+dy][x+dx] = T.FLOWER1;
                else if (r === 4) this.grid[y+dy][x+dx] = T.FLOWER2;
                else if (r === 5) this.grid[y+dy][x+dx] = T.BUSH;
                else if (r === 6) this.grid[y+dy][x+dx] = T.ROCK;
                else this.grid[y+dy][x+dx] = T.GRASS2;
            }
        }
        // Stone path and bench in center
        if (y+3 < this.rows && x+3 < this.cols) {
            this.grid[y+3][x+3] = T.STONE_PATH;
            this.grid[y+3][x+2] = T.CHAIR;
            this.grid[y+3][x+4] = T.CHAIR;
        }

        this.natureZones[locId] = { x, y, w: W, h: H };
        this.labelPositions[locId] = { x: (x + W/2) * TILE, y: y * TILE - 4, name };
    }

    // ============================================================
    // v5.78.0 市集城平原版面:一圈城牆與六座城門、大市集廣場(攤棚＋噴泉＋彩旗)、商隊營地帳篷、
    // 磚窯;平原樞紐,道路直通四方
    // ============================================================
    _layoutMarket(locations) {
        const cols = this.cols, rows = this.rows;
        const roadY1 = 20, roadY2 = 38, roadX1 = 26, roadX2 = 46;
        // 城外:邊界外一圈矮樹(1 格),城牆在第 2 格,牆內全是草地
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            if (y < 2 || y >= rows - 2 || x < 2 || x >= cols - 2) this.grid[y][x] = ((x + y) % 2 === 0) ? T.TREE_TOP : T.TREE_TOP2;
        }
        const WX0 = 2, WX1 = cols - 3, WY0 = 2, WY1 = rows - 3;
        for (let x = WX0; x <= WX1; x++) { this.grid[WY0][x] = T.WALL_TOP; this.grid[WY1][x] = T.WALL_TOP; }
        for (let y = WY0; y <= WY1; y++) { this.grid[y][WX0] = T.WALL_TOP; this.grid[y][WX1] = T.WALL_TOP; }
        // 道路直通城門(城牆上開口)
        for (let x = WX0; x <= WX1; x++) { this.grid[roadY1][x] = T.DIRT; this.grid[roadY1 + 1][x] = T.DIRT; this.grid[roadY2][x] = T.DIRT; this.grid[roadY2 + 1][x] = T.DIRT; }
        for (let y = WY0; y <= WY1; y++) { this.grid[y][roadX1] = T.DIRT; this.grid[y][roadX1 + 1] = T.DIRT; this.grid[y][roadX2] = T.DIRT; this.grid[y][roadX2 + 1] = T.DIRT; }
        this._gates = [
            { x: WX0, y: roadY1, vertical: true }, { x: WX1, y: roadY1, vertical: true }, { x: WX0, y: roadY2, vertical: true }, { x: WX1, y: roadY2, vertical: true },
            { x: roadX1, y: WY0, vertical: false }, { x: roadX2, y: WY0, vertical: false }, { x: roadX1, y: WY1, vertical: false }, { x: roadX2, y: WY1, vertical: false },
        ];
        const POS = {
            town_square:  { x:29, y:22, type:'grandmarket' },
            tavern:       { x:18, y:22, type:'building' },
            chapel:       { x:50, y:11, type:'building' },
            park:         { x:6,  y:22, type:'nature' },
            well:         { x:35, y:33, type:'well' },
            town_hall:    { x:28, y:3,  type:'building' },
            farm:         { x:6,  y:40, type:'farm' },
            quarry:       { x:34, y:42, type:'kiln' },
            workshop:     { x:50, y:28, type:'building' },
            general_store:{ x:18, y:11, type:'building' },
            clinic:       { x:6,  y:30, type:'building' },
            library:      { x:37, y:11, type:'building' },
            guardpost:    { x:62, y:4,  type:'building' },
            residential_north:{ x:5,  y:3,  type:'house_cluster' },
            residential_south:{ x:16, y:42, type:'house_cluster' },
            residential_east: { x:62, y:26, type:'house_cluster' },
            forest:  { x:52, y:40, type:'forest' },
            river:   { x:36, y:50, type:'river' },
            hill:    { x:71, y:48, type:'hill' },
            cave:    { x:62, y:50, type:'cave' },
            lake:    { x:48, y:48, type:'lake' },
            meadow:  { x:28, y:50, type:'meadow' },
        };
        for (const [locId, loc] of Object.entries(locations)) {
            const fp = POS[locId];
            if (!fp) continue;
            const bx = fp.x, by = fp.y, name = loc.name;
            switch (fp.type) {
                case 'building': this._placeBuilding(locId, bx, by, name); break;
                case 'house_cluster': this._placeHouseCluster(locId, bx, by, name); break;
                case 'farm': this._placeFarm(locId, bx, by, name); break;
                case 'well': this._placeWell(locId, bx, by, name); this._fountain = { x: (bx + 1) * TILE, y: (by + 1) * TILE }; break;
                case 'nature': this._placeNatureArea(locId, bx, by, name); break;
                case 'forest': this._placeForest(locId, bx, by, name); break;
                case 'river': this._placeRiver(locId, bx, by, name); break;
                case 'hill': this._placeHill(locId, bx, by, name); break;
                case 'cave': this._placeCave(locId, bx, by, name); break;
                case 'lake': this._placeLake(locId, bx, by, name); break;
                case 'meadow': this._placeMeadow(locId, bx, by, name); break;
                case 'grandmarket': this._placeGrandMarket(locId, bx, by, name); break;
                case 'kiln': this._placeKiln(locId, bx, by, name); break;
            }
        }
        // 商隊營地(東南角城牆內):土地、帳篷、木箱與馬車
        this._placeCaravanCamp(64, 41);
        // 馬車站:東門內側
        this.coachStation = { x: cols - 8, y: 18, w: 5, h: 5 };
        // 點綴:牆內少量花與灌木
        for (let i = 0; i < 24; i++) {
            const x = 4 + ((i * 17 + 7) % (cols - 8));
            const y = 4 + ((i * 13 + 11) % (rows - 8));
            const g = this.grid[y][x];
            if (g === T.GRASS || g === T.GRASS2 || g === T.GRASS3) this.grid[y][x] = [T.FLOWER1, T.FLOWER2, T.BUSH, T.FLOWER1][i % 4];
        }
    }

    // 大市集廣場:14x10 石板,兩排攤棚、中央噴泉、角落花壇,彩旗在 render 時動態畫
    _placeGrandMarket(locId, x, y, name) {
        const W = 14, H = 10;
        for (let dy = 0; dy < H; dy++) for (let dx = 0; dx < W; dx++) this.grid[y + dy][x + dx] = T.STONE_PATH;
        for (const dx of [1, 3, 5, 8, 10, 12]) { this.grid[y + 2][x + dx] = T.STALL; this.grid[y + 7][x + dx] = T.STALL; }
        this.grid[y + 4][x + 6] = T.WELL; this.grid[y + 4][x + 7] = T.WELL; this.grid[y + 5][x + 6] = T.WELL; this.grid[y + 5][x + 7] = T.WELL;
        this.grid[y][x] = T.FLOWER1; this.grid[y][x + W - 1] = T.FLOWER2; this.grid[y + H - 1][x] = T.FLOWER2; this.grid[y + H - 1][x + W - 1] = T.FLOWER1;
        this.grid[y + 4][x + 1] = T.CRATE; this.grid[y + 5][x + W - 2] = T.BARREL;
        this._pennants = [
            { x0: (x + 1) * TILE, x1: (x + W - 1) * TILE, y: (y + 1) * TILE + 2 },
            { x0: (x + 1) * TILE, x1: (x + W - 1) * TILE, y: (y + 6) * TILE + 2 },
        ];
        this.buildingZones[locId] = { x, y, w: W, h: H };
        this.labelPositions[locId] = { x: (x + W / 2) * TILE, y: y * TILE - 4, name };
    }

    // 磚窯:工寮 + 兩座爐窯(熔爐格)與磚堆
    _placeKiln(locId, x, y, name) {
        const shed = TILE_BUILDING_TEMPLATES.farm_building;
        for (let rx = 0; rx < shed.w; rx++) this.grid[y][x + rx] = T.ROOF2;
        for (let ty = 0; ty < shed.h; ty++) for (let tx = 0; tx < shed.w; tx++) {
            if (y + ty + 1 < this.rows) this.grid[y + ty + 1][x + tx] = shed.tiles[ty][tx];
        }
        this.grid[y + 1][x + 6] = T.FURNACE; this.grid[y + 1][x + 7] = T.FURNACE; this.grid[y + 2][x + 6] = T.ROCK; this.grid[y + 2][x + 7] = T.ROCK;
        const yy = y + shed.h + 1;
        for (let dx = 0; dx < 8; dx++) if (yy + 1 < this.rows) this.grid[yy + 1][x + dx] = (dx % 2 === 0) ? T.CRATE : T.DIRT;
        this._connectToRoad(x + shed.doorX, yy);
        this._chimneys = this._chimneys || [];
        this._chimneys.push({ x: (x + 6) * TILE + 5, y: (y + 1) * TILE + 2, hot: true });
        this.buildingZones[locId] = { x, y, w: 8, h: shed.h + 3, doorPixelX: (x + shed.doorX + 0.5) * TILE, doorPixelY: (yy + 0.5) * TILE };
        this.labelPositions[locId] = { x: (x + 4) * TILE, y: y * TILE - 4, name };
    }

    // 商隊營地:踩實的土地、幾頂帳篷(render 畫)、木箱木桶
    _placeCaravanCamp(x, y) {
        for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < 8; dx++) if (y + dy < this.rows - 3 && x + dx < this.cols - 3) this.grid[y + dy][x + dx] = ((dx + dy) % 4 === 0) ? T.GRASS3 : T.DIRT;
        this.grid[y + 5][x + 1] = T.CRATE; this.grid[y + 5][x + 2] = T.BARREL; this.grid[y + 4][x + 6] = T.CRATE; this.grid[y + 5][x + 6] = T.CRATE;
        this._tents = [{ x: (x + 1.5) * TILE, y: (y + 1.5) * TILE, c: '#c8623a' }, { x: (x + 4.5) * TILE, y: (y + 1.2) * TILE, c: '#4a7fb5' }, { x: (x + 6.3) * TILE, y: (y + 3.2) * TILE, c: '#b89a3a' }, { x: (x + 2.8) * TILE, y: (y + 3.6) * TILE, c: '#6a9a4a' }];
    }

    // v5.78.0 市集道具:城門樓、廣場彩旗(隨風飄)、噴泉水花、商隊帳篷
    _layoutForest(locations) {
        const cols = this.cols, rows = this.rows;
        // 邊界林帶(四邊各 3 格)
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            if (y < 3 || y >= rows - 3 || x < 3 || x >= cols - 3) this.grid[y][x] = ((x + y) % 2 === 0) ? T.TREE_TOP : T.TREE_TOP2;
        }
        // 道路(土路,座標與邊境鎮相同)
        const roadY1 = 20, roadY2 = 38, roadX1 = 26, roadX2 = 46;
        for (let x = 3; x < cols - 3; x++) { this.grid[roadY1][x] = T.DIRT; this.grid[roadY1 + 1][x] = T.DIRT; this.grid[roadY2][x] = T.DIRT; this.grid[roadY2 + 1][x] = T.DIRT; }
        for (let y = 3; y < rows - 3; y++) { this.grid[y][roadX1] = T.DIRT; this.grid[y][roadX1 + 1] = T.DIRT; this.grid[y][roadX2] = T.DIRT; this.grid[y][roadX2 + 1] = T.DIRT; }

        const POS = {
            town_square:  { x:32, y:24, type:'campcircle' },
            tavern:       { x:18, y:22, type:'building' },
            chapel:       { x:50, y:11, type:'eldertree' },
            park:         { x:6,  y:22, type:'nature' },
            well:         { x:36, y:32, type:'well' },
            town_hall:    { x:36, y:11, type:'building' },
            farm:         { x:6,  y:40, type:'farm' },
            quarry:       { x:62, y:42, type:'lumberyard' },
            workshop:     { x:50, y:28, type:'building' },
            general_store:{ x:28, y:3,  type:'building' },
            clinic:       { x:6,  y:30, type:'building' },
            library:      { x:62, y:14, type:'building' },
            guardpost:    { x:70, y:5,  type:'watchtower' },
            residential_north:{ x:6,  y:3,  type:'house_cluster' },
            residential_south:{ x:16, y:42, type:'house_cluster' },
            residential_east: { x:62, y:26, type:'house_cluster' },
            forest:  { x:48, y:46, type:'forest' },
            river:   { x:38, y:42, type:'river' },
            hill:    { x:71, y:42, type:'hill' },
            cave:    { x:70, y:50, type:'cave' },
            lake:    { x:30, y:48, type:'lake' },
            meadow:  { x:10, y:52, type:'meadow' },
        };
        const placedRects = [];
        for (const [locId, loc] of Object.entries(locations)) {
            const fp = POS[locId];
            if (!fp) continue;
            const bx = fp.x, by = fp.y, name = loc.name;
            switch (fp.type) {
                case 'building': this._placeBuilding(locId, bx, by, name); break;
                case 'house_cluster': this._placeHouseCluster(locId, bx, by, name); break;
                case 'farm': this._placeFarm(locId, bx, by, name); break;
                case 'well': this._placeWell(locId, bx, by, name); break;
                case 'nature': this._placeNatureArea(locId, bx, by, name); break;
                case 'forest': this._placeForest(locId, bx, by, name); break;
                case 'river': this._placeRiver(locId, bx, by, name); break;
                case 'hill': this._placeHill(locId, bx, by, name); break;
                case 'cave': this._placeCave(locId, bx, by, name); break;
                case 'lake': this._placeLake(locId, bx, by, name); break;
                case 'meadow': this._placeMeadow(locId, bx, by, name); break;
                case 'campcircle': this._placeCampCircle(locId, bx, by, name); break;
                case 'eldertree': this._placeElderTree(locId, bx, by, name); break;
                case 'lumberyard': this._placeLumberYard(locId, bx, by, name); break;
                case 'watchtower': this._placeBuilding(locId, bx, by, name); this._watchtower = { x: bx + 6, y: by }; break;
            }
            const z = this.buildingZones[locId] || this.natureZones[locId];
            if (z) placedRects.push(z);
        }
        // 密林填充:不在道路兩側 1 格、不在任何地點外圍 1 格的草地,依雜湊種成樹(六成)/灌木/花
        const nearRoad = (x, y) => {
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const yy = y + dy, xx = x + dx;
                if (yy < 0 || yy >= rows || xx < 0 || xx >= cols) continue;
                const t = this.grid[yy][xx];
                if (t === T.DIRT || t === T.STONE_PATH || t === T.BRIDGE) return true;
            }
            return false;
        };
        const inZone = (x, y) => placedRects.some(z => x >= z.x - 1 && x < z.x + z.w + 1 && y >= z.y - 1 && y < z.y + z.h + 1)
            || (this.coachStation && x >= this.coachStation.x - 1 && x < this.coachStation.x + this.coachStation.w + 1 && y >= this.coachStation.y - 1 && y < this.coachStation.y + this.coachStation.h + 1);
        for (let y = 3; y < rows - 3; y++) for (let x = 3; x < cols - 3; x++) {
            const g = this.grid[y][x];
            if (g !== T.GRASS && g !== T.GRASS2 && g !== T.GRASS3) continue;
            if (nearRoad(x, y) || inZone(x, y)) continue;
            const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
            const r = h % 100;
            if (r < 42) this.grid[y][x] = T.TREE_TOP;
            else if (r < 60) this.grid[y][x] = T.TREE_TOP2;
            else if (r < 68) this.grid[y][x] = T.BUSH;
            else if (r < 72) this.grid[y][x] = T.FLOWER1;
            else if (r < 75) this.grid[y][x] = T.TREE_TRUNK;
        }
        // 林間的鹿(菜園旁)與螢火蟲聚集點(篝火場、古樹、苔泉)
        const pz = this.natureZones['park'];
        this._deer = pz ? [{ x: pz.x + 3.5, y: pz.y + 3.6, flip: false }, { x: pz.x + 5.4, y: pz.y + 2.3, flip: true }] : [];
        this._fireflySpots = [];
        for (const id of ['town_square', 'chapel', 'well', 'park']) {
            const z = this.buildingZones[id] || this.natureZones[id];
            if (z) this._fireflySpots.push({ x: (z.x + z.w / 2) * TILE, y: (z.y + z.h / 2) * TILE, r: Math.max(z.w, z.h) * TILE * 0.7 });
        }
    }

    // 篝火場:土地圓圈、周圍一圈木樁長凳,中央火堆(白天畫柴堆,夜裡 _renderCampfires 會燒起來)
    _placeCampCircle(locId, x, y, name) {
        const W = 10, H = 8, cx = x + 4.5, cy = y + 3.5;
        for (let dy = 0; dy < H; dy++) for (let dx = 0; dx < W; dx++) {
            const d = ((dx - 4.5) * (dx - 4.5)) / 20 + ((dy - 3.5) * (dy - 3.5)) / 12;
            if (d < 1) this.grid[y + dy][x + dx] = (dx + dy) % 3 === 0 ? T.DIRT : T.STONE_PATH;
            else if (d < 1.5) this.grid[y + dy][x + dx] = T.GRASS2;
        }
        const seats = [[1, 2], [8, 2], [1, 5], [8, 5], [4, 0], [5, 7]];
        for (const [sx, sy] of seats) this.grid[y + sy][x + sx] = T.CHAIR;
        this.grid[y + 3][x + 4] = T.DIRT; this.grid[y + 3][x + 5] = T.DIRT; this.grid[y + 4][x + 4] = T.DIRT; this.grid[y + 4][x + 5] = T.DIRT;
        this._firePit = { x: (x + 5) * TILE, y: (y + 4) * TILE };
        this.buildingZones[locId] = { x, y, w: W, h: H };
        this.labelPositions[locId] = { x: cx * TILE + 8, y: y * TILE - 4, name };
    }

    // 古樹祭壇:一棵佔 7x7 的巨木,樹前祭壇與一圈花
    _placeElderTree(locId, x, y, name) {
        const W = 7, H = 7;
        for (let dy = 0; dy < H; dy++) for (let dx = 0; dx < W; dx++) {
            if (y + dy >= this.rows || x + dx >= this.cols) continue;
            const d = Math.abs(dx - 3) + Math.abs(dy - 2.5);
            if (dy <= 4 && d <= 4.5) this.grid[y + dy][x + dx] = ((dx + dy) % 2 === 0) ? T.TREE_TOP : T.TREE_TOP2;
            else if (dy === 5 && dx >= 2 && dx <= 4) this.grid[y + dy][x + dx] = T.TREE_TRUNK;
            else this.grid[y + dy][x + dx] = ((dx * 3 + dy) % 3 === 0) ? T.FLOWER2 : T.GRASS2;
        }
        this.grid[y + H - 1][x + 3] = T.ALTAR;
        this.grid[y + H - 1][x + 2] = T.STONE_PATH; this.grid[y + H - 1][x + 4] = T.STONE_PATH;
        this._elderTree = { x: (x + 3.5) * TILE, y: (y + 5) * TILE };
        this._connectToRoad(x + 3, y + H);
        this.natureZones[locId] = { x, y, w: W, h: H };
        this.labelPositions[locId] = { x: (x + W / 2) * TILE, y: y * TILE - 4, name };
    }

    // 伐木場:樹樁、堆起來的原木(用木桶格表現)、木箱與一間工寮
    _placeLumberYard(locId, x, y, name) {
        const shed = TILE_BUILDING_TEMPLATES.farm_building;
        for (let rx = 0; rx < shed.w; rx++) this.grid[y][x + rx] = T.ROOF2;
        for (let ty = 0; ty < shed.h; ty++) for (let tx = 0; tx < shed.w; tx++) {
            if (y + ty + 1 < this.rows) this.grid[y + ty + 1][x + tx] = shed.tiles[ty][tx];
        }
        const yy = y + shed.h + 1;
        for (let dx = 0; dx < 8; dx++) {
            if (yy + 1 < this.rows) this.grid[yy + 1][x + dx] = (dx % 3 === 1) ? T.TREE_TRUNK : T.GRASS3;
            if (yy + 2 < this.rows) this.grid[yy + 2][x + dx] = (dx < 5) ? T.BARREL : (dx === 6 ? T.CRATE : T.GRASS2);
        }
        this.grid[y + 1][x + 6] = T.CRATE; this.grid[y + 2][x + 6] = T.BARREL; this.grid[y + 2][x + 7] = T.BARREL;
        this._connectToRoad(x + shed.doorX, yy);
        this.buildingZones[locId] = { x, y, w: 8, h: shed.h + 4, doorPixelX: (x + shed.doorX + 0.5) * TILE, doorPixelY: (yy + 0.5) * TILE };
        this.labelPositions[locId] = { x: (x + 4) * TILE, y: y * TILE - 4, name };
    }

    // v5.77.0 林間道具:篝火柴堆、古樹氣根與樹洞、守林高塔、林間的鹿、飄落的葉子
    _layoutMountain(locations) {
        const cols = this.cols, rows = this.rows;
        const WALL_H = 7; // 山壁佔 0..6 列
        // 山壁:岩石,頂上兩列積雪,底緣零星碎岩
        for (let y = 0; y < WALL_H; y++) {
            for (let x = 0; x < cols; x++) {
                const h = ((x * 31 + y * 17) % 7);
                this.grid[y][x] = (y <= 1 || (y === 2 && h < 3)) ? T.SNOW : T.ROCK;
            }
        }
        for (let x = 0; x < cols; x += 1) {
            const h = (x * 13) % 5;
            if (h === 0) this.grid[WALL_H][x] = T.ROCK;
            else if (h === 2) this.grid[WALL_H][x] = T.BUSH;
        }
        // 左右與南側邊界樹
        for (let y = WALL_H; y < rows; y++) {
            for (let dx = 0; dx < 2; dx++) {
                this.grid[y][dx] = (y + dx) % 2 === 0 ? T.TREE_TOP : T.TREE_TOP2;
                this.grid[y][cols - 1 - dx] = (y + dx) % 2 === 0 ? T.TREE_TOP : T.TREE_TOP2;
            }
        }
        for (let x = 0; x < cols; x++) {
            for (let dy = 0; dy < 3; dy++) this.grid[rows - 1 - dy][x] = ((x + dy) % 2 === 0) ? T.TREE_TOP2 : T.TREE_TOP;
        }
        // 碎石路(座標與邊境鎮相同,_connectToRoad 共用)
        const roadY1 = 20, roadY2 = 38, roadX1 = 26, roadX2 = 46;
        for (let x = 3; x < cols - 2; x++) {
            this.grid[roadY1][x] = T.GRAVEL; this.grid[roadY1 + 1][x] = T.GRAVEL;
            this.grid[roadY2][x] = T.GRAVEL; this.grid[roadY2 + 1][x] = T.GRAVEL;
        }
        for (let y = WALL_H + 1; y < rows - 3; y++) {
            this.grid[y][roadX1] = T.GRAVEL; this.grid[y][roadX1 + 1] = T.GRAVEL;
            this.grid[y][roadX2] = T.GRAVEL; this.grid[y][roadX2 + 1] = T.GRAVEL;
        }
        // 礦車廣場石板
        for (let y = 22; y < 30; y++) for (let x = 30; x < 40; x++) this.grid[y][x] = T.STONE_PATH;
        // 裂谷:x 60–62,從山壁底一路到南邊界;兩條大路上架吊橋
        const CH_X0 = 60, CH_X1 = 62;
        for (let y = WALL_H; y < rows - 3; y++) for (let x = CH_X0; x <= CH_X1; x++) this.grid[y][x] = T.CHASM;
        for (const ry of [roadY1, roadY2]) for (let x = CH_X0; x <= CH_X1; x++) { this.grid[ry][x] = T.BRIDGE; this.grid[ry + 1][x] = T.BRIDGE; }
        this._ropeBridges = [{ x: CH_X0, y: roadY1, w: 3, h: 2 }, { x: CH_X0, y: roadY2, w: 3, h: 2 }];
        // 固定地標:主礦坑鑿進山壁 + 軌道鋪到廣場旁(不論 quarry 地點是否存在都畫)
        this._placeMineEntrance(38, 2);
        this._rails = { x: 41, y0: WALL_H, y1: 31 };
        for (let y = WALL_H; y <= 31; y++) { this.grid[y][41] = T.RAIL; this.grid[y][42] = T.RAIL; }
        this.grid[32][41] = T.CRATE; this.grid[32][42] = T.BARREL; // 礦車終點的卸礦區

        const POS = {
            town_square:  { x:32, y:24, type:'square' },
            tavern:       { x:18, y:22, type:'building' },
            chapel:       { x:34, y:40, type:'building' },
            park:         { x:6,  y:22, type:'hotspring' },
            well:         { x:36, y:32, type:'well' },
            town_hall:    { x:28, y:10, type:'building' },
            farm:         { x:6,  y:40, type:'farm' },
            quarry:       { x:38, y:2,  type:'mine_zone' },
            workshop:     { x:50, y:28, type:'building' },
            general_store:{ x:50, y:11, type:'building' },
            clinic:       { x:6,  y:30, type:'building' },
            library:      { x:64, y:10, type:'building' },
            guardpost:    { x:64, y:42, type:'building' },
            residential_north:{ x:5,  y:8,  type:'house_row' },
            residential_south:{ x:16, y:42, type:'house_cluster' },
            residential_east: { x:64, y:24, type:'house_cluster' },
            forest:  { x:52, y:40, type:'forest' },
            river:   { x:36, y:50, type:'river' },
            hill:    { x:71, y:42, type:'hill' },
            cave:    { x:70, y:49, type:'cave' },
            lake:    { x:48, y:48, type:'lake' },
            meadow:  { x:28, y:50, type:'meadow' },
        };
        for (const [locId, loc] of Object.entries(locations)) {
            const fp = POS[locId];
            if (!fp) continue;
            const bx = fp.x, by = fp.y, name = loc.name;
            switch (fp.type) {
                case 'building': this._placeBuilding(locId, bx, by, name); break;
                case 'house_cluster': this._placeHouseCluster(locId, bx, by, name); break;
                case 'house_row': this._placeHouseRow(locId, bx, by, name, 3); break;
                case 'farm': this._placeFarm(locId, bx, by, name); break;
                case 'square': this._placeSquare(locId, bx, by, name); break;
                case 'well': this._placeWell(locId, bx, by, name); break;
                case 'hotspring': this._placeHotSpring(locId, bx, by, name); break;
                case 'forest': this._placeForest(locId, bx, by, name); break;
                case 'river': this._placeRiver(locId, bx, by, name); break;
                case 'hill': this._placeHill(locId, bx, by, name); break;
                case 'cave': this._placeCave(locId, bx, by, name); break;
                case 'lake': this._placeLake(locId, bx, by, name); break;
                case 'meadow': this._placeMeadow(locId, bx, by, name); break;
                case 'mine_zone':
                    this.buildingZones[locId] = { x: 38, y: 1, w: 8, h: 6, doorPixelX: 41.5 * TILE + 8, doorPixelY: (WALL_H + 0.5) * TILE };
                    this.labelPositions[locId] = { x: 42 * TILE, y: 1 * TILE + 10, name };
                    break;
            }
        }
        // 熔爐鍛坊與礦燈酒館的煙囪(動態冒煙)
        this._chimneys = [];
        const ws = this.buildingZones['workshop'], tv = this.buildingZones['tavern'];
        if (ws) this._chimneys.push({ x: (ws.x + ws.w - 2) * TILE + 4, y: ws.y * TILE + 2, hot: true });
        if (tv) this._chimneys.push({ x: (tv.x + 2) * TILE + 4, y: tv.y * TILE + 2, hot: false });
        // 馬車站:東側大路盡頭(吊橋過去)
        this.coachStation = { x: this.cols - 7, y: 18, w: 5, h: 5 };
        // 草地點綴(山地多石少花)
        for (let i = 0; i < 30; i++) {
            const x = 3 + ((i * 17 + 7) % (cols - 6));
            const y = WALL_H + 2 + ((i * 13 + 11) % (rows - WALL_H - 6));
            const g = this.grid[y][x];
            if (g === T.GRASS || g === T.GRASS2 || g === T.GRASS3) this.grid[y][x] = [T.ROCK, T.BUSH, T.ROCK, T.FLOWER2][i % 4];
        }
    }

    // 主礦坑:山壁上鑿出的黑洞,木框門楣與礦燈在 render 時動態畫
    _placeMineEntrance(x, y) {
        for (let yy = y + 1; yy <= 6; yy++) for (let xx = x + 1; xx <= x + 6; xx++) this.grid[yy][xx] = T.DARK_FLOOR;
        for (let xx = x; xx <= x + 7; xx++) this.grid[y][xx] = T.ROCK;
        this.grid[6][x + 1] = T.ROCK; this.grid[6][x + 6] = T.ROCK;
        this._mine = { x, y, w: 8, h: 6 };
    }

    // 山泉浴場:岩石圍成的溫泉池,池邊木桶與長凳,蒸氣在 render 時動態畫
    _placeHotSpring(locId, x, y, name) {
        const W = 7, H = 6;
        for (let dy = 0; dy < H; dy++) for (let dx = 0; dx < W; dx++) {
            if (y + dy >= this.rows || x + dx >= this.cols) continue;
            const edge = dx === 0 || dy === 0 || dx === W - 1 || dy === H - 1;
            if (edge) this.grid[y + dy][x + dx] = ((dx + dy) % 3 === 0) ? T.ROCK : T.STONE_PATH;
            else this.grid[y + dy][x + dx] = ((dx + dy) % 2 === 0) ? T.WATER : T.WATER2;
        }
        this.grid[y + H - 1][x + 1] = T.BARREL; this.grid[y + H - 1][x + W - 2] = T.CHAIR;
        this.grid[y + H - 1][x + 3] = T.STONE_PATH; // 入口
        this._hotSpring = { x: x + 1, y: y + 1, w: W - 2, h: H - 2 };
        this.natureZones[locId] = { x, y, w: W, h: H };
        this.labelPositions[locId] = { x: (x + W / 2) * TILE, y: y * TILE - 4, name };
    }

    // v5.76.0 山地道具:礦坑門楣與礦燈、來回跑的礦車、煙囪炊煙、溫泉蒸氣、吊橋繩索
    _harborCoastY(x) {
        // 海岸線:西側與中段在第 51 列,東側往北斜切成海灣(每格升 1 列),最高到第 35 列
        return x <= 63 ? 51 : Math.max(35, 51 - (x - 63));
    }

    _layoutHarbor(locations) {
        const cols = this.cols, rows = this.rows;
        const coast = (x) => this._harborCoastY(x);
        // 海面 + 沙灘帶(海岸線上方 2 列沙,海岸線以下為水,再往南 3 列轉深水)
        for (let x = 0; x < cols; x++) {
            const cy = coast(x);
            for (let y = cy - 2; y < rows; y++) {
                if (y < 0) continue;
                if (y < cy) this.grid[y][x] = T.SAND;
                else if (y < cy + 3) this.grid[y][x] = T.WATER;
                else this.grid[y][x] = ((x + y) % 3 === 0) ? T.WATER : T.WATER2;
            }
        }
        // 邊界樹:只有北側與左右兩側(到沙灘為止),南側沒有樹、直接是海
        for (let x = 0; x < cols; x++) {
            for (let dy = 0; dy < 3; dy++) this.grid[dy][x] = ((x + dy) % 2 === 0) ? T.TREE_TOP : T.TREE_TOP2;
        }
        for (let y = 3; y < rows; y++) {
            for (let dx = 0; dx < 2; dx++) {
                if (y < coast(dx) - 2) this.grid[y][dx] = (y + dx) % 2 === 0 ? T.TREE_TOP : T.TREE_TOP2;
                const rx = cols - 1 - dx;
                if (y < coast(rx) - 2) this.grid[y][rx] = (y + dx) % 2 === 0 ? T.TREE_TOP : T.TREE_TOP2;
            }
        }
        // 道路:橫向兩條(遇海灣就停),直向兩條只鋪到沙灘上緣
        const roadY1 = 20, roadY2 = 38, roadX1 = 26, roadX2 = 46;
        for (let x = 3; x < cols - 2; x++) {
            for (const ry of [roadY1, roadY2]) {
                if (ry + 1 < coast(x) - 3) { this.grid[ry][x] = T.DIRT; this.grid[ry + 1][x] = T.DIRT; }
            }
        }
        for (let y = 3; y < 49; y++) {
            this.grid[y][roadX1] = T.DIRT; this.grid[y][roadX1 + 1] = T.DIRT;
            this.grid[y][roadX2] = T.DIRT; this.grid[y][roadX2 + 1] = T.DIRT;
        }
        // 碼頭廣場石板
        for (let y = 22; y < 30; y++) for (let x = 30; x < 40; x++) this.grid[y][x] = T.STONE_PATH;

        // 固定地標(不論該地點是否存在都畫):棧橋、燈塔岬、海蝕洞岩
        this._placePier(42, 49);
        this._placeLighthousePoint(69, 41);
        this._placeSeaCaveRocks(2, 45);

        const POS = {
            town_square:  { x:32, y:24, type:'square' },
            tavern:       { x:18, y:22, type:'building' },
            chapel:       { x:50, y:14, type:'building' },
            park:         { x:6,  y:22, type:'netyard' },
            well:         { x:36, y:32, type:'well' },
            town_hall:    { x:42, y:3,  type:'building' }, // 不再壓住崖上人家第二排,四戶全露出
            farm:         { x:9,  y:40, type:'farm' },
            quarry:       { x:62, y:41, type:'saltworks' },
            workshop:     { x:50, y:28, type:'building' },
            general_store:{ x:18, y:12, type:'building' },
            clinic:       { x:6,  y:30, type:'building' },
            library:      { x:62, y:14, type:'building' },
            guardpost:    { x:6,  y:10, type:'building' },
            residential_north:{ x:28, y:3,  type:'house_cluster' },
            residential_south:{ x:19, y:41, type:'house_row' },
            residential_east: { x:60, y:24, type:'house_cluster' },
            forest:  { x:70, y:4,  type:'forest' },
            river:   { x:42, y:49, type:'pier_zone' },
            hill:    { x:69, y:41, type:'lighthouse_zone' },
            cave:    { x:2,  y:45, type:'seacave_zone' },
            lake:    { x:54, y:41, type:'lake' },
            meadow:  { x:48, y:41, type:'saltflat' },
        };
        for (const [locId, loc] of Object.entries(locations)) {
            const fp = POS[locId];
            if (!fp) continue;
            const bx = fp.x, by = fp.y, name = loc.name;
            switch (fp.type) {
                case 'building': this._placeBuilding(locId, bx, by, name); break;
                case 'house_cluster': this._placeHouseCluster(locId, bx, by, name); break;
                case 'house_row': this._placeHouseRow(locId, bx, by, name, 4, false); break; // 沙灘木屋面海,不另闢小路
                case 'farm': this._placeFarm(locId, bx, by, name); break;
                case 'saltworks': this._placeSaltworks(locId, bx, by, name); break;
                case 'square': this._placeSquare(locId, bx, by, name); break;
                case 'well': this._placeWell(locId, bx, by, name); break;
                case 'netyard': this._placeNetYard(locId, bx, by, name); break;
                case 'forest': this._placeForest(locId, bx, by, name); break;
                case 'lake': this._placeLake(locId, bx, by, name); break;
                case 'saltflat': this._placeSaltFlat(locId, bx, by, name); break;
                case 'pier_zone':
                    this.natureZones[locId] = { x: 42, y: 47, w: 11, h: 11 };
                    this.labelPositions[locId] = { x: 47.5 * TILE, y: 48 * TILE - 4, name };
                    break;
                case 'lighthouse_zone':
                    this.natureZones[locId] = { x: 69, y: 41, w: 8, h: 9 };
                    this.labelPositions[locId] = { x: 73 * TILE, y: 41 * TILE - 4, name };
                    break;
                case 'seacave_zone':
                    this.natureZones[locId] = { x: 2, y: 45, w: 6, h: 5 };
                    this.labelPositions[locId] = { x: 5 * TILE, y: 45 * TILE - 4, name };
                    break;
            }
        }
        // 馬車站:西側沿海道路盡頭(馬頭朝西,往邊境鎮)
        this.coachStation = { x: 2, y: 17, w: 5, h: 5 };
        // 漁船(格座標,動態繪製、不進 grid)
        this._boats = [
            { x: 43.5, y: 52.6, phase: 0.0, sail: true },
            { x: 50.2, y: 53.2, phase: 2.1, sail: true },
            { x: 46.0, y: 58.1, phase: 4.2, sail: false },
            { x: 62.0, y: 56.5, phase: 1.3, sail: true },
        ];
        // 草地點綴(只落在草上,沙灘與海面不受影響)
        for (let i = 0; i < 30; i++) {
            const x = 3 + ((i * 17 + 7) % (cols - 6));
            const y = 4 + ((i * 13 + 11) % (rows - 8));
            const g = this.grid[y][x];
            if (g === T.GRASS || g === T.GRASS2 || g === T.GRASS3) this.grid[y][x] = [T.FLOWER1, T.FLOWER2, T.BUSH, T.ROCK][i % 4];
        }
    }

    // 棧橋:從沙灘直直伸進海裡,末端橫向 T 字頭,木樁在 render 時動態畫
    _placePier(x, y) {
        const stemX = 46, stemW = 3, stemY0 = 49, stemY1 = 57;
        for (let yy = stemY0; yy <= stemY1; yy++) for (let dx = 0; dx < stemW; dx++) this.grid[yy][stemX + dx] = T.PIER;
        for (let yy = 55; yy <= 56; yy++) for (let xx = 42; xx <= 52; xx++) this.grid[yy][xx] = T.PIER;
        // 沙灘上的小棧橋口:木箱與漁獲桶
        this.grid[48][44] = T.CRATE; this.grid[48][50] = T.BARREL;
        this._pier = { x: 42, y: 49, w: 11, h: 9, stemX, stemW, stemY0, stemY1, headY: 55 };
    }

    // 燈塔岬:岩石伸進海灣,燈塔本體與夜間光束在 render 時動態畫
    _placeLighthousePoint(x, y) {
        for (let yy = 44; yy <= 49; yy++) for (let xx = 70; xx <= 75; xx++) this.grid[yy][xx] = T.ROCK;
        for (let yy = 42; yy <= 43; yy++) for (let xx = 69; xx <= 72; xx++) this.grid[yy][xx] = T.ROCK;
        this.grid[41][69] = T.SAND; this.grid[41][70] = T.SAND; this.grid[41][71] = T.SAND;
        this.grid[45][72] = T.STONE_PATH; this.grid[44][72] = T.STONE_PATH; this.grid[43][72] = T.STONE_PATH; // 上塔的小徑
        this._lighthouse = { tx: 73, ty: 46 };
    }

    // 海蝕洞:西岸一叢黑岩,洞口朝海
    _placeSeaCaveRocks(x, y) {
        for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 6; dx++) this.grid[y + dy][x + dx] = T.ROCK;
        this.grid[y + 3][x + 2] = T.DARK_FLOOR; this.grid[y + 3][x + 3] = T.DARK_FLOOR;
        this.grid[y + 4][x + 2] = T.DARK_FLOOR; this.grid[y + 4][x + 3] = T.DARK_FLOOR;
    }

    // 一整排沙灘木屋(門朝南、面向大海),每戶註冊成子區與 house_cluster 相同
    _placeHouseRow(locId, x, y, name, count, connect = true) {
        const house = TILE_BUILDING_TEMPLATES.house;
        const gapX = 1;
        this._houseSubZones = this._houseSubZones || {};
        let houseIdx = 0;
        for (let i = 0; i < count; i++) {
            const hx = x + i * (house.w + gapX), hy = y;
            if (hx + house.w >= this.cols || hy + house.h + 1 >= this.rows) continue;
            for (let rx = 0; rx < house.w; rx++) this.grid[hy][hx + rx] = T.ROOF;
            for (let ty = 0; ty < house.h; ty++) for (let tx = 0; tx < house.w; tx++) this.grid[hy + ty + 1][hx + tx] = house.tiles[ty][tx];
            const doorTX = hx + house.doorX, doorTY = hy + house.h + 1;
            for (let ddy = 0; ddy <= 1; ddy++) for (let ddx = -1; ddx <= 1; ddx++) {
                const cx = doorTX + ddx, cy = doorTY + ddy;
                if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) continue;
                const tt = this.grid[cy][cx];
                if (tt === T.GRASS || tt === T.GRASS2 || tt === T.GRASS3) this.grid[cy][cx] = T.DIRT;
            }
            if (connect) this._connectToRoad(doorTX, doorTY);
            const subId = `${locId}_${houseIdx}`;
            const doorPxX = (doorTX + 0.5) * TILE, doorPxY = (doorTY + 0.5) * TILE;
            const interiorX = (hx + house.w / 2) * TILE, interiorY = (hy + house.h / 2 + 1) * TILE;
            this._houseSubZones[subId] = { x: hx, y: hy, w: house.w, h: house.h + 1, doorPixelX: doorPxX, doorPixelY: doorPxY, interiorX, interiorY, parentLocId: locId, houseIndex: houseIdx };
            this.buildingZones[subId] = { x: hx, y: hy, w: house.w, h: house.h + 1, doorPixelX: doorPxX, doorPixelY: doorPxY, parentLocId: locId };
            houseIdx++;
        }
        // 屋前一條木板步道連到沙灘
        const walkY = y + house.h + 1;
        const totalW = count * house.w + (count - 1) * gapX;
        for (let px = 0; px < totalW; px++) if (walkY < this.rows && x + px < this.cols) this.grid[walkY][x + px] = T.STONE_PATH;
        this.buildingZones[locId] = { x, y, w: totalW, h: house.h + 2 };
        this.labelPositions[locId] = { x: (x + totalW / 2) * TILE, y: y * TILE - 4, name };
    }

    // 曬網場:一排排木樁撐起漁網,角落堆魚簍
    _placeNetYard(locId, x, y, name) {
        const W = 7, H = 6;
        for (let dy = 0; dy < H; dy++) for (let dx = 0; dx < W; dx++) {
            if (y + dy >= this.rows || x + dx >= this.cols) continue;
            const inner = dx >= 1 && dx <= W - 2;
            if ((dy === 1 || dy === 3) && inner) this.grid[y + dy][x + dx] = T.NET;
            else this.grid[y + dy][x + dx] = (dx + dy) % 3 === 0 ? T.GRASS3 : T.GRASS2;
        }
        this.grid[y + H - 1][x] = T.BARREL; this.grid[y + H - 1][x + 1] = T.CRATE;
        this.grid[y][x + W - 1] = T.CRATE; this.grid[y + H - 1][x + W - 1] = T.BARREL;
        this.grid[y + 5][x + 3] = T.STONE_PATH;
        this.natureZones[locId] = { x, y, w: W, h: H };
        this.labelPositions[locId] = { x: (x + W / 2) * TILE, y: y * TILE - 4, name };
    }

    // 鹽場:工寮 + 一片片結晶鹽池
    _placeSaltworks(locId, x, y, name) {
        const shed = TILE_BUILDING_TEMPLATES.farm_building;
        for (let rx = 0; rx < shed.w; rx++) this.grid[y][x + rx] = T.ROOF2;
        for (let ty = 0; ty < shed.h; ty++) for (let tx = 0; tx < shed.w; tx++) {
            if (y + ty + 1 < this.rows) this.grid[y + ty + 1][x + tx] = shed.tiles[ty][tx];
        }
        this.grid[y + 1][x + 6] = T.BARREL; this.grid[y + 2][x + 6] = T.BARREL; this.grid[y + 1][x + 7] = T.CRATE;
        const py = y + shed.h + 1;
        for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 7; dx++) {
            if (py + dy < this.rows && x + dx < this.cols) this.grid[py + dy][x + dx] = T.SALT;
        }
        this.grid[py][x + shed.doorX] = T.DIRT; // 門前留一格土,不要踩進鹽池
        this._connectToRoad(x + shed.doorX, y + shed.h + 1);
        this.buildingZones[locId] = { x, y, w: 8, h: shed.h + 4, doorPixelX: (x + shed.doorX + 0.5) * TILE, doorPixelY: (py + 0.5) * TILE };
        this.labelPositions[locId] = { x: (x + 4) * TILE, y: y * TILE - 4, name };
    }

    // 鹽灘:天然結晶鹽與沙交錯,點綴幾顆礁石
    _placeSaltFlat(locId, x, y, name) {
        const W = 6, H = 5;
        for (let dy = 0; dy < H; dy++) for (let dx = 0; dx < W; dx++) {
            if (y + dy >= this.rows || x + dx >= this.cols) continue;
            const r = (dx * 3 + dy * 7 + dx * dy) % 7;
            this.grid[y + dy][x + dx] = r < 4 ? T.SALT : r === 4 ? T.SAND : T.SALT;
        }
        this.grid[y + 1][x + 1] = T.ROCK; this.grid[y + 3][x + 4] = T.ROCK;
        this.natureZones[locId] = { x, y, w: W, h: H };
        this.labelPositions[locId] = { x: (x + W / 2) * TILE, y: y * TILE - 4, name };
    }

    // v5.75.0 海岸道具:棧橋木樁、漁船(隨浪起伏)、燈塔本體
    _connectToRoad(doorX, doorY) {
        // Draw a short dirt path from doorway toward nearest road
        const roadY1 = 20, roadY2 = 38, roadX1 = 26, roadX2 = 46;
        // Find closest road
        let targetY = doorY, targetX = doorX;
        const distToHRoad1 = Math.abs(doorY - roadY1);
        const distToHRoad2 = Math.abs(doorY - roadY2);
        const distToVRoad1 = Math.abs(doorX - roadX1);
        const distToVRoad2 = Math.abs(doorX - roadX2);
        const minDist = Math.min(distToHRoad1, distToHRoad2, distToVRoad1, distToVRoad2);

        if (minDist === distToHRoad1 || minDist === distToHRoad2) {
            targetY = minDist === distToHRoad1 ? roadY1 : roadY2;
            const dy = targetY > doorY ? 1 : -1;
            for (let y = doorY; y !== targetY; y += dy) {
                if (y >= 0 && y < this.rows && doorX < this.cols) {
                    if (this.grid[y][doorX] === T.GRASS || this.grid[y][doorX] === T.GRASS2 || this.grid[y][doorX] === T.GRASS3) {
                        this.grid[y][doorX] = T.DIRT;
                    }
                }
            }
        } else {
            targetX = minDist === distToVRoad1 ? roadX1 : roadX2;
            const dx = targetX > doorX ? 1 : -1;
            for (let x = doorX; x !== targetX; x += dx) {
                if (doorY >= 0 && doorY < this.rows && x >= 0 && x < this.cols) {
                    if (this.grid[doorY][x] === T.GRASS || this.grid[doorY][x] === T.GRASS2 || this.grid[doorY][x] === T.GRASS3) {
                        this.grid[doorY][x] = T.DIRT;
                    }
                }
            }
        }
    }

    // Assign an agent to a specific house sub-zone within their residential area
    getAgentHouseId(agentId, homeLocation) {
        if (!this._houseSubZones || !homeLocation || !homeLocation.startsWith('residential_')) return null;
        // Find sub-zones for this residential area
        const subIds = Object.keys(this._houseSubZones).filter(k => this._houseSubZones[k].parentLocId === homeLocation);
        if (subIds.length === 0) return null;
        // Use persistent mapping
        if (!this._agentHouseMap) this._agentHouseMap = {};
        // v5.62.0 夫妻同住:配偶(已婚,由 app 傳入 agentPartners)已有房就搬進同一間,
        // 婚後也會自動團圓(id 較大的一方遷就搬家)
        const partner = this.agentPartners?.[agentId];
        if (partner && this._agentHouseMap[partner]) {
            const ph = this._agentHouseMap[partner];
            if (!this._agentHouseMap[agentId] || (this._agentHouseMap[agentId] !== ph && String(agentId) > String(partner))) {
                this._agentHouseMap[agentId] = ph;
            }
        }
        if (this._agentHouseMap[agentId]) return this._agentHouseMap[agentId];
        // v5.62.0 沒結婚的不再被塞同一間:優先找沒人住的空屋——先在自家區找,
        // 不夠再跨區(含加蓋的 residential_extra 小屋),全鎮真的客滿才回到
        // 舊制「人最少的那間」擠一擠
        const occupied = new Set(Object.values(this._agentHouseMap));
        let target = subIds.find(id => !occupied.has(id));
        if (!target) target = Object.keys(this._houseSubZones).find(id => !occupied.has(id));
        if (!target) {
            const houseCounts = {};
            subIds.forEach(id => houseCounts[id] = 0);
            Object.values(this._agentHouseMap).forEach(hid => { if (houseCounts[hid] !== undefined) houseCounts[hid]++; });
            target = subIds.reduce((a, b) => (houseCounts[a] <= houseCounts[b] ? a : b));
        }
        this._agentHouseMap[agentId] = target;
        return target;
    }

    // v5.62.0 加蓋住宅:房間數(夫妻一間、其他人各一間)不足時,在空地上補單棟小屋
    ensureHouseCapacity(needed) {
        if (!this.grid || !this._houseSubZones) return;
        let have = Object.keys(this._houseSubZones).length;
        if (have >= needed) return;
        const house = TILE_BUILDING_TEMPLATES.house;
        const HW = house.w + 2, HH = house.h + 4; // 含門前空地與邊距
        const plots = this._getFactoryPlots ? this._getFactoryPlots() : [];
        const rects = [
            ...Object.values(this.buildingZones || {}).map(z => ({ x: z.x, y: z.y, w: z.w || 4, h: z.h || 4 })),
            ...plots,
            ...(this.constructionSites || []).map(p => ({ x: p.siteX, y: p.siteY, w: 2, h: 2 })),
            ...(this.sitedCompleted || []).map(b => ({ x: b.siteX, y: b.siteY, w: 2, h: 2 })),
            ...(this.decorations || []).map(d => ({ x: d.x, y: d.y, w: 1, h: 1 })),
        ];
        if (this.coachStation) rects.push(this.coachStation);
        if (this.themeKey !== 'frontier') for (const z of Object.values(this.natureZones || {})) rects.push(z); // v5.75.0 主題鎮地標不蓋房
        else if (this.natureZones?.graveyard) rects.push(this.natureZones.graveyard); // v6.85.0 墓園不蓋房
        const blockedRect = (px, py) => rects.some(z =>
            px + HW + 1 > z.x && px - 1 < z.x + z.w && py + HH + 1 > z.y && py - 1 < z.y + z.h);
        const tilesClear = (px, py) => {
            for (let y = py - 1; y < py + HH + 1; y++) {
                for (let x = px - 1; x < px + HW + 1; x++) {
                    if (y < 1 || x < 1 || y >= this.rows - 1 || x >= this.cols - 1) return false;
                    const tt = this.grid[y][x];
                    if (tt === T.DIRT || tt === T.WATER || tt === T.WATER2 || tt === T.PIER || tt === T.SALT || tt === T.NET || tt === T.GRAVEL || tt === T.CHASM || tt === T.RAIL) return false;
                }
            }
            return true;
        };
        for (let y = 2; y < this.rows - HH - 2 && have < needed; y += 2) {
            for (let x = 2; x < this.cols - HW - 2 && have < needed; x += 2) {
                if (blockedRect(x, y) || !tilesClear(x, y)) continue;
                this._placeExtraHouse(x + 1, y + 1);
                rects.push({ x, y, w: HW, h: HH });
                have++;
            }
        }
        // v5.81.0 第二輪:嚴格掃描補不夠(主題鎮地圖密、地標多)就放寬——不留外圍邊距、逐格掃、
        // 只避開道路/水/地標地磚/建築/牆/作物,樹與草可以蓋(視為清出一塊地)
        if (have < needed) {
            const HW2 = house.w + 1, HH2 = house.h + 3;
            const BAD2 = new Set([T.DIRT, T.WATER, T.WATER2, T.PIER, T.SALT, T.NET, T.GRAVEL, T.CHASM, T.RAIL, T.SNOW, T.ROCK, T.DARK_FLOOR,
                T.WALL_TOP, T.WALL_FRONT, T.ROOF, T.ROOF2, T.FLOOR, T.FLOOR2, T.DOOR, T.WINDOW, T.STONE_PATH, T.BRIDGE, T.SAND,
                T.CROP1, T.CROP2, T.CROP3, T.FENCE_H, T.FENCE_V, T.WELL, T.ALTAR, T.STALL, T.BARREL, T.CRATE, T.CHAIR, T.TABLE, T.FURNACE]);
            // 工廠地基只有前 N 塊(N = 工廠種類數)會真的蓋工廠,後面的預留地基可以讓給房子
            const maxFactories = (typeof FACTORIES !== 'undefined') ? Object.keys(FACTORIES).length : 7;
            const reservedPlots = new Set(plots.slice(0, maxFactories));
            const rects2 = rects.filter(z => !plots.includes(z) || reservedPlots.has(z));
            const blocked2 = (px, py) => rects2.some(z => px + HW2 > z.x && px < z.x + z.w && py + HH2 > z.y && py < z.y + z.h);
            const clear2 = (px, py) => {
                for (let y = py; y < py + HH2; y++) for (let x = px; x < px + HW2; x++) {
                    if (y < 1 || x < 1 || y >= this.rows - 1 || x >= this.cols - 1) return false;
                    if (BAD2.has(this.grid[y][x])) return false;
                }
                return true;
            };
            for (let y = 2; y < this.rows - HH2 - 1 && have < needed; y++) {
                for (let x = 2; x < this.cols - HW2 - 1 && have < needed; x++) {
                    if (blocked2(x, y) || !clear2(x, y)) continue;
                    this._placeExtraHouse(x, y);
                    const hr = { x, y, w: HW2, h: HH2 };
                    rects.push(hr); rects2.push(hr);
                    have++;
                }
            }
            // 被房子佔掉的預留地基從清單移除(只會是後段、永遠不會蓋工廠的那幾塊),空地基虛線框不再畫在房子底下
            if (Array.isArray(this._factoryPlots)) {
                const houses = Object.values(this._houseSubZones || {});
                this._factoryPlots = this._factoryPlots.filter(pl => !houses.some(h => pl.x < h.x + h.w && pl.x + pl.w > h.x && pl.y < h.y + h.h && pl.y + pl.h > h.y));
            }
        }
    }

    _placeExtraHouse(hx, hy) {
        const house = TILE_BUILDING_TEMPLATES.house;
        if (hx + house.w >= this.cols || hy + house.h + 1 >= this.rows) return;
        const idx = this._extraHouseCount = (this._extraHouseCount || 0) + 1;
        for (let rx = 0; rx < house.w; rx++) this.grid[hy][hx + rx] = T.ROOF;
        for (let ty = 0; ty < house.h; ty++) {
            for (let tx = 0; tx < house.w; tx++) {
                this.grid[hy + ty + 1][hx + tx] = house.tiles[ty][tx];
            }
        }
        const doorTX = hx + house.doorX, doorTY = hy + house.h + 1;
        for (let ddy = 0; ddy <= 1; ddy++) {
            for (let ddx = -1; ddx <= 1; ddx++) {
                const cx = doorTX + ddx, cy = doorTY + ddy;
                if (cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows) {
                    const tt = this.grid[cy][cx];
                    if (tt === T.GRASS || tt === T.GRASS2 || tt === T.GRASS3) this.grid[cy][cx] = T.DIRT;
                }
            }
        }
        this._connectToRoad(doorTX, doorTY);
        const subId = `residential_extra_${idx}`;
        const doorPxX = (doorTX + 0.5) * TILE, doorPxY = (doorTY + 0.5) * TILE;
        this._houseSubZones[subId] = {
            x: hx, y: hy, w: house.w, h: house.h + 1,
            doorPixelX: doorPxX, doorPixelY: doorPxY,
            interiorX: (hx + house.w / 2) * TILE, interiorY: (hy + house.h / 2 + 1) * TILE,
            parentLocId: 'residential_extra', houseIndex: idx,
        };
        this.buildingZones[subId] = {
            x: hx, y: hy, w: house.w, h: house.h + 1,
            doorPixelX: doorPxX, doorPixelY: doorPxY, parentLocId: 'residential_extra',
        };
    }

    // Get residents of a specific house sub-zone
    getHouseResidents(houseSubId) {
        if (!this._agentHouseMap) return [];
        return Object.entries(this._agentHouseMap)
            .filter(([_, hid]) => hid === houseSubId)
            .map(([aid]) => aid);
    }

    // Get center position for a location (for agent placement)
    getLocationCenter(locId) {
        const zone = this.buildingZones[locId] || this.natureZones[locId];
        if (!zone) return { x: this.cols * TILE / 2, y: this.rows * TILE / 2 };
        return {
            x: (zone.x + zone.w / 2) * TILE,
            y: (zone.y + zone.h / 2) * TILE,
        };
    }

    // Draw completed buildings as pixel art decorations near related locations
    showCaravan(label) { this._caravanAnim = { t0: this.animFrame || 0, label: label || '' }; }
    _siteSnap(px, py) {
        const sp = this.sitePreview;
        const w = sp?.w || 2, h = sp?.h || 2;
        const tx = Math.round((px / TILE - w / 2) / 2) * 2;
        const ty = Math.round((py / TILE - h / 2) / 2) * 2;
        return { tx, ty };
    }

    _drawSitePreview(ctx) { } // v6.34.0 2D 繪圖已移除;Town3D 覆寫
    _getFactoryPlots() {
        if (this._factoryPlots) return this._factoryPlots;
        if (!this.grid || !this.grid.length) return [];
        const PW = 4, PH = 3; // 地基大小(格)
        const H = this.grid.length, W = this.grid[0].length;
        const zones = Object.values(this.buildingZones || {}).map(z => ({ x: z.x, y: z.y, w: z.w || 4, h: z.h || 4 }));
        // v5.60.1 地基也避開馬車站、玩家選址建築(施工中+完工)、裝飾——不再蓋在別人頭上
        if (this.coachStation) zones.push({ x: this.coachStation.x, y: this.coachStation.y, w: this.coachStation.w, h: this.coachStation.h });
        if (this.themeKey !== 'frontier') for (const z of Object.values(this.natureZones || {})) zones.push(z); // v5.75.0
        else if (this.natureZones?.graveyard) zones.push(this.natureZones.graveyard); // v6.85.0 墓園不蓋工廠
        for (const p of (this.constructionSites || [])) zones.push({ x: p.siteX, y: p.siteY, w: 2, h: 2 });
        for (const b of (this.sitedCompleted || [])) zones.push({ x: b.siteX, y: b.siteY, w: 2, h: 2 });
        for (const d of (this.decorations || [])) zones.push({ x: d.x, y: d.y, w: 1, h: 1 });
        const rectOverlap = (px, py) => zones.some(z =>
            px + PW + 1 > z.x && px - 1 < z.x + z.w && py + PH + 1 > z.y && py - 1 < z.y + z.h);
        const tilesClear = (px, py) => {
            for (let y = py - 1; y < py + PH + 1; y++) {
                for (let x = px - 1; x < px + PW + 1; x++) {
                    if (y < 1 || x < 1 || y >= H - 1 || x >= W - 1) return false;
                    const tt = this.grid[y][x];
                    if (tt === T.DIRT || tt === T.WATER || tt === T.WATER2 || tt === T.PIER || tt === T.SALT || tt === T.NET || tt === T.GRAVEL || tt === T.CHASM || tt === T.RAIL) return false;
                }
            }
            return true;
        };
        const anchor = this.buildingZones['workshop'] || this.buildingZones['town_square'] || { x: W >> 1, y: H >> 1, w: 4, h: 4 };
        const ax = anchor.x + (anchor.w || 4) / 2, ay = anchor.y + (anchor.h || 4) / 2;
        const cands = [];
        for (let y = 2; y < H - PH - 2; y += 2) {
            for (let x = 2; x < W - PW - 2; x += 2) {
                const cx = x + PW / 2, cy = y + PH / 2;
                cands.push([x, y, (cx - ax) * (cx - ax) + (cy - ay) * (cy - ay)]);
            }
        }
        cands.sort((a, b) => a[2] - b[2]);
        const plots = [];
        for (const [x, y] of cands) {
            if (plots.length >= 7) break;
            if (rectOverlap(x, y) || !tilesClear(x, y)) continue;
            plots.push({ x, y, w: PW, h: PH });
            zones.push({ x, y, w: PW, h: PH }); // 地基之間也不互相重疊
        }
        this._factoryPlots = plots;
        return plots;
    }

    // Draw factory foundations + buildings on reserved plots
    addConversationBubble(agentAId, agentBId, agentAName, agentBName, textA, textB) {
        if (!this._activeConvoBubbles) this._activeConvoBubbles = [];
        // Limit to 4 active bubbles max
        while (this._activeConvoBubbles.length >= 4) this._activeConvoBubbles.shift();
        this._activeConvoBubbles.push({
            expiry: Date.now() + 8000, // Show for 8 seconds
            bubbles: [
                { agentId: agentAId, speaker: agentAName, text: textA || '...' },
                { agentId: agentBId, speaker: agentBName, text: textB || '...' },
            ]
        });
    }

    // Check if a pixel position is inside a building zone
    // v6.33.0 查表版:每幀每位村民都會問好幾次,原本要掃所有小屋與建築;改成以格子為鍵記住答案,每 300 幀清一次(新建的房子最多慢 5 秒才算進去)
    _isInsideBuilding(px, py) {
        const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
        let lut = this._insideLUT;
        if (!lut || lut.grid !== this.grid || lut.sub !== this._houseSubZones || (this._insideLUTn = (this._insideLUTn || 0) + 1) > 300 * 30) { lut = this._insideLUT = { grid: this.grid, sub: this._houseSubZones, m: new Map() }; this._insideLUTn = 0; } // v6.54.0 各戶房子晚一步才建好,不能沿用舊的快取(會把人算成在整個住宅區,窗燈對不上)
        const k = ty * 4096 + tx; const hit = lut.m.get(k);
        if (hit !== undefined) return hit;
        const r = this._isInsideBuildingSlow(px, py); lut.m.set(k, r); return r;
    }
    _isInsideBuildingSlow(px, py) {
        // Check sub-zones first (smaller, more precise)
        if (this._houseSubZones) {
            for (const [subId, sub] of Object.entries(this._houseSubZones)) {
                const zx = sub.x * TILE, zy = sub.y * TILE;
                const zw = sub.w * TILE, zh = sub.h * TILE;
                if (px >= zx && px <= zx + zw && py >= zy && py <= zy + zh) return subId;
            }
        }
        for (const [locId, zone] of Object.entries(this.buildingZones)) {
            if (zone.parentLocId) continue; // skip sub-zones already checked
            const zx = zone.x * TILE, zy = zone.y * TILE;
            const zw = zone.w * TILE, zh = zone.h * TILE;
            if (px >= zx && px <= zx + zw && py >= zy && py <= zy + zh) return locId;
        }
        return null;
    }

    // Get door position for a location (or specific sub-zone)
    _getDoorPosition(locId, agentId) {
        // If locId is a specific sub-zone, use it directly
        if (this._houseSubZones && this._houseSubZones[locId]) {
            const sub = this._houseSubZones[locId];
            return { x: sub.doorPixelX, y: sub.doorPixelY };
        }
        // If locId is a residential area and we have an agent, get their specific house door
        if (agentId && locId && locId.startsWith('residential_')) {
            const houseId = this.getAgentHouseId(agentId, locId);
            if (houseId && this._houseSubZones && this._houseSubZones[houseId]) {
                const sub = this._houseSubZones[houseId];
                return { x: sub.doorPixelX, y: sub.doorPixelY };
            }
        }
        const zone = this.buildingZones[locId];
        if (zone && zone.doorPixelX !== undefined) {
            return { x: zone.doorPixelX, y: zone.doorPixelY };
        }
        return null;
    }

    // Check if a pixel position is walkable (not a wall or solid obstacle)
    _isWalkableTile(px, py) {
        if (!this.grid) return true;
        const tx = Math.floor(px / TILE);
        const ty = Math.floor(py / TILE);
        if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return false;
        const tile = this.grid[ty][tx];
        // v5.75.0 海岸鎮:海面不可走(棧橋可以),村民不再在海裡散步
        if (this._blockWater && (tile === T.WATER || tile === T.WATER2)) return false;
        if (tile === T.CHASM) return false; // v5.76.0 裂谷
        // Wall, roof, window, and fence tiles are not walkable
        return tile !== T.WALL_TOP && tile !== T.WALL_FRONT && tile !== T.WINDOW
            && tile !== T.ROOF && tile !== T.ROOF2
            && tile !== T.FENCE_H && tile !== T.FENCE_V;
    }

    // Find the nearest walkable position to target, avoiding walls
    // v6.42.1 在 (cx, cy) 附近找一個可走、而且沒人佔的位置(其他村民的目的地快取當作已佔用)
    _freeSpot(aid, cx, cy) {
        const taken = [];
        for (const [id, c] of Object.entries(this._tgtCache || {})) if (id !== aid && c && Number.isFinite(c.x)) taken.push(c);
        const free = (x, y) => { for (const c of taken) if (Math.abs(c.x - x) < TILE * 0.9 && Math.abs(c.y - y) < TILE * 0.9) return false; return true; };
        let h = 0; for (const ch of String(aid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        const rot = (h % 360) * Math.PI / 180;
        let first = null;
        for (let r = 0; r <= 4; r++) {
            const n = r === 0 ? 1 : 6 * r;
            for (let i = 0; i < n; i++) {
                const ang = rot + (i / n) * Math.PI * 2;
                const w = this._findWalkableTarget(Math.round(cx + Math.cos(ang) * r * TILE * 1.1), Math.round(cy + Math.sin(ang) * r * TILE * 1.1));
                if (!first) first = w;
                if (free(w.x, w.y)) return w;
            }
        }
        return first || { x: cx, y: cy };
    }
    _findWalkableTarget(targetX, targetY) {
        if (this._isWalkableTile(targetX, targetY)) return { x: targetX, y: targetY };
        // Search in expanding ring for nearest walkable tile
        for (let r = 1; r <= 10; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const nx = targetX + dx * TILE;
                    const ny = targetY + dy * TILE;
                    if (this._isWalkableTile(nx, ny)) return { x: nx, y: ny };
                }
            }
        }
        return { x: targetX, y: targetY };
    }

    // Check if a tile coordinate is walkable (tile-based, not pixel-based)
    _isTileWalkable(tx, ty) {
        if (!this.grid) return true;
        if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return false;
        const tile = this.grid[ty][tx];
        if (this._blockWater && (tile === T.WATER || tile === T.WATER2)) return false;
        if (tile === T.CHASM) return false;
        return tile !== T.WALL_TOP && tile !== T.WALL_FRONT && tile !== T.WINDOW
            && tile !== T.ROOF && tile !== T.ROOF2
            && tile !== T.FENCE_H && tile !== T.FENCE_V;
    }

    // A* pathfinding on tile grid — returns array of {x, y} pixel waypoints
    _findPath(startPx, startPy, endPx, endPy) {
        if (!this.grid) return null;
        const sx = Math.floor(startPx / TILE);
        const sy = Math.floor(startPy / TILE);
        let ex = Math.floor(endPx / TILE);
        let ey = Math.floor(endPy / TILE);

        // Clamp to grid bounds
        const clamp = (v, max) => Math.max(0, Math.min(max - 1, v));
        const sxc = clamp(sx, this.cols), syc = clamp(sy, this.rows);
        const exc = clamp(ex, this.cols), eyc = clamp(ey, this.rows);

        // If start == end, no path needed
        if (sxc === exc && syc === eyc) return null;

        // If end tile is not walkable, find nearest walkable tile
        if (!this._isTileWalkable(exc, eyc)) {
            let found = false;
            for (let r = 1; r <= 8; r++) {
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                        if (this._isTileWalkable(exc + dx, eyc + dy)) {
                            ex = exc + dx; ey = eyc + dy; found = true; break;
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }
            if (!found) return null;
        }

        // v6.33.0 A* 改寫:型別陣列 + 二元堆 + 世代戳記(不再每格配置 Map/Set、open 不再線性掃描);八方向、不切角、octile 啟發
        // (390px 四倍節流量測:25 人同時換地點的那一幀原本 14 次 × 1.3ms)
        const W = this.cols, H = this.rows, N = W * H;
        let A = this._astar;
        if (!A || A.N !== N) A = this._astar = { N, g: new Float32Array(N), par: new Int32Array(N), stamp: new Uint32Array(N), closed: new Uint32Array(N), gen: 0, hk: new Int32Array(N * 2), hf: new Float32Array(N * 2) };
        if (++A.gen >= 0xFFFFFFF0) { A.stamp.fill(0); A.closed.fill(0); A.gen = 1; }
        const gen = A.gen, g = A.g, par = A.par, stamp = A.stamp, closed = A.closed, hk = A.hk, hf = A.hf; let hn = 0;
        const push = (k, f) => { let i = hn; if (i >= hk.length) return; hn++; hk[i] = k; hf[i] = f; while (i > 0) { const pI = (i - 1) >> 1; if (hf[pI] <= hf[i]) break; const tk = hk[pI], tf = hf[pI]; hk[pI] = hk[i]; hf[pI] = hf[i]; hk[i] = tk; hf[i] = tf; i = pI; } };
        const pop = () => { const k = hk[0]; hn--; if (hn > 0) { hk[0] = hk[hn]; hf[0] = hf[hn]; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < hn && hf[l] < hf[m]) m = l; if (r < hn && hf[r] < hf[m]) m = r; if (m === i) break; const tk = hk[m], tf = hf[m]; hk[m] = hk[i]; hf[m] = hf[i]; hk[i] = tk; hf[i] = tf; i = m; } } return k; };
        const h = (x, y) => { const dx = Math.abs(x - ex), dy = Math.abs(y - ey); return (Math.max(dx, dy) + 0.41 * Math.min(dx, dy)) * 1.05; };
        const sk = syc * W + sxc, ek = ey * W + ex;
        stamp[sk] = gen; g[sk] = 0; par[sk] = -1; push(sk, h(sxc, syc));
        const DX = [0, 0, -1, 1, -1, 1, -1, 1], DY = [-1, 1, 0, 0, -1, -1, 1, 1], DC = [1, 1, 1, 1, 1.41, 1.41, 1.41, 1.41];
        let iterations = 0; const MAX_ITER = 2000;
        while (hn > 0 && iterations < MAX_ITER) {
            iterations++;
            const ck = pop();
            if (closed[ck] === gen) continue;
            closed[ck] = gen;
            if (ck === ek) {
                const path = []; let k = ek;
                while (k !== -1) { const py = Math.floor(k / W), px = k - py * W; path.push({ x: (px + 0.5) * TILE, y: (py + 0.5) * TILE }); k = par[k]; }
                path.reverse();
                return this._simplifyPath(path);
            }
            const cx = ck % W, cy = (ck - cx) / W, cg = g[ck];
            for (let d = 0; d < 8; d++) {
                const nx = cx + DX[d], ny = cy + DY[d];
                if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                const nk = ny * W + nx;
                if (closed[nk] === gen) continue;
                if (!this._isTileWalkable(nx, ny)) continue;
                if (d >= 4 && (!this._isTileWalkable(cx + DX[d], cy) || !this._isTileWalkable(cx, cy + DY[d]))) continue; // 不切角
                const ng = cg + DC[d];
                if (stamp[nk] !== gen || ng < g[nk]) { stamp[nk] = gen; g[nk] = ng; par[nk] = ck; push(nk, ng + h(nx, ny)); }
            }
        }
        return null; // no path found
    }

    // Remove collinear waypoints to reduce path complexity
    _simplifyPath(path) {
        if (path.length <= 2) return path;
        const result = [path[0]];
        for (let i = 1; i < path.length - 1; i++) {
            const prev = result[result.length - 1];
            const cur = path[i];
            const next = path[i + 1];
            const dx1 = cur.x - prev.x, dy1 = cur.y - prev.y;
            const dx2 = next.x - cur.x, dy2 = next.y - cur.y;
            // Keep if direction changes
            if (Math.sign(dx1) !== Math.sign(dx2) || Math.sign(dy1) !== Math.sign(dy2)) {
                result.push(cur);
            }
        }
        result.push(path[path.length - 1]);
        return result;
    }

    // v4.2.0 礦石鎮式直接操作:方向輸入 → 玩家自由移動(像素級,牆壁碰撞+滑牆)
    // 手動模式具黏性:按下方向鍵進入,點擊地圖移動時退出(回到目標制)
    _updateManualPlayer() {
        const pos = this.agentPositions['player'];
        if (!pos) { this._playerManual = false; return; }
        const ix = this.playerInput.x, iy = this.playerInput.y;
        const inputActive = !!(ix || iy);
        if (this._playerClickTarget) this._playerManual = false;
        if (inputActive) this._playerManual = true;
        if (!this._playerManual) return;
        if (!inputActive) {
            if (pos.walking) { pos.walking = false; pos.walkStep = 0; }
            this._followCamera(pos);
            return;
        }
        const mag = Math.min(1, Math.hypot(ix, iy)) || 1;
        // 依時間計速(與 frame rate 無關):約 4.5 tile/秒的礦石鎮步行感
        const PLAYER_SPEED = 72; // px/秒
        const now = performance.now();
        const dt = Math.min(50, now - (this._manualLastT || now)) / 1000;
        this._manualLastT = now;
        const step = PLAYER_SPEED * dt * Math.min(1, Math.hypot(ix, iy));
        const dx = (ix / mag) * step;
        const dy = (iy / mag) * step;
        // 分軸碰撞:撞牆時沿牆滑行
        const M = 4; // 邊界留白(px)
        const nx = Math.max(M, Math.min(this.mapWidth - M, pos.x + dx));
        const ny = Math.max(M, Math.min(this.mapHeight - M, pos.y + dy));
        if (this._isWalkableTile(nx, pos.y)) pos.x = nx;
        if (this._isWalkableTile(pos.x, ny)) pos.y = ny;
        pos.targetX = pos.x;
        pos.targetY = pos.y;
        pos._pathWaypoints = null;
        pos.walking = true;
        pos.walkStep = (pos.walkStep || 0) + 1;
        if (dx) pos.facing = dx > 0 ? 1 : -1;
        pos.dir4 = Math.abs(dy) > Math.abs(dx) * 1.4 ? (dy > 0 ? 'down' : 'up') : (dx >= 0 ? 'right' : 'left');
        this.followPlayer = true;
        this._followCamera(pos);
        if (this.onPlayerMoved) this.onPlayerMoved(pos.x, pos.y);
    }

    // 鏡頭平滑跟隨玩家(手動平移地圖會關閉,再次輸入方向重新開啟)
    // v6.25.0 觀察者:鏡頭中心(地圖像素),取代「玩家位置」做距離判定
    getViewCenter() { return { x: this.camX + (this._viewW / this.zoom) / 2, y: this.camY + (this._viewH / this.zoom) / 2 }; }
    _followCamera(pos) {
        if (!this.followPlayer || !this._viewW) return;
        const vw = this._viewW / this.zoom;
        const vh = this._viewH / this.zoom;
        const targetCamX = pos.x - vw / 2;
        const targetCamY = pos.y - vh / 2;
        this.camX += (targetCamX - this.camX) * 0.12;
        this.camY += (targetCamY - this.camY) * 0.12;
        this._clampCamera();
    }

    // 玩家所在的地點 zone(手動移動時同步邏輯位置用)
    getLocationAt(px, py) {
        let best = null, bestArea = Infinity;
        for (const [locId, zone] of Object.entries(this.buildingZones)) {
            if (px >= zone.x * TILE && px < (zone.x + zone.w) * TILE &&
                py >= zone.y * TILE && py < (zone.y + zone.h) * TILE) {
                const area = zone.w * zone.h;
                if (area < bestArea) { bestArea = area; best = locId; }
            }
        }
        if (best) return best;
        for (const [locId, zone] of Object.entries(this.natureZones)) {
            if (px >= zone.x * TILE && px < (zone.x + zone.w) * TILE &&
                py >= zone.y * TILE && py < (zone.y + zone.h) * TILE) return locId;
        }
        return null;
    }

    // 距離玩家最近的 NPC(走近互動提示用),maxDist 為地圖像素
    getNearbyNPC(maxDist = TILE * 2.5) {
        const p = this.agentPositions['player'];
        if (!p) return null;
        let best = null, bestDist = maxDist;
        for (const [aid, pos] of Object.entries(this.agentPositions)) {
            if (aid === 'player') continue;
            const d = Math.hypot(pos.x - p.x, pos.y - p.y);
            if (d < bestDist) { bestDist = d; best = aid; }
        }
        return best ? { agentId: best, dist: bestDist } : null;
    }

    updateAgents(agents, locations, chatTarget) {
        this.chatTarget = chatTarget || null;
        const WALK_SPEED = 0.3; // pixels per frame — slow leisurely pace
        this._updateManualPlayer();
        // 首次取得玩家位置時把鏡頭對準玩家(搭配預設拉近縮放)
        if (!this._centeredOnPlayer && this.agentPositions['player'] && this._viewW > 0) {
            this._centeredOnPlayer = true;
            const p = this.agentPositions['player'];
            this.camX = p.x - this._viewW / this.zoom / 2;
            this.camY = p.y - this._viewH / this.zoom / 2;
            this._clampCamera();
        }
        for (const [aid, agent] of Object.entries(agents)) {
            // 手動操作中的玩家由 _updateManualPlayer 處理,跳過地點目標制
            if (aid === 'player' && this._playerManual) continue;
            const curLoc = agent.current_location;
            // v6.42.1 出門探險的人從地圖上消失,回來才重新出現(到時從目的地門口重新登場)
            if (curLoc === 'exploration' || (agent.current_activity || agent.activity) === 'exploring') {
                delete this.agentPositions[aid]; if (this._tgtCache) delete this._tgtCache[aid];
                continue;
            }
            let targetX, targetY;
            const homeLocation = agent.home_location || agent.homeLocation;
            // v6.33.0 目的地快取:之前每幀替每位村民重算目的地(地點中心、同地點重疊計數 O(n²)、可走點環狀搜尋、住家查表),
            // 390px 四倍節流下一幀 8ms。現在只在地點／住家改變、玩家點地、或位置被外部重設時重算;其餘幀直接用上次的目的地
            if (!this._tgtCache || this._tgtGrid !== this.grid) { this._tgtCache = {}; this._tgtGrid = this.grid; }
            const tgtKey = (curLoc || '') + '|' + (homeLocation || '');
            const tc = this._tgtCache[aid];
            if (tc && tc.key === tgtKey && this.agentPositions[aid] && !(aid === 'player' && this._playerClickTarget)) { targetX = tc.x; targetY = tc.y; }
            else {

                // For residential areas, route agents to their specific house
                if (curLoc && curLoc.startsWith('residential_') && this._houseSubZones) {
                    const houseId = this.getAgentHouseId(aid, curLoc);
                    if (houseId && this._houseSubZones[houseId]) {
                        const sub = this._houseSubZones[houseId];
                        // Place inside their specific house with small offset
                        const hashOffset = (aid.charCodeAt(0) || 0) % 4;
                        targetX = sub.interiorX + ((hashOffset % 2) - 0.5) * TILE;
                        targetY = sub.interiorY + (Math.floor(hashOffset / 2) - 0.5) * TILE;
                    } else {
                        const locCenter = this.getLocationCenter(curLoc);
                        targetX = locCenter.x;
                        targetY = locCenter.y;
                    }
                } else {
                    const locCenter = this.getLocationCenter(curLoc);
                    // v6.42.1 同一個地點的人各自找空位:以前用「目前目的地在附近的人數」算偏移,走在門口過渡期的人沒算進去,
                    // 又因為地點中心常是不能走的格子(噴泉、建築內部),被推到同一個最近的可走格 → 好幾個人疊在街上同一點。
                    // 現在從中心往外一圈圈找可走、而且離別人的目的地至少約一格的位置
                    const spot = this._freeSpot(aid, locCenter.x, locCenter.y);
                    targetX = spot.x;
                    targetY = spot.y;
                }
                // Player click target: override position to exact click location
                if (aid === 'player' && this._playerClickTarget) {
                    const ct = this._findWalkableTarget(this._playerClickTarget.x, this._playerClickTarget.y);
                    targetX = ct.x;
                    targetY = ct.y;
                    this._playerClickTarget = null;
                }
                // Ensure target is not inside a wall
                const walkable = this._findWalkableTarget(targetX, targetY);
                targetX = walkable.x;
                targetY = walkable.y;
            this._tgtCache[aid] = { key: tgtKey, x: targetX, y: targetY };
            }

            // Extract job key string from agent data
            const jobKey = (agent.job && agent.job.key) ? agent.job.key : (typeof agent.job === 'string' ? agent.job : 'default');

            const gender = agent.gender || 'male';

            // Track current activity for action animations
            const activity = agent.current_activity || agent.activity || '';
            const atFarm = agent.current_location === 'farm';

            if (!this.agentPositions[aid]) {
                // New agent — place at door if target is inside a building
                const door = this._getDoorPosition(curLoc, aid);
                const startX = door ? door.x : targetX;
                const startY = door ? door.y : targetY;
                this.agentPositions[aid] = { x: startX, y: startY, targetX, targetY, job: jobKey, gender, walking: true, walkStep: 0, activity, atFarm, doorPhase: door ? 'entering' : null };
            } else {
                this.agentPositions[aid].activity = activity;
                this.agentPositions[aid].atFarm = atFarm;
                this.agentPositions[aid].job = jobKey;
                this.agentPositions[aid].gender = gender;
                // Freeze sleeping NPCs — once at home, stay still
                // v5.37.0 修復「站在戶外睡著」:入睡瞬間若人還在屋外,原本就直接凍結在原地;
                // 現在只有真的走進建築物內才凍結,在戶外會繼續走回家再睡
                const isSleeping = activity === 'sleeping';
                if (!isSleeping && this.agentPositions[aid]._slpOut) this.agentPositions[aid]._slpOut = 0;
                if (isSleeping) {
                    const pos0 = this.agentPositions[aid];
                    if (!pos0.walking && this._isInsideBuilding(pos0.x, pos0.y)) {
                        // Already at rest position — don't move or update target
                        pos0.walkStep = 0;
                        pos0._slpOut = 0;
                        continue;
                    }
                    // v5.54.0 保險絲:睡著卻一直在屋外(不論還在走或卡住),累積一段時間就強制安置進屋
                    pos0._slpOut = (pos0._slpOut || 0) + 1;
                    if (pos0.walking && pos0._slpOut <= 600) {
                        // 還在走回家的路上,給它時間
                    } else {
                    // v5.53.1 睡著卻停在屋外(小屋內部目標被 walkable 修正推到牆邊等情況):
                    // 直接安置進自家屋內;找不到自家就借宿最近的小屋,保證「睡覺一定在房子裡」
                    let snap = null;
                    const homeLoc = homeLocation && String(homeLocation).startsWith('residential_') ? homeLocation
                        : (curLoc && String(curLoc).startsWith('residential_') ? curLoc : null);
                    const houseId = homeLoc ? this.getAgentHouseId(aid, homeLoc) : null;
                    if (houseId && this._houseSubZones?.[houseId]) {
                        const sub = this._houseSubZones[houseId];
                        snap = { x: sub.interiorX, y: sub.interiorY };
                    } else if (this._houseSubZones) {
                        let bd = Infinity;
                        for (const sub of Object.values(this._houseSubZones)) {
                            const d = Math.hypot(sub.interiorX - pos0.x, sub.interiorY - pos0.y);
                            if (d < bd) { bd = d; snap = { x: sub.interiorX, y: sub.interiorY }; }
                        }
                    }
                    if (snap) {
                        pos0.x = snap.x + ((aid.charCodeAt(0) % 3) - 1) * 4;
                        pos0.y = snap.y + (((aid.charCodeAt(1) || 0) % 3) - 1) * 4;
                        pos0.targetX = pos0.x; pos0.targetY = pos0.y;
                        pos0.walkStep = 0; pos0.doorPhase = null;
                        pos0.walking = false;
                        pos0._slpOut = 0;
                        continue;
                    }
                    }
                }

                const pos = this.agentPositions[aid];
                // Check if NPC is changing to a different location (entering a new building)
                // v6.33.0 修:出門／進門過渡期 pos.targetX 是門口,之前拿它跟最終目的地比,每一幀都判成「換地點」而重跑 A*
                // (390px 量測 71 幀跑了 1313 次 _findPath,一幀 28ms);改比「最終目的地」就只在真的換地點時重算
                const prevTarget = (pos.doorPhase && pos.finalTarget) ? { x: pos.finalTarget.x, y: pos.finalTarget.y } : { x: pos.targetX, y: pos.targetY };
                const locationChanged = Math.abs(targetX - prevTarget.x) > TILE * 2 || Math.abs(targetY - prevTarget.y) > TILE * 2;

                if (locationChanged) {
                    // Get door of destination building
                    const destDoor = this._getDoorPosition(curLoc, aid);
                    // Get door of current building (if inside one)
                    const curBuilding = this._isInsideBuilding(pos.x, pos.y);
                    const curDoor = curBuilding ? this._getDoorPosition(curBuilding, aid) : null;

                    if (curDoor && destDoor) {
                        // Inside a building → exit through door first, then walk to destination door
                        pos.doorPhase = 'exiting';
                        pos.doorWaypoint = curDoor;
                        pos.finalTarget = { x: targetX, y: targetY };
                        pos.destDoor = destDoor;
                        pos.targetX = curDoor.x;
                        pos.targetY = curDoor.y;
                    } else if (destDoor) {
                        // Outside → walk to destination door first
                        pos.doorPhase = 'approaching';
                        pos.doorWaypoint = destDoor;
                        pos.finalTarget = { x: targetX, y: targetY };
                        pos.targetX = destDoor.x;
                        pos.targetY = destDoor.y;
                    } else {
                        // Nature zone or no door — walk directly
                        pos.doorPhase = null; pos.finalTarget = null; pos.destDoor = null; pos.doorWaypoint = null;
                        pos.targetX = targetX;
                        pos.targetY = targetY;
                    }
                    // Compute A* path for the new movement
                    pos._pathWaypoints = this._findPath(pos.x, pos.y, pos.targetX, pos.targetY);
                    pos._pathIdx = 0;
                } else if (!pos.doorPhase) {
                    // Only recompute path if target actually changed
                    if (Math.abs(targetX - pos.targetX) > 1 || Math.abs(targetY - pos.targetY) > 1) {
                        pos.targetX = targetX;
                        pos.targetY = targetY;
                        pos._pathWaypoints = this._findPath(pos.x, pos.y, targetX, targetY);
                        pos._pathIdx = 0;
                    }
                }

                // If NPC is currently stuck inside a wall, teleport them out
                if (!this._isWalkableTile(pos.x, pos.y)) {
                    const escape = this._findWalkableTarget(pos.x, pos.y);
                    pos.x = escape.x; pos.y = escape.y;
                    pos._pathWaypoints = null; // recalc path
                }
                // v5.60.2 清醒卡屋保險絲(睡覺保險絲的對稱版):醒著、人在建築物內、
                // 目標在遠處,卻一直出不了門(房間開口被牆封住、A* 找不到路只能沿牆滑等
                // 情況)——累積約 6 秒就把人安置到所在建築的門口外,重算路線,保證不會
                // 永遠困在屋裡
                const _farTarget = Math.abs(pos.targetX - pos.x) + Math.abs(pos.targetY - pos.y) > TILE * 2;
                const _inBldg = (activity !== 'sleeping' && _farTarget) ? this._isInsideBuilding(pos.x, pos.y) : null;
                if (_inBldg) {
                    pos._inStuck = (pos._inStuck || 0) + 1;
                    if (pos._inStuck > 360) {
                        const door = this._getDoorPosition(_inBldg, aid);
                        const out = door ? this._findWalkableTarget(door.x, door.y + TILE) : this._findWalkableTarget(pos.x, pos.y);
                        pos.x = out.x; pos.y = out.y;
                        pos.doorPhase = null; pos.destDoor = null; pos.doorWaypoint = null;
                        pos._pathWaypoints = this._findPath(pos.x, pos.y, pos.targetX, pos.targetY);
                        pos._pathIdx = 0;
                        pos._inStuck = 0;
                    }
                } else if (pos._inStuck) pos._inStuck = 0;
                // Freeze agents involved in player chat
                const isChatting = chatTarget && (aid === chatTarget || aid === 'player');

                // Determine current movement target (A* waypoint or direct target)
                let moveToX = pos.targetX, moveToY = pos.targetY;
                if (pos._pathWaypoints && pos._pathWaypoints.length > 0) {
                    const wpIdx = pos._pathIdx || 0;
                    if (wpIdx < pos._pathWaypoints.length) {
                        moveToX = pos._pathWaypoints[wpIdx].x;
                        moveToY = pos._pathWaypoints[wpIdx].y;
                    }
                }

                // Constant-speed walking
                const dx = moveToX - pos.x;
                const dy = moveToY - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (isChatting) {
                    // Stop walking and face each other
                    pos.walking = false;
                    pos.walkStep = 0;
                    pos.dir4 = (pos.facing || 1) > 0 ? 'right' : 'left';
                    if (chatTarget && aid === 'player' && this.agentPositions[chatTarget]) {
                        pos.facing = this.agentPositions[chatTarget].x > pos.x ? 1 : -1;
                    } else if (chatTarget && aid === chatTarget && this.agentPositions['player']) {
                        pos.facing = this.agentPositions['player'].x > pos.x ? 1 : -1;
                    }
                } else if (dist > 1) {
                    // Walk toward current waypoint at constant speed
                    const step = Math.min(WALK_SPEED, dist);
                    let newX = pos.x + (dx / dist) * step;
                    let newY = pos.y + (dy / dist) * step;
                    // Wall collision avoidance fallback (shouldn't happen with A* but just in case)
                    if (!this._isWalkableTile(newX, newY)) {
                        const moveX = (dx / dist) * step;
                        const moveY = (dy / dist) * step;
                        if (this._isWalkableTile(pos.x + moveX, pos.y)) {
                            newX = pos.x + moveX; newY = pos.y;
                        } else if (this._isWalkableTile(pos.x, pos.y + moveY)) {
                            newX = pos.x; newY = pos.y + moveY;
                        } else {
                            // Completely blocked — teleport to walkable target
                            const escape = this._findWalkableTarget(pos.targetX, pos.targetY);
                            pos.x = escape.x; pos.y = escape.y;
                            pos.walking = false; pos.walkStep = 0;
                            pos._pathWaypoints = null;
                            continue;
                        }
                    }
                    pos.x = newX;
                    pos.y = newY;
                    pos.walking = true;
                    pos.walkStep = (pos.walkStep || 0) + 1;
                    // Face direction: 1 = right, -1 = left
                    pos.facing = dx > 0 ? 1 : dx < 0 ? -1 : (pos.facing || 1);
                    // v4.5.0 四向朝向(垂直移動為主時顯示背面/正面)
                    pos.dir4 = Math.abs(dy) > Math.abs(dx) * 1.4 ? (dy > 0 ? 'down' : 'up') : 'side';
                } else {
                    // Reached current waypoint
                    pos.x = moveToX;
                    pos.y = moveToY;

                    // Advance to next A* waypoint if available
                    if (pos._pathWaypoints && pos._pathIdx < pos._pathWaypoints.length - 1) {
                        pos._pathIdx++;
                        // Continue walking to next waypoint
                        pos.walking = true;
                    }
                    // Handle door waypoint progression
                    else if (pos.doorPhase === 'exiting' && pos.destDoor) {
                        // Reached exit door → now walk to destination door
                        pos.doorPhase = 'approaching';
                        pos.doorWaypoint = pos.destDoor;
                        pos.targetX = pos.destDoor.x;
                        pos.targetY = pos.destDoor.y;
                        pos.destDoor = null;
                        // Compute new path for outdoor segment
                        pos._pathWaypoints = this._findPath(pos.x, pos.y, pos.targetX, pos.targetY);
                        pos._pathIdx = 0;
                    } else if (pos.doorPhase === 'approaching' && pos.finalTarget) {
                        // Reached destination door → now walk inside to final position
                        pos.doorPhase = 'entering';
                        pos.targetX = pos.finalTarget.x;
                        pos.targetY = pos.finalTarget.y;
                        pos.finalTarget = null;
                        pos.doorWaypoint = null;
                        pos._pathWaypoints = null; // short indoor path, no A* needed
                    } else if (pos.doorPhase === 'entering') {
                        // Arrived at final position inside building
                        pos.doorPhase = null;
                        pos.walking = false;
                        pos.walkStep = 0;
                        pos._pathWaypoints = null;
                    } else {
                        pos.walking = false;
                        pos.walkStep = 0;
                        pos._pathWaypoints = null;
                    }
                }
            }
        }
        // Remove agents that no longer exist
        for (const aid of Object.keys(this.agentPositions)) {
            if (!agents[aid]) delete this.agentPositions[aid];
        }
    }

    // Draw chibi-style agent sprite (inspired by JRPG pixel art)
    // Sprite dimensions: ~16w x 24h, big head, large eyes, short body
    // v5.10.0 顏色明暗調整(-1 全黑 .. +1 全白)
    _shadeHex(hex, amt) {
        let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join('');
        let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        const f = amt >= 0 ? (v) => v + (255 - v) * amt : (v) => v * (1 + amt);
        const cl = (v) => Math.max(0, Math.min(255, Math.round(f(v))));
        return '#' + [cl(r), cl(g), cl(b)].map(v => v.toString(16).padStart(2, '0')).join('');
    }
    // v5.10.0 每位村民依名字給不同膚色/髮色/服裝深淺,同職業也能一眼分辨
    _variedColors(base, name, jobKey, look) {
        this._colorCache = this._colorCache || {};
        const key = jobKey + '|' + name + '|' + lookSig(look);
        if (this._colorCache[key]) return this._colorCache[key];
        let h = 2166136261;
        for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = (h * 16777619) >>> 0; }
        const SKINS = ['#fce4c8', '#f6ddbe', '#eecca4', '#e0bc98', '#cda074', '#b88458'];
        const HAIRS = ['#241812', '#3f2810', '#5a3a1a', '#754824', '#9a6a2a', '#c8a860', '#8c8c92', '#33263f', '#6a2a1a'];
        // v5.89.0 自訂外觀優先:膚色/髮色/上衣色
        const skin = (look && look.skin != null && LOOK_SKINS[look.skin]) || SKINS[h % SKINS.length];
        const hair = (look && look.hairColor != null && LOOK_HAIR_COLORS[look.hairColor]) || HAIRS[(h >>> 3) % HAIRS.length];
        const bJit = (((h >>> 6) % 5) - 2) * 0.05;
        const pJit = (((h >>> 10) % 3) - 1) * 0.06;
        const shirt = look && look.shirt != null ? LOOK_SHIRTS[look.shirt] : null;
        const c = { ...base, skin,
            hair, hairDk: this._shadeHex(hair, -0.38), hairLt: this._shadeHex(hair, 0.32),
            body: shirt || this._shadeHex(base.body, bJit), bodyDk: shirt ? this._shadeHex(shirt, -0.3) : this._shadeHex(base.bodyDk, bJit),
            pants: this._shadeHex(base.pants, pJit) };
        this._colorCache[key] = c;
        return c;
    }

    _drawAgent(ctx, x, y, jobKey, isPlayer, isSelected, name, walking, walkStep, gender, jobTitle, dir4, look) {
        const c = isPlayer ? JOB_COLORS.player : this._variedColors(JOB_COLORS[jobKey] || JOB_COLORS.default, name || '', jobKey, look);
        const isFemale = gender === 'female';
        const sx = Math.floor(x - 8);  // center 16px wide sprite
        const bob = walking ? Math.sin((walkStep || 0) * 0.35) * 1.5 : 0;
        const sy = Math.floor(y - 20 + bob);  // taller sprite offset
        const ws = walkStep || 0;
        const lp = Math.floor(ws / 6) % 2; // leg phase

        // === Shadow ===
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(sx + 2, Math.floor(y) + 2, 12, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(sx + 1, Math.floor(y) + 3, 14, 1);

        // === v5.6.0 深色描邊底(先鋪比 sprite 大 1px 的深色剪影,實際部位畫在上面留 1px 黑框,讓角色從地圖跳出來) ===
        ctx.fillStyle = '#181521';
        ctx.fillRect(sx + 2, sy + 1, 12, 12);   // 頭部剪影
        ctx.fillRect(sx + 1, sy + 11, 15, 9);   // 身體+手臂剪影
        ctx.fillRect(sx + 2, sy + 17, 12, 8);   // 腿+靴剪影

        // === Boots ===
        ctx.fillStyle = c.boots;
        if (walking) {
            if (lp === 0) {
                ctx.fillRect(sx + 3, sy + 21, 4, 3); ctx.fillRect(sx + 10, sy + 21, 4, 3);
            } else {
                ctx.fillRect(sx + 5, sy + 21, 4, 3); ctx.fillRect(sx + 8, sy + 21, 4, 3);
            }
        } else {
            ctx.fillRect(sx + 3, sy + 21, 4, 3); ctx.fillRect(sx + 9, sy + 21, 4, 3);
        }
        // Boot highlight
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        if (walking) {
            if (lp === 0) { ctx.fillRect(sx + 3, sy + 21, 2, 1); ctx.fillRect(sx + 10, sy + 21, 2, 1); }
            else { ctx.fillRect(sx + 5, sy + 21, 2, 1); ctx.fillRect(sx + 8, sy + 21, 2, 1); }
        } else {
            ctx.fillRect(sx + 3, sy + 21, 2, 1); ctx.fillRect(sx + 9, sy + 21, 2, 1);
        }

        // === Pants / Legs ===
        ctx.fillStyle = c.pants;
        if (walking) {
            if (lp === 0) {
                ctx.fillRect(sx + 3, sy + 18, 4, 3); ctx.fillRect(sx + 10, sy + 18, 4, 3);
            } else {
                ctx.fillRect(sx + 5, sy + 18, 4, 3); ctx.fillRect(sx + 8, sy + 18, 4, 3);
            }
        } else {
            ctx.fillRect(sx + 3, sy + 18, 4, 3); ctx.fillRect(sx + 9, sy + 18, 4, 3);
        }

        // === Body / Torso ===
        ctx.fillStyle = c.body;
        ctx.fillRect(sx + 2, sy + 12, 12, 7);
        // Body shadow (right side)
        ctx.fillStyle = c.bodyDk;
        ctx.fillRect(sx + 10, sy + 12, 4, 7);
        // Body highlight (left side)
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(sx + 3, sy + 13, 3, 5);
        // Collar / neckline
        ctx.fillStyle = c.skin || '#fce4c8';
        ctx.fillRect(sx + 5, sy + 12, 6, 1);

        // === Arms ===
        const armSwing = walking ? (lp === 0 ? 1 : -1) : 0;
        // Left arm
        ctx.fillStyle = c.body;
        ctx.fillRect(sx, sy + 13 + armSwing, 3, 6);
        ctx.fillStyle = c.bodyDk;
        ctx.fillRect(sx, sy + 13 + armSwing, 1, 6);
        // Left hand
        ctx.fillStyle = c.skin;
        ctx.fillRect(sx, sy + 18 + armSwing, 3, 2);
        // Right arm
        ctx.fillStyle = c.bodyDk;
        ctx.fillRect(sx + 13, sy + 13 - armSwing, 3, 6);
        ctx.fillStyle = c.body;
        ctx.fillRect(sx + 14, sy + 13 - armSwing, 2, 6);
        // Right hand
        ctx.fillStyle = c.skin;
        ctx.fillRect(sx + 13, sy + 18 - armSwing, 3, 2);

        // === Accent belt/sash ===
        ctx.fillStyle = c.accent;
        ctx.fillRect(sx + 2, sy + 17, 12, 1);

        // === Head (big chibi head!) ===
        // Head outline / shadow
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(sx + 2, sy + 2, 12, 11);
        // Head skin
        ctx.fillStyle = c.skin;
        ctx.fillRect(sx + 3, sy + 2, 10, 10);
        // Cheek blush
        ctx.fillStyle = 'rgba(230,120,120,0.2)';
        ctx.fillRect(sx + 3, sy + 8, 2, 2);
        ctx.fillRect(sx + 11, sy + 8, 2, 2);
        // Face shadow (right)
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(sx + 10, sy + 3, 3, 8);

        // === Hair ===
        if (look && look.hair != null) this._drawLookHair(ctx, sx, sy, c, look.hair | 0, isFemale); // v5.89.0 自訂髮型
        else this._drawChibiHair(ctx, sx, sy, c, jobKey, isPlayer, isFemale);
        this._drawJobHat(ctx, sx, sy, c, jobKey, isPlayer);

        // v4.5.0 四向:背面(往上走)頭髮蓋住臉,不畫五官;側面五官朝行進方向偏移
        if (dir4 === 'up') {
            ctx.fillStyle = c.hair || '#5a4636';
            ctx.fillRect(sx + 3, sy + 3, 10, 8);
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(sx + 3, sy + 9, 10, 2);
        } else {
        // 側面行走時五官往行進方向偏移 2px,營造轉頭感
        const off = dir4 === 'right' ? 2 : dir4 === 'left' ? -2 : 0;
        // === Eyes (large anime-style) ===
        // Eye whites
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 4 + off, sy + 5, 3, 3);
        ctx.fillRect(sx + 9 + off, sy + 5, 3, 3);
        // Iris
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(sx + 5 + off, sy + 5, 2, 3);
        ctx.fillRect(sx + 10 + off, sy + 5, 2, 3);
        // Pupil
        ctx.fillStyle = '#111';
        ctx.fillRect(sx + 5 + off, sy + 6, 2, 2);
        ctx.fillRect(sx + 10 + off, sy + 6, 2, 2);
        // Eye highlight (the anime sparkle!)
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 5 + off, sy + 5, 1, 1);
        ctx.fillRect(sx + 10 + off, sy + 5, 1, 1);
        // Lower eye highlight
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(sx + 6 + off, sy + 7, 1, 1);
        ctx.fillRect(sx + 11 + off, sy + 7, 1, 1);

        // === Nose hint ===
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(sx + 8 + off, sy + 8, 1, 1);

        // === Mouth ===
        ctx.fillStyle = '#c08070';
        ctx.fillRect(sx + 7 + off, sy + 9, 2, 1);
        }

        // === Job-specific accessory ===
        this._drawJobAccessory(ctx, sx, sy, jobKey, isPlayer);
        if (look && look.acc) this._drawLookAccessory(ctx, sx, sy, c, look.acc | 0, dir4); // v5.89.0 自訂配件

        // === Selection indicator ===
        if (isSelected) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(sx - 1, sy - 2, 18, 28);
            ctx.setLineDash([]);
        }

        // === Player arrow ===
        if (isPlayer) {
            const arrowBob = Math.sin(this.animFrame * 0.08) * 2;
            const ay = sy - 20 + arrowBob;
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(sx + 5, ay, 6, 2);
            ctx.fillRect(sx + 6, ay - 2, 4, 2);
            ctx.fillRect(sx + 7, ay - 4, 2, 2);
            ctx.fillStyle = 'rgba(0,229,255,0.35)';
            ctx.fillRect(sx + 4, ay + 2, 8, 1);
        }

        // === Name + Job card ===
        {
            ctx.font = 'bold 7px monospace';
            ctx.textAlign = 'center';
            // v5.76.0 英文介面:地圖上的人名卡也用英文名(Boone/Hank…),不再中英夾雜
            const _en = typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
            const nameShort = _en ? I18N.localizeNames(name.split('(')[0].trim()) : name.split('(')[0].trim();
            const jobLabel = jobTitle || '';
            const cardText = jobLabel ? nameShort + ' · ' + jobLabel : nameShort;
            const tw = ctx.measureText(cardText).width;
            const cardW = tw + 8;
            const cardH = 12;
            const cx = sx + 8;
            const lx = cx - cardW / 2;
            const ly = sy - 14;
            // Card background
            if (isPlayer) {
                ctx.fillStyle = 'rgba(0,229,255,0.9)';
            } else if (isSelected) {
                ctx.fillStyle = 'rgba(233,69,96,0.88)';
            } else {
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
            }
            // Rounded rect
            const r = 3;
            ctx.beginPath();
            ctx.moveTo(lx + r, ly);
            ctx.lineTo(lx + cardW - r, ly);
            ctx.quadraticCurveTo(lx + cardW, ly, lx + cardW, ly + r);
            ctx.lineTo(lx + cardW, ly + cardH - r);
            ctx.quadraticCurveTo(lx + cardW, ly + cardH, lx + cardW - r, ly + cardH);
            ctx.lineTo(lx + r, ly + cardH);
            ctx.quadraticCurveTo(lx, ly + cardH, lx, ly + cardH - r);
            ctx.lineTo(lx, ly + r);
            ctx.quadraticCurveTo(lx, ly, lx + r, ly);
            ctx.closePath();
            ctx.fill();
            // Small triangle pointer
            ctx.beginPath();
            ctx.moveTo(cx - 3, ly + cardH);
            ctx.lineTo(cx, ly + cardH + 3);
            ctx.lineTo(cx + 3, ly + cardH);
            ctx.closePath();
            ctx.fill();
            // Text
            ctx.fillStyle = isPlayer ? '#003' : '#fff';
            ctx.fillText(cardText, cx, ly + 9);
        }
    }

    // Draw chibi hair with layers (top, sides, back, bangs)
    _drawChibiHair(ctx, sx, sy, c, jobKey, isPlayer, isFemale) {
        const h = c.hair, hd = c.hairDk, hl = c.hairLt;

        if (isFemale) {
            // === Female hair: longer, flowing sides ===
            // Back hair (long, extends below head)
            ctx.fillStyle = hd;
            ctx.fillRect(sx + 1, sy - 1, 14, 5);
            ctx.fillRect(sx + 1, sy + 4, 3, 10);  // left long hair
            ctx.fillRect(sx + 12, sy + 4, 3, 10);  // right long hair
            // Main hair body
            ctx.fillStyle = h;
            ctx.fillRect(sx + 3, sy - 2, 10, 5);
            // Hair top volume (rounder, fuller)
            ctx.fillRect(sx + 4, sy - 3, 8, 3);
            ctx.fillRect(sx + 5, sy - 4, 6, 2);
            // Hair highlight
            ctx.fillStyle = hl;
            ctx.fillRect(sx + 5, sy - 3, 4, 2);
            ctx.fillRect(sx + 6, sy - 4, 3, 1);
            // Side hair flowing down (longer for female)
            ctx.fillStyle = h;
            ctx.fillRect(sx + 2, sy, 2, 12);
            ctx.fillRect(sx + 12, sy, 2, 12);
            ctx.fillStyle = hl;
            ctx.fillRect(sx + 3, sy + 1, 1, 8);
            ctx.fillRect(sx + 12, sy + 1, 1, 8);
            // Hair tips
            ctx.fillStyle = hd;
            ctx.fillRect(sx + 1, sy + 13, 2, 1);
            ctx.fillRect(sx + 13, sy + 13, 2, 1);
            // Bangs (softer, side-swept)
            ctx.fillStyle = h;
            ctx.fillRect(sx + 4, sy + 1, 8, 2);
            ctx.fillStyle = hl;
            ctx.fillRect(sx + 4, sy + 1, 4, 1);
            // Side parting
            ctx.fillStyle = c.skin;
            ctx.fillRect(sx + 8, sy + 2, 2, 2);
        } else {
            // === Male hair: shorter, spiky ===
            // Base hair back
            ctx.fillStyle = hd;
            ctx.fillRect(sx + 2, sy - 1, 12, 5);
            // Main hair
            ctx.fillStyle = h;
            ctx.fillRect(sx + 3, sy - 2, 10, 5);
            // Spiky top
            ctx.fillRect(sx + 4, sy - 3, 8, 3);
            // Spiky tips
            ctx.fillStyle = h;
            ctx.fillRect(sx + 3, sy - 4, 2, 2);
            ctx.fillRect(sx + 6, sy - 4, 3, 2);
            ctx.fillRect(sx + 11, sy - 4, 2, 2);
            // Highlight
            ctx.fillStyle = hl;
            ctx.fillRect(sx + 5, sy - 2, 4, 2);
            ctx.fillRect(sx + 4, sy - 3, 2, 1);
            // Short sides
            ctx.fillStyle = hd;
            ctx.fillRect(sx + 2, sy, 2, 5);
            ctx.fillRect(sx + 12, sy, 2, 5);
            ctx.fillStyle = h;
            ctx.fillRect(sx + 3, sy + 1, 1, 3);
            ctx.fillRect(sx + 12, sy + 1, 1, 3);
            // Bangs (shorter, messier)
            ctx.fillStyle = h;
            ctx.fillRect(sx + 4, sy + 1, 8, 3);
            ctx.fillStyle = hl;
            ctx.fillRect(sx + 5, sy + 1, 3, 1);
            // Parting
            ctx.fillStyle = c.skin;
            ctx.fillRect(sx + 7, sy + 2, 2, 2);
        }

    }
    // v5.89.0 職業帽子(從 _drawChibiHair 拆出,自訂髮型也要戴)
    _drawJobHat(ctx, sx, sy, c, jobKey, isPlayer) {
        const h = c.hair, hd = c.hairDk, hl = c.hairLt; void h; void hd; void hl;
        // Job-specific hair details
        switch (jobKey) {
            case 'cook':
                // Chef hat
                ctx.fillStyle = '#fff';
                ctx.fillRect(sx + 4, sy - 6, 8, 4);
                ctx.fillRect(sx + 3, sy - 3, 10, 2);
                ctx.fillStyle = '#eee';
                ctx.fillRect(sx + 5, sy - 5, 6, 2);
                break;
            case 'farmer':
                // Straw hat
                ctx.fillStyle = '#d4aa70';
                ctx.fillRect(sx + 1, sy - 3, 14, 3);
                ctx.fillStyle = '#c09050';
                ctx.fillRect(sx + 3, sy - 5, 10, 3);
                ctx.fillStyle = '#b08040';
                ctx.fillRect(sx + 3, sy - 3, 10, 1);
                break;
            case 'guard':
                // Metal helmet
                ctx.fillStyle = '#607080';
                ctx.fillRect(sx + 3, sy - 3, 10, 5);
                ctx.fillStyle = '#708090';
                ctx.fillRect(sx + 4, sy - 4, 8, 3);
                ctx.fillStyle = '#90a0b0';
                ctx.fillRect(sx + 5, sy - 3, 4, 1);
                // Visor slit
                ctx.fillStyle = '#333';
                ctx.fillRect(sx + 4, sy + 1, 8, 1);
                break;
            case 'miner':
                // Hard hat with headlamp
                ctx.fillStyle = '#d0a020';
                ctx.fillRect(sx + 3, sy - 3, 10, 4);
                ctx.fillStyle = '#e0b830';
                ctx.fillRect(sx + 4, sy - 4, 8, 3);
                ctx.fillStyle = '#fff';
                ctx.fillRect(sx + 6, sy - 2, 2, 2); // headlamp
                ctx.fillStyle = '#ffeb3b';
                ctx.fillRect(sx + 6, sy - 2, 1, 1); // lamp glow
                break;
            case 'tailor':
                // Hair ribbon/headband
                ctx.fillStyle = '#e91e63';
                ctx.fillRect(sx + 4, sy, 8, 1);
                ctx.fillStyle = '#f06292';
                ctx.fillRect(sx + 10, sy - 1, 3, 3); // bow
                break;
            case 'mayor':
                // Small crown/circlet
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(sx + 4, sy - 3, 8, 2);
                ctx.fillStyle = '#ffeb3b';
                ctx.fillRect(sx + 5, sy - 4, 2, 1);
                ctx.fillRect(sx + 9, sy - 4, 2, 1);
                ctx.fillStyle = '#e53935'; // jewel
                ctx.fillRect(sx + 7, sy - 4, 2, 1);
                break;
            case 'priest':
                // Holy hood/cowl
                ctx.fillStyle = '#f0e8d0';
                ctx.fillRect(sx + 2, sy - 1, 12, 3);
                ctx.fillRect(sx + 2, sy + 1, 3, 6);
                ctx.fillRect(sx + 11, sy + 1, 3, 6);
                ctx.fillStyle = '#e0d8c0';
                ctx.fillRect(sx + 3, sy - 2, 10, 2);
                break;
        }
    }
    // v5.89.0 自訂髮型:0 短髮(原男)、1 長髮(原女)、2 馬尾、3 齊瀏海、4 平頭、5 捲髮
    _drawLookHair(ctx, sx, sy, c, style, isFemale) {
        const h = c.hair, hd = c.hairDk, hl = c.hairLt;
        switch (style) {
            case 1: this._drawChibiHair(ctx, sx, sy, c, '', false, true); break;
            case 2: // 馬尾:短頂+後腦一束
                ctx.fillStyle = hd; ctx.fillRect(sx + 2, sy - 1, 12, 5);
                ctx.fillStyle = h; ctx.fillRect(sx + 3, sy - 2, 10, 4); ctx.fillRect(sx + 4, sy - 3, 8, 2);
                ctx.fillStyle = hl; ctx.fillRect(sx + 5, sy - 2, 4, 1);
                ctx.fillStyle = h; ctx.fillRect(sx + 4, sy + 1, 8, 2); ctx.fillStyle = hl; ctx.fillRect(sx + 4, sy + 1, 3, 1);
                ctx.fillStyle = c.skin; ctx.fillRect(sx + 8, sy + 2, 2, 1);
                ctx.fillStyle = hd; ctx.fillRect(sx + 12, sy + 1, 3, 9); ctx.fillStyle = h; ctx.fillRect(sx + 13, sy + 2, 1, 6);
                ctx.fillStyle = c.accent || '#c62828'; ctx.fillRect(sx + 12, sy + 2, 3, 1);
                break;
            case 3: // 齊瀏海鮑伯
                ctx.fillStyle = hd; ctx.fillRect(sx + 1, sy - 1, 14, 12);
                ctx.fillStyle = h; ctx.fillRect(sx + 2, sy - 2, 12, 5); ctx.fillRect(sx + 4, sy - 3, 8, 2);
                ctx.fillStyle = hl; ctx.fillRect(sx + 5, sy - 2, 5, 1);
                ctx.fillStyle = h; ctx.fillRect(sx + 3, sy + 1, 10, 3); ctx.fillRect(sx + 2, sy + 2, 1, 9); ctx.fillRect(sx + 13, sy + 2, 1, 9);
                ctx.fillStyle = hl; ctx.fillRect(sx + 4, sy + 1, 8, 1);
                break;
            case 4: // 平頭
                ctx.fillStyle = hd; ctx.fillRect(sx + 3, sy - 1, 10, 3);
                ctx.fillStyle = h; ctx.fillRect(sx + 4, sy - 1, 8, 2); ctx.fillRect(sx + 3, sy + 1, 1, 2); ctx.fillRect(sx + 12, sy + 1, 1, 2);
                ctx.fillStyle = hl; ctx.fillRect(sx + 5, sy - 1, 3, 1);
                break;
            case 5: // 捲髮
                ctx.fillStyle = hd; ctx.fillRect(sx + 1, sy - 2, 14, 6); ctx.fillRect(sx + 1, sy + 2, 2, 6); ctx.fillRect(sx + 13, sy + 2, 2, 6);
                ctx.fillStyle = h; ctx.fillRect(sx + 2, sy - 3, 12, 5); ctx.fillRect(sx + 4, sy - 4, 3, 2); ctx.fillRect(sx + 9, sy - 4, 3, 2); ctx.fillRect(sx + 1, sy - 1, 2, 2); ctx.fillRect(sx + 13, sy - 1, 2, 2);
                ctx.fillRect(sx + 3, sy + 1, 10, 2);
                ctx.fillStyle = hl; ctx.fillRect(sx + 4, sy - 3, 2, 1); ctx.fillRect(sx + 9, sy - 3, 2, 1); ctx.fillRect(sx + 2, sy + 3, 1, 2); ctx.fillRect(sx + 13, sy + 3, 1, 2);
                break;
            default: this._drawChibiHair(ctx, sx, sy, c, '', false, false); break;
        }
    }
    // v5.89.0 自訂配件:1 帽子 2 眼鏡 3 圍巾
    _drawLookAccessory(ctx, sx, sy, c, acc, dir4) {
        const off = dir4 === 'right' ? 2 : dir4 === 'left' ? -2 : 0;
        if (acc === 1) {
            const cap = c.accent || '#37474f';
            ctx.fillStyle = this._shadeHex(cap, -0.25); ctx.fillRect(sx + 2, sy - 4, 12, 4);
            ctx.fillStyle = cap; ctx.fillRect(sx + 3, sy - 5, 10, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(sx + 4, sy - 5, 4, 1);
            if (dir4 !== 'up') { ctx.fillStyle = this._shadeHex(cap, -0.4); ctx.fillRect(sx + 1 + off, sy - 1, 14, 1); }
        } else if (acc === 2 && dir4 !== 'up') {
            ctx.fillStyle = '#1b1b1b';
            ctx.fillRect(sx + 3 + off, sy + 4, 5, 1); ctx.fillRect(sx + 3 + off, sy + 8, 5, 1); ctx.fillRect(sx + 3 + off, sy + 4, 1, 5); ctx.fillRect(sx + 7 + off, sy + 4, 1, 5);
            ctx.fillRect(sx + 8 + off, sy + 4, 5, 1); ctx.fillRect(sx + 8 + off, sy + 8, 5, 1); ctx.fillRect(sx + 12 + off, sy + 4, 1, 5); ctx.fillRect(sx + 8 + off, sy + 4, 1, 5);
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(sx + 4 + off, sy + 5, 1, 1); ctx.fillRect(sx + 9 + off, sy + 5, 1, 1);
        } else if (acc === 3) {
            ctx.fillStyle = '#c62828'; ctx.fillRect(sx + 3, sy + 11, 10, 2); ctx.fillRect(sx + 10, sy + 13, 3, 4);
            ctx.fillStyle = '#e57373'; ctx.fillRect(sx + 4, sy + 11, 3, 1); ctx.fillRect(sx + 11, sy + 14, 1, 2);
            ctx.fillStyle = '#8e1c1c'; ctx.fillRect(sx + 10, sy + 16, 3, 1);
        }
    }

    _drawJobAccessory(ctx, sx, sy, jobKey, isPlayer) {
        if (isPlayer) return;
        switch (jobKey) {
            case 'doctor':
                // Red cross on chest
                ctx.fillStyle = '#e53935';
                ctx.fillRect(sx + 6, sy + 13, 4, 1);
                ctx.fillRect(sx + 7, sy + 12, 2, 3);
                break;
            case 'blacksmith':
                // Leather apron
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(sx + 3, sy + 15, 10, 4);
                ctx.fillStyle = '#795548';
                ctx.fillRect(sx + 4, sy + 15, 8, 1);
                break;
            case 'researcher':
                // Glasses
                ctx.fillStyle = '#90caf9';
                ctx.fillRect(sx + 4, sy + 5, 3, 2);
                ctx.fillRect(sx + 9, sy + 5, 3, 2);
                ctx.fillStyle = '#607890';
                ctx.fillRect(sx + 7, sy + 5, 2, 1); // bridge
                break;
            case 'trader':
                // Money pouch on belt
                ctx.fillStyle = '#8d6e63';
                ctx.fillRect(sx + 11, sy + 16, 3, 3);
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(sx + 12, sy + 17, 1, 1);
                break;
            case 'carpenter':
                // Tool belt with hammer
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(sx + 2, sy + 17, 12, 1);
                ctx.fillStyle = '#90a4ae';
                ctx.fillRect(sx + 3, sy + 16, 1, 3);
                ctx.fillStyle = '#795548';
                ctx.fillRect(sx + 3, sy + 15, 2, 1);
                break;
            case 'cook':
                // Spoon in hand
                ctx.fillStyle = '#b0bec5';
                ctx.fillRect(sx + 14, sy + 15, 1, 5);
                ctx.fillStyle = '#cfd8dc';
                ctx.fillRect(sx + 13, sy + 14, 3, 2);
                break;
        }
    }

    // Render a standalone NPC avatar to a data URL (for chat contacts, etc.)
    renderAvatarDataURL(jobKey, gender) {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Draw agent centered: x=16 places sx=8, y=24 places sy=4
        this._drawAgent(ctx, 16, 24, jobKey, false, false, '', false, 0, gender, '');
        return canvas.toDataURL();
    }

    // Draw farming action animation (hoeing, watering, harvesting) for NPC at farm
    render(agents, selectedAgent, playerLoc, completedBuildings, extraData) { } // v6.34.0 2D 繪圖已移除;Town3D 覆寫
    spawnFloatFx(mapX, mapY, text, opts = {}) {
        this._floatFx = this._floatFx || [];
        this._floatFx.push({
            x: mapX, y: mapY, text,
            color: opts.color || '#ffe45e',
            vy: opts.vy || -0.55, vx: (Math.random() - 0.5) * 0.3,
            life: 0, maxLife: opts.maxLife || 56,
            size: opts.size || 11, pop: 0,
        });
        // 同時噴一圈 emoji 粒子(愛心/星星/金幣)
        if (opts.burst) {
            const em = opts.burst;
            const n = opts.burstCount || 6;
            for (let i = 0; i < n; i++) {
                const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
                const spd = 0.7 + Math.random() * 0.8;
                this._floatFx.push({
                    x: mapX, y: mapY - 8, text: em, color: opts.color || '#ff6b9d',
                    vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 0.4,
                    grav: 0.04, life: 0, maxLife: 40 + Math.random() * 20,
                    size: 8 + Math.random() * 3, pop: 0, spin: (Math.random() - 0.5) * 0.2,
                });
            }
        }
        if (this._floatFx.length > 120) this._floatFx = this._floatFx.slice(-90);
    }
    // 對某個 agent 頭上噴特效
    spawnFxOnAgent(agentId, text, opts) {
        const pos = this.agentPositions?.[agentId];
        if (pos) this.spawnFloatFx(pos.x, pos.y - 18, text, opts);
    }

    renderAvatarDataURL(jobKey, gender, name, look) {
        // v5.10.0 帶入名字讓聯絡人頭像與地圖上的村民配色一致(同職業也能分辨);v5.89.0 帶入自訂外觀
        const cacheKey = `${jobKey}_${gender}_${name || ''}_${lookSig(look)}`;
        if (!this._avatarCache) this._avatarCache = {};
        if (this._avatarCache[cacheKey]) return this._avatarCache[cacheKey];

        const scale = 3;
        const spriteW = 16, spriteH = 28;
        const w = spriteW * scale, h = spriteH * scale;
        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const ctx = offscreen.getContext('2d', { willReadFrequently: true }); // v6.54.0 小畫布走 CPU:轉成圖片時不用等顯示卡回讀(以前每個新頭像會卡一下)
        ctx.imageSmoothingEnabled = false;

        // Scale up so pixel art is crisp
        ctx.scale(scale, scale);

        // Draw the agent at a fixed position (centered in the sprite area)
        // _drawAgent expects center-bottom x,y — sprite is 16w x 24h drawn from (x-8, y-20)
        // We place center at x=8, bottom at y=spriteH-2 so sprite fits nicely
        this._drawAgent(ctx, 8, spriteH - 4, jobKey, false, false, name || '', false, 0, gender, '', 'down', look || null);

        const dataUrl = offscreen.toDataURL('image/png');
        this._avatarCache[cacheKey] = dataUrl;
        return dataUrl;
    }
}

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
};

// Color palette for each tile [primary, secondary, highlight, accent]
// Vibrant lush style inspired by RPG pixel art tilemaps
const TILE_COLORS = {
    [T.GRASS]:    ['#5eb34a','#55a743','#6ec455','#4a9639'],
    [T.GRASS2]:   ['#62b74e','#58aa45','#74c85a','#4d9a3c'],
    [T.GRASS3]:   ['#58ac45','#4f9f3e','#68be50','#459036'],
    [T.DIRT]:     ['#c19a62','#b28a52','#d0ac74','#9d7844'],
    [T.STONE_PATH]:['#9a8d7c','#877a68','#ab9e8c','#786c5c'],
    [T.WALL_TOP]: ['#6b5a3e','#574a32','#7d6a4a','#4a3d28'],
    [T.WALL_FRONT]:['#8b7355','#7a644a','#9e8462','#6b5640'],
    [T.FLOOR]:    ['#d4b896','#c4a882','#e0c8a8','#b49a72'],
    [T.FLOOR2]:   ['#c9ad87','#b89d78','#d8bc96','#a88d68'],
    [T.DOOR]:     ['#a0784c','#8b6840','#b8885a','#704830'],
    [T.WATER]:    ['#38a8e0','#2890c8','#58c0f0','#2078b0'],
    [T.WATER2]:   ['#2890c8','#1878b0','#38a0d8','#106898'],
    [T.TREE_TRUNK]:['#6b4226','#5a3720','#7a4d2c','#4a2e18'],
    [T.TREE_TOP]: ['#2f8a3c','#22702e','#42a450','#175824'],
    [T.TREE_TOP2]:['#3a9a48','#2c8038','#4eb45c','#1e6828'],
    [T.ROOF]:     ['#b44040','#983434','#cc4c4c','#802828'],
    [T.ROOF2]:    ['#a03030','#882828','#b83838','#701e1e'],
    [T.FENCE_H]:  ['#8b6e4e','#7a6040','#a07e5a','#6a5235'],
    [T.FENCE_V]:  ['#8b6e4e','#7a6040','#a07e5a','#6a5235'],
    [T.CROP1]:    ['#78b040','#60982e','#90c858','#4a8020'],
    [T.CROP2]:    ['#88c048','#70a838','#a0d060','#589830'],
    [T.CROP3]:    ['#98d058','#80b848','#b0e070','#68a038'],
    [T.FLOWER1]:  ['#e84080','#c83068','#f06098','#a82050'],
    [T.FLOWER2]:  ['#f0a030','#d88820','#f8b848','#c07018'],
    [T.BUSH]:     ['#2f8a3c','#22702e','#42a450','#175824'],
    [T.ROCK]:     ['#909898','#707878','#b0b8b8','#585e60'],
    [T.BARREL]:   ['#795548','#5d4037','#8d6e63','#4e342e'],
    [T.CRATE]:    ['#a1887f','#8d6e63','#bcaaa4','#6d4c41'],
    [T.TABLE]:    ['#8d6e63','#795548','#a1887f','#5d4037'],
    [T.CHAIR]:    ['#795548','#5d4037','#8d6e63','#4e342e'],
    [T.BED]:      ['#e8d5b7','#d4c0a0','#f0e0c8','#c4aa8a'],
    [T.ANVIL]:    ['#546e7a','#3e5460','#6a8490','#2d3e48'],
    [T.FURNACE]:  ['#bf360c','#a02808','#e65100','#ff6e40'],
    [T.COUNTER]:  ['#6d4c41','#5d4037','#7e5c50','#4e342e'],
    [T.BOOKSHELF]:['#5d4037','#4e342e','#6d4c41','#3e2723'],
    [T.WELL]:     ['#78909c','#5a7080','#90a4ae','#455a64'],
    [T.ALTAR]:    ['#ffe082','#ffc940','#ffecb3','#ffb300'],
    [T.SAND]:     ['#e8d0a0','#d0b880','#f0e0b8','#c0a068'],
    [T.BRIDGE]:   ['#8d6e63','#6d5040','#a08070','#5d4037'],
    [T.STALL]:    ['#a1887f','#8d6e63','#bcaaa4','#6d4c41'],
    [T.WEAPON_RACK]:['#546e7a','#3e5460','#6a8490','#b0bec5'],
    [T.WINDOW]:   ['#81d4fa','#4fc3f7','#b3e5fc','#29b6f6'],
    [T.DARK_FLOOR]:['#5d4037','#4e342e','#6d4c41','#3e2723'],
    [T.RUG]:      ['#c62828','#a01818','#e53935','#ffd54f'],
    [T.CAULDRON]: ['#37474f','#263238','#455a64','#4caf50'],
};

// Building templates: [name, width, height, 2D array of tile IDs, doorX, doorY]
// Each building has walls on perimeter, floor inside, and furniture
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

// Agent sprite colors by job — chibi style palette
// {body, bodyDk, accent, hair, hairDk, hairLt, pants, boots, skin}
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
        this._buildTileCache();
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
    _postProcessArt() {
        if (!this.grid) return;
        this._artGridReady = true;
        this._artGridSrc = this.grid;
        this._roofVariantGrid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));
        for (const [locId, z] of Object.entries(this.buildingZones)) {
            let h = 0;
            for (let i = 0; i < locId.length; i++) h = (h * 31 + locId.charCodeAt(i)) & 0xffff;
            const v = h % 4;
            if (!v) continue;
            for (let y = Math.max(0, z.y); y < Math.min(this.rows, z.y + z.h); y++) {
                for (let x = Math.max(0, z.x); x < Math.min(this.cols, z.x + z.w); x++) {
                    const tt = this.grid[y][x];
                    if (tt === T.ROOF || tt === T.ROOF2) this._roofVariantGrid[y][x] = v;
                }
            }
        }
        this._windowTiles = [];
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === T.WINDOW) this._windowTiles.push([x, y]);
            }
        }
    }

    // v4.6.0 效能:整張地形預繪成靜態底圖(僅地圖重生成時重建),
    // 每幀從 4800 次 drawImage 降為 1 次 + 少量動態水面
    _buildStaticLayer() {
        if (!this.grid) return;
        const c = document.createElement('canvas');
        c.width = this.mapWidth;
        c.height = this.mapHeight;
        const sctx = c.getContext('2d');
        sctx.imageSmoothingEnabled = false;
        this._waterTiles = [];
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const tile = this.grid[y][x];
                let cached = this.tileCache[tile];
                if ((tile === T.ROOF || tile === T.ROOF2) && this._roofVariantGrid) {
                    const rv = this._roofVariantGrid[y][x];
                    if (rv) cached = this._roofAltCache[`${rv}_${tile}`] || cached;
                }
                if (cached) {
                    sctx.drawImage(cached, x * TILE, y * TILE);
                    this._drawTileOverlays(sctx, x, y, tile, true);
                }
                if (tile === T.WATER || tile === T.WATER2) this._waterTiles.push([x, y, tile]);
            }
        }
        // v5.7.1 建築落地柔影(整棟往東南投一圈軟陰影,增加立體與重量感)
        this._drawBuildingGroundShadows(sctx);
        // v5.6.0 全圖飽和/對比提升 + 地面點狀顆粒質感
        this._postProcessStaticLayer(c, sctx);
        this._staticLayer = c;
        this._staticSrc = this.grid;
    }

    // v5.7.1 用建築 zone 在南/東緣鋪柔影(承接建築體積,太陽在西北)
    _drawBuildingGroundShadows(sctx) {
        const isBldgOrGround = (tx, ty) => {
            const t = (ty < 0 || ty >= this.rows || tx < 0 || tx >= this.cols) ? -1 : this.grid[ty][tx];
            return t; // 供判斷是否落在別的建築上
        };
        const BLD = new Set([T.WALL_TOP, T.WALL_FRONT, T.WINDOW, T.ROOF, T.ROOF2, T.DOOR, T.FLOOR, T.FLOOR2]);
        for (const zone of Object.values(this.buildingZones)) {
            if (!zone || zone.w == null || zone.h == null) continue;
            const L = zone.x * TILE, R = (zone.x + zone.w) * TILE, B = (zone.y + zone.h) * TILE, Tp = zone.y * TILE;
            // 南側 skirt:4 條逐漸變淡、略往右偏的軟影
            for (let i = 0; i < 5; i++) {
                const yy = B + i;
                if (yy >= this.mapHeight) break;
                sctx.fillStyle = `rgba(16,14,26,${0.18 - i * 0.034})`;
                const x0 = L + 2 + i, w = (R - L) - 2;
                // 避免蓋到南邊相鄰建築(只畫在非建築格上)
                for (let x = x0; x < x0 + w; x++) {
                    const t = isBldgOrGround(Math.floor(x / TILE), Math.floor(yy / TILE));
                    if (!BLD.has(t)) sctx.fillRect(x, yy, 1, 1);
                }
            }
            // 東側 skirt
            for (let i = 0; i < 4; i++) {
                const xx = R + i;
                if (xx >= this.mapWidth) break;
                sctx.fillStyle = `rgba(16,14,26,${0.15 - i * 0.032})`;
                const y0 = Tp + 4 + i, h = (B - Tp) - 2;
                for (let y = y0; y < y0 + h; y++) {
                    const t = isBldgOrGround(Math.floor(xx / TILE), Math.floor(y / TILE));
                    if (!BLD.has(t)) sctx.fillRect(xx, y, 1, 1);
                }
            }
        }
    }

    // v5.6.0 後處理:整圖飽和+對比(更鮮豔),再疊細微顆粒讓地面有質感(參考動作遊戲的點狀地皮)
    _postProcessStaticLayer(c, sctx) {
        try {
            const tmp = document.createElement('canvas');
            tmp.width = c.width; tmp.height = c.height;
            const tctx = tmp.getContext('2d');
            tctx.imageSmoothingEnabled = false;
            tctx.drawImage(c, 0, 0);
            sctx.clearRect(0, 0, c.width, c.height);
            sctx.imageSmoothingEnabled = false;
            sctx.filter = 'saturate(1.3) contrast(1.06) brightness(1.02)';
            sctx.drawImage(tmp, 0, 0);
            sctx.filter = 'none';
        } catch (e) { /* filter 不支援就跳過,不影響遊戲 */ }
        // 地面顆粒:草/土/沙上撒確定性明暗噪點(不用亂數,存讀檔一致)
        const GROUND = new Set([T.GRASS, T.GRASS2, T.GRASS3, T.DIRT, T.SAND, T.STONE_PATH]);
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (!GROUND.has(this.grid[y][x])) continue;
                const hsh = ((x * 73856093) ^ (y * 19349663)) >>> 0;
                const n = 2 + (hsh % 3);
                for (let i = 0; i < n; i++) {
                    const px = x * TILE + ((hsh >> (i * 3)) % TILE);
                    const py = y * TILE + ((hsh >> (i * 3 + 7)) % TILE);
                    sctx.fillStyle = ((hsh >> i) & 1) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
                    sctx.fillRect(px, py, 1, 1);
                }
            }
        }
        // v5.7.0 低頻大塊斑駁:草地大片區域加柔和明暗色塊,破除「大片純綠」的平板感(值域一致,存讀檔穩定)
        const isGrassT = (t) => t === T.GRASS || t === T.GRASS2 || t === T.GRASS3;
        const BLOB = 3; // 每 3x3 tile 一個低頻取樣
        for (let by = 0; by < this.rows; by += BLOB) {
            for (let bx = 0; bx < this.cols; bx += BLOB) {
                // 該色塊中心是不是草
                const cx = Math.min(this.cols - 1, bx + 1), cy = Math.min(this.rows - 1, by + 1);
                if (!isGrassT(this.grid[cy][cx])) continue;
                const h = ((bx * 40503) ^ (by * 12289)) >>> 0;
                const k = h % 5;
                if (k >= 3) continue; // 只有部分區塊有斑駁,避免整片都髒
                sctx.fillStyle = (k === 0) ? 'rgba(255,255,210,0.05)' : (k === 1 ? 'rgba(30,80,30,0.06)' : 'rgba(70,140,60,0.05)');
                // 柔和不規則色塊(避開硬方塊,畫成階梯狀)
                const ox = bx * TILE, oy = by * TILE, w = BLOB * TILE;
                sctx.fillRect(ox + 4, oy + 4, w - 8, w - 8);
                sctx.fillRect(ox + 8, oy + 2, w - 16, w - 4);
                sctx.fillRect(ox + 2, oy + 8, w - 4, w - 16);
            }
        }
    }

    // 動態水面(浪花閃爍 + 波光),疊在靜態底圖上
    _drawWaterAnim(ctx) {
        if (!this._waterTiles) return;
        for (const [x, y, tile] of this._waterTiles) {
            this._drawTileOverlays(ctx, x, y, tile, false);
        }
    }

    // v4.8.0 玩家裝飾(像素繪製,不進 grid、不擋路)
    _drawDecorations(ctx) {
        for (const d of (this.decorations || [])) {
            const px = d.x * TILE, py = d.y * TILE;
            switch (d.type) {
                case 'flowerbed': {
                    ctx.fillStyle = '#7a5a38'; ctx.fillRect(px + 1, py + 10, 14, 5);
                    ctx.fillStyle = '#8d6a44'; ctx.fillRect(px + 1, py + 10, 14, 1);
                    const cols = ['#e84080', '#f0a030', '#f8f8f8', '#b06bd8'];
                    for (let i = 0; i < 4; i++) {
                        ctx.fillStyle = cols[i];
                        ctx.fillRect(px + 2 + i * 3, py + 6 + (i % 2) * 2, 2, 2);
                        ctx.fillStyle = '#3f8f2e';
                        ctx.fillRect(px + 2 + i * 3, py + 8 + (i % 2) * 2, 1, 2);
                    }
                    break;
                }
                case 'lamp': {
                    ctx.fillStyle = '#3a3a44'; ctx.fillRect(px + 7, py + 4, 2, 11);
                    ctx.fillStyle = '#2a2a32'; ctx.fillRect(px + 5, py + 14, 6, 2);
                    ctx.fillStyle = '#ffd23e'; ctx.fillRect(px + 5, py + 1, 6, 4);
                    ctx.fillStyle = '#3a3a44'; ctx.fillRect(px + 5, py, 6, 1); ctx.fillRect(px + 5, py + 5, 6, 1);
                    break;
                }
                case 'bench': {
                    ctx.fillStyle = '#8d6a44'; ctx.fillRect(px + 2, py + 7, 12, 3);
                    ctx.fillStyle = '#7a5a38'; ctx.fillRect(px + 2, py + 4, 12, 2);
                    ctx.fillStyle = '#5f4527'; ctx.fillRect(px + 3, py + 10, 2, 4); ctx.fillRect(px + 11, py + 10, 2, 4);
                    break;
                }
                case 'statue': {
                    ctx.fillStyle = '#8a9098'; ctx.fillRect(px + 4, py + 11, 8, 4);
                    ctx.fillStyle = '#a8b0b8'; ctx.fillRect(px + 6, py + 3, 4, 8);
                    ctx.fillStyle = '#c0c8d0'; ctx.fillRect(px + 5, py + 1, 6, 3);
                    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px + 4, py + 14, 8, 1);
                    break;
                }
                case 'fountain': {
                    ctx.fillStyle = '#9aa2ac'; ctx.fillRect(px + 1, py + 9, 14, 6);
                    ctx.fillStyle = '#38a8e0'; ctx.fillRect(px + 3, py + 10, 10, 4);
                    ctx.fillStyle = '#9aa2ac'; ctx.fillRect(px + 6, py + 4, 4, 6);
                    const spl = (this.animFrame >> 3) % 3;
                    ctx.fillStyle = 'rgba(160,220,255,0.9)';
                    ctx.fillRect(px + 7, py + 1 + spl, 2, 3);
                    ctx.fillRect(px + 4 + spl, py + 8, 1, 1); ctx.fillRect(px + 11 - spl, py + 8, 1, 1);
                    break;
                }
            }
        }
    }

    // 夜間窗戶暖光(畫在日夜色調之後,光才不會被壓暗)
    _renderWindowGlow(ctx) {
        if (!this._windowTiles || !this._windowTiles.length) return;
        const h = (this.timeHour || 12) + (this.timeMinute || 0) / 60;
        let n = 0;
        if (h >= 19 || h < 5) n = 1;
        else if (h >= 17.5 && h < 19) n = (h - 17.5) / 1.5;
        else return;
        for (const [x, y] of this._windowTiles) {
            const px = x * TILE, py = y * TILE;
            const flick = 0.85 + 0.15 * Math.sin(this.animFrame / 22 + x * 3 + y * 7);
            ctx.fillStyle = `rgba(255,205,95,${(0.45 * n * flick).toFixed(3)})`;
            ctx.fillRect(px + 2, py + 3, 12, 10);
            ctx.fillStyle = `rgba(255,180,60,${(0.10 * n).toFixed(3)})`;
            ctx.fillRect(px - 4, py - 3, 24, 22);
        }
        // v4.8.0 玩家路燈夜間發光
        for (const d of (this.decorations || [])) {
            if (d.type !== 'lamp') continue;
            const px = d.x * TILE, py = d.y * TILE;
            const flick = 0.9 + 0.1 * Math.sin(this.animFrame / 15 + d.x * 5);
            ctx.fillStyle = `rgba(255,220,110,${(0.55 * n * flick).toFixed(3)})`;
            ctx.fillRect(px + 4, py, 8, 6);
            ctx.fillStyle = `rgba(255,200,80,${(0.14 * n).toFixed(3)})`;
            ctx.fillRect(px - 8, py - 8, 32, 30);
        }
    }

    _buildTileCache() {
        // Pre-render each tile type to offscreen canvases
        for (const [type, colors] of Object.entries(TILE_COLORS)) {
            const c = document.createElement('canvas');
            c.width = TILE; c.height = TILE;
            const cx = c.getContext('2d');
            this._drawTile(cx, parseInt(type), colors);
            this.tileCache[type] = c;
        }
        // v4.5.0 屋頂配色變體(1藍 2綠 3紫,0=原紅用主快取)
        const ROOF_PALS = {
            1: { [T.ROOF]: ['#4879c0','#3a66a8','#5a8cd0','#2d5590'], [T.ROOF2]: ['#3a66a8','#2d5590','#4879c0','#234878'] },
            2: { [T.ROOF]: ['#3f9464','#347d53','#4ea875','#2a6844'], [T.ROOF2]: ['#347d53','#2a6844','#3f9464','#215538'] },
            3: { [T.ROOF]: ['#8a5fb0','#75509a','#9c70c4','#614083'], [T.ROOF2]: ['#75509a','#614083','#8a5fb0','#4f346b'] },
        };
        this._roofAltCache = {};
        for (const v of [1, 2, 3]) {
            for (const tt of [T.ROOF, T.ROOF2]) {
                const c2 = document.createElement('canvas');
                c2.width = TILE; c2.height = TILE;
                this._drawTile(c2.getContext('2d'), tt, ROOF_PALS[v][tt]);
                this._roofAltCache[`${v}_${tt}`] = c2;
            }
        }
    }

    // ============================================================
    // v4.3.0 開羅風美術升級:地形轉場 + 建築立體感(依鄰居 context 疊加)
    // ============================================================
    _drawTileOverlays(ctx, tx, ty, tile, staticOnly) {
        const g = this.grid;
        const px = tx * TILE, py = ty * TILE;
        const at = (x, y) => (y < 0 || y >= this.rows || x < 0 || x >= this.cols) ? -1 : g[y][x];
        const isGrass = t => t === T.GRASS || t === T.GRASS2 || t === T.GRASS3;
        const isWater = t => t === T.WATER || t === T.WATER2;
        const isRoof = t => t === T.ROOF || t === T.ROOF2;
        const isBldg = t => t === T.WALL_TOP || t === T.WALL_FRONT || t === T.WINDOW || isRoof(t);
        const up = at(tx, ty - 1), dn = at(tx, ty + 1), lf = at(tx - 1, ty), rt = at(tx + 1, ty);

        // --- 1. 草地鑲邊:泥土/石路遇到草,邊緣長出草鬚(去掉生硬直角) ---
        if (tile === T.DIRT || tile === T.STONE_PATH || tile === T.SAND) {
            const fr = '#5cad42', frDk = '#3f8f2e';
            if (isGrass(up)) {
                ctx.fillStyle = fr; ctx.fillRect(px, py, TILE, 2);
                ctx.fillStyle = frDk;
                ctx.fillRect(px + 2, py + 2, 2, 1); ctx.fillRect(px + 7, py + 2, 2, 1); ctx.fillRect(px + 12, py + 2, 2, 1);
            }
            if (isGrass(dn)) {
                ctx.fillStyle = fr; ctx.fillRect(px, py + TILE - 2, TILE, 2);
                ctx.fillStyle = frDk;
                ctx.fillRect(px + 3, py + TILE - 3, 2, 1); ctx.fillRect(px + 9, py + TILE - 3, 2, 1); ctx.fillRect(px + 14, py + TILE - 3, 2, 1);
            }
            if (isGrass(lf)) {
                ctx.fillStyle = fr; ctx.fillRect(px, py, 2, TILE);
                ctx.fillStyle = frDk;
                ctx.fillRect(px + 2, py + 3, 1, 2); ctx.fillRect(px + 2, py + 9, 1, 2); ctx.fillRect(px + 2, py + 14, 1, 2);
            }
            if (isGrass(rt)) {
                ctx.fillStyle = fr; ctx.fillRect(px + TILE - 2, py, 2, TILE);
                ctx.fillStyle = frDk;
                ctx.fillRect(px + TILE - 3, py + 2, 1, 2); ctx.fillRect(px + TILE - 3, py + 8, 1, 2); ctx.fillRect(px + TILE - 3, py + 13, 1, 2);
            }
            // 內圓角(兩側都是草的角落)
            ctx.fillStyle = fr;
            if (isGrass(up) && isGrass(lf)) ctx.fillRect(px, py, 4, 4);
            if (isGrass(up) && isGrass(rt)) ctx.fillRect(px + TILE - 4, py, 4, 4);
            if (isGrass(dn) && isGrass(lf)) ctx.fillRect(px, py + TILE - 4, 4, 4);
            if (isGrass(dn) && isGrass(rt)) ctx.fillRect(px + TILE - 4, py + TILE - 4, 4, 4);
        }

        // --- 2. 水岸:沙灘緣 + 深色水線 + 動態浪花 ---
        if (isWater(tile)) {
            const sand = '#e3d29b', deep = '#1a6ea8';
            const foamOn = !staticOnly && ((this.animFrame >> 5) + tx + ty) % 3 === 0; // 慢速閃爍浪花
            const shore = (x0, y0, w, h, fx, fy, fw, fh) => {
                ctx.fillStyle = sand; ctx.fillRect(x0, y0, w, h);
                ctx.fillStyle = deep;
                if (w > h) ctx.fillRect(x0, y0 === py ? y0 + h : y0 - 1, w, 1);
                else ctx.fillRect(x0 === px ? x0 + w : x0 - 1, y0, 1, h);
                if (foamOn) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(fx, fy, fw, fh); }
            };
            if (!isWater(up) && up !== -1 && up !== T.BRIDGE) shore(px, py, TILE, 2, px + 3, py + 2, 4, 1);
            if (!isWater(dn) && dn !== -1 && dn !== T.BRIDGE) shore(px, py + TILE - 2, TILE, 2, px + 8, py + TILE - 3, 4, 1);
            if (!isWater(lf) && lf !== -1 && lf !== T.BRIDGE) shore(px, py, 2, TILE, px + 2, py + 5, 1, 4);
            if (!isWater(rt) && rt !== -1 && rt !== T.BRIDGE) shore(px + TILE - 2, py, 2, TILE, px + TILE - 3, py + 9, 1, 4);
            // 波光(緩慢移動的亮點)
            const ph = ((tx * 7 + ty * 13) + (this.animFrame >> 4)) % 23;
            if (!staticOnly && ph === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillRect(px + 4 + (ty % 3) * 3, py + 5 + (tx % 3) * 2, 3, 1);
            }
        }

        // --- 3. 建築落影:建築在上/左的地面 tile 承接柔影(立體感關鍵) ---
        if (!isBldg(tile) && tile !== T.DOOR && !isWater(tile)) {
            if (isBldg(up) || up === T.DOOR) {
                ctx.fillStyle = 'rgba(20,20,35,0.30)'; ctx.fillRect(px, py, TILE, 3);
                ctx.fillStyle = 'rgba(20,20,35,0.15)'; ctx.fillRect(px, py + 3, TILE, 3);
            }
            if (isBldg(lf)) {
                ctx.fillStyle = 'rgba(20,20,35,0.22)'; ctx.fillRect(px, py, 2, TILE);
                ctx.fillStyle = 'rgba(20,20,35,0.10)'; ctx.fillRect(px + 2, py, 2, TILE);
            }
        }

        // --- v5.7.0 植被落影:植物/樹在上方 → 下方地面承接柔影,讓草木落地不飄浮 ---
        const isVeg = t => t === T.BUSH || t === T.TREE_TOP || t === T.TREE_TOP2 || t === T.TREE_TRUNK || t === T.ROCK;
        const isGround = t => isGrass(t) || t === T.DIRT || t === T.STONE_PATH || t === T.SAND;
        if (isGround(tile) && isVeg(up)) {
            ctx.fillStyle = 'rgba(18,28,14,0.22)'; ctx.fillRect(px + 2, py, TILE - 4, 3);
            ctx.fillStyle = 'rgba(18,28,14,0.11)'; ctx.fillRect(px + 1, py + 3, TILE - 2, 2);
        }

        // --- v5.7.0 破除重複貼磚:依座標給灌木/花微調明暗與高光位置,相鄰植物不再像複製貼上 ---
        if (tile === T.BUSH || tile === T.FLOWER1 || tile === T.FLOWER2) {
            const hsh = ((tx * 49157) ^ (ty * 98317)) >>> 0;
            const m = hsh % 3;
            if (m === 0) { ctx.fillStyle = 'rgba(0,0,0,0.11)'; ctx.fillRect(px, py, TILE, TILE); }
            else if (m === 1) { ctx.fillStyle = 'rgba(255,250,180,0.07)'; ctx.fillRect(px, py, TILE, TILE); }
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            ctx.fillRect(px + 2 + (hsh % 9), py + 1 + ((hsh >> 4) % 6), 1, 1);
            if ((hsh >> 6) & 1) ctx.fillRect(px + 3 + ((hsh >> 2) % 8), py + 3 + ((hsh >> 7) % 5), 1, 1);
        }

        // --- 4. 屋頂:脊線高光 / 屋簷深緣 / 側緣描邊 ---
        if (isRoof(tile)) {
            // v5.7.1 屋頂體積:整片依「離屋脊多遠」漸暗(頂亮底暗),屋頂看起來是斜面不是平板
            let depth = 0; // 往上數幾格還是屋頂 → 離脊越遠越暗
            for (let k = 1; k <= 4; k++) { if (isRoof(at(tx, ty - k))) depth++; else break; }
            if (depth > 0) { ctx.fillStyle = `rgba(30,8,8,${Math.min(0.28, depth * 0.08)})`; ctx.fillRect(px, py, TILE, TILE); }
            if (!isRoof(up)) {
                ctx.fillStyle = 'rgba(255,238,214,0.5)'; ctx.fillRect(px, py, TILE, 2);   // 屋脊亮線加強
                ctx.fillStyle = 'rgba(255,250,235,0.3)'; ctx.fillRect(px, py, TILE, 1);
                ctx.fillStyle = 'rgba(60,15,15,0.35)'; ctx.fillRect(px, py + 2, TILE, 1);
            }
            if (!isRoof(dn)) {
                ctx.fillStyle = 'rgba(35,8,8,0.5)'; ctx.fillRect(px, py + TILE - 2, TILE, 2); // 屋簷更深
                ctx.fillStyle = 'rgba(20,4,4,0.35)'; ctx.fillRect(px, py + TILE - 1, TILE, 1);
            }
            if (!isRoof(lf)) { ctx.fillStyle = 'rgba(40,10,10,0.35)'; ctx.fillRect(px, py, 1, TILE); }
            if (!isRoof(rt)) { ctx.fillStyle = 'rgba(40,10,10,0.35)'; ctx.fillRect(px + TILE - 1, py, 1, TILE); }
        }

        // --- 5. 屋簷投影:屋頂下方的牆面頂部壓暗 ---
        if ((tile === T.WALL_FRONT || tile === T.WINDOW || tile === T.DOOR) && isRoof(up)) {
            ctx.fillStyle = 'rgba(20,10,5,0.30)'; ctx.fillRect(px, py, TILE, 3);
        }

        // --- 6. 建築外緣描邊(牆遇到地面的一側加 1px 深線,輪廓乾淨) ---
        if (isBldg(tile)) {
            ctx.fillStyle = 'rgba(30,20,15,0.55)';
            if (!isBldg(lf) && lf !== T.DOOR && lf !== -1) ctx.fillRect(px, py, 1, TILE);
            if (!isBldg(rt) && rt !== T.DOOR && rt !== -1) ctx.fillRect(px + TILE - 1, py, 1, TILE);
            if ((tile === T.WALL_FRONT || tile === T.WINDOW) && !isBldg(dn) && dn !== T.DOOR && dn !== -1) {
                ctx.fillRect(px, py + TILE - 1, TILE, 1);
            }
        }
    }

    _drawTile(ctx, type, colors) {
        const [c1, c2, c3, c4] = colors;
        const S = TILE; // 16
        ctx.fillStyle = c1;
        ctx.fillRect(0, 0, S, S);

        switch(type) {
            case T.GRASS: case T.GRASS2: case T.GRASS3: {
                // 開羅風草地:GRASS 幾乎全平(大片乾淨),點綴集中在 GRASS2/3(低頻散布)
                ctx.fillStyle = c2;
                ctx.fillRect(3,2,4,3); ctx.fillRect(10,9,4,3);
                if (type === T.GRASS2) {
                    // 草叢 + 小花
                    ctx.fillStyle = c4;
                    ctx.fillRect(4,5,1,2); ctx.fillRect(6,5,1,2); ctx.fillRect(5,4,1,2);
                    ctx.fillStyle = c3; ctx.fillRect(5,3,1,1);
                    ctx.fillStyle='#f4b642'; ctx.fillRect(11,10,2,2);
                    ctx.fillStyle='#fff8e0'; ctx.fillRect(11,10,1,1);
                }
                if (type === T.GRASS3) {
                    // 草叢 + 小石子
                    ctx.fillStyle = c4;
                    ctx.fillRect(10,4,1,2); ctx.fillRect(12,4,1,2); ctx.fillRect(11,3,1,2);
                    ctx.fillStyle = c3; ctx.fillRect(11,2,1,1);
                    ctx.fillStyle='#b8b09a'; ctx.fillRect(4,11,2,1);
                    ctx.fillStyle='#d0c8b2'; ctx.fillRect(4,10,2,1);
                }
                break;
            }

            case T.DIRT: {
                // Rich brown dirt path with grass edge tufts
                ctx.fillStyle = c2; // darker patches
                ctx.fillRect(0,2,4,3); ctx.fillRect(5,0,6,2); ctx.fillRect(10,4,5,3);
                ctx.fillRect(1,8,5,3); ctx.fillRect(7,10,6,3); ctx.fillRect(0,13,4,3);
                ctx.fillStyle = c3; // lighter worn patches
                ctx.fillRect(3,4,3,2); ctx.fillRect(8,2,3,2); ctx.fillRect(12,8,3,2);
                ctx.fillRect(2,11,3,2); ctx.fillRect(7,6,4,2);
                // Pebbles
                ctx.fillStyle = c4;
                ctx.fillRect(4,3,2,1); ctx.fillRect(9,7,1,1); ctx.fillRect(13,12,2,1);
                ctx.fillRect(1,6,1,1); ctx.fillRect(11,1,1,1);
                // Grass tufts on edges
                ctx.fillStyle = '#5cad42';
                ctx.fillRect(0,0,1,3); ctx.fillRect(15,0,1,2); ctx.fillRect(0,14,1,2); ctx.fillRect(15,13,1,3);
                ctx.fillStyle = '#489238';
                ctx.fillRect(1,0,1,2); ctx.fillRect(14,0,1,1); ctx.fillRect(1,15,1,1); ctx.fillRect(14,14,1,2);
                break;
            }

            case T.STONE_PATH: {
                // Cobblestones with mortar (brown-gray stones like reference)
                ctx.fillStyle = c4; ctx.fillRect(0,0,S,S); // mortar base
                // Individual stones
                ctx.fillStyle = c1; ctx.fillRect(0,0,6,6); ctx.fillRect(7,0,5,4); ctx.fillRect(13,0,3,5);
                ctx.fillRect(0,7,4,5); ctx.fillRect(5,5,6,5); ctx.fillRect(12,6,4,4);
                ctx.fillRect(0,13,5,3); ctx.fillRect(6,11,5,5); ctx.fillRect(12,11,4,5);
                // Stone highlights
                ctx.fillStyle = c3;
                ctx.fillRect(1,1,3,2); ctx.fillRect(8,1,2,1); ctx.fillRect(14,1,1,2);
                ctx.fillRect(1,8,2,2); ctx.fillRect(6,6,3,1); ctx.fillRect(13,7,2,1);
                ctx.fillRect(1,14,2,1); ctx.fillRect(7,12,2,1); ctx.fillRect(13,12,2,1);
                // Stone shadows
                ctx.fillStyle = c2;
                ctx.fillRect(4,4,2,2); ctx.fillRect(10,3,2,1); ctx.fillRect(3,10,1,2);
                ctx.fillRect(9,9,2,2); ctx.fillRect(4,15,1,1); ctx.fillRect(10,15,1,1);
                break;
            }

            case T.WALL_TOP:
                ctx.fillStyle = c2; ctx.fillRect(0,S-2,S,2);
                ctx.fillStyle = c4; ctx.fillRect(0,0,S,1);
                ctx.fillStyle = c1;
                for (let x = 0; x < S; x += 4) ctx.fillRect(x, 2, 3, 4);
                for (let x = 2; x < S; x += 4) ctx.fillRect(x, 8, 3, 4);
                ctx.fillStyle = c3;
                ctx.fillRect(0,2,1,1); ctx.fillRect(4,2,1,1); ctx.fillRect(8,2,1,1); ctx.fillRect(12,2,1,1);
                ctx.fillRect(2,8,1,1); ctx.fillRect(6,8,1,1); ctx.fillRect(10,8,1,1); ctx.fillRect(14,8,1,1);
                ctx.fillStyle = c4; ctx.fillRect(0,6,S,1); ctx.fillRect(0,12,S,1);
                break;

            case T.WALL_FRONT:
                ctx.fillStyle = c2;
                for (let x = 0; x < S; x += 4) ctx.fillRect(x, 0, 3, 7);
                for (let x = 2; x < S; x += 4) ctx.fillRect(x, 8, 3, 8);
                ctx.fillStyle = c4; ctx.fillRect(0, 7, S, 1);
                ctx.fillStyle = c3;
                for (let x = 0; x < S; x += 4) ctx.fillRect(x, 1, 1, 1);
                for (let x = 2; x < S; x += 4) ctx.fillRect(x, 9, 1, 1);
                break;

            case T.FLOOR: case T.FLOOR2:
                ctx.fillStyle = c2; ctx.fillRect(0,0,S,1); ctx.fillRect(0,0,1,S);
                ctx.fillStyle = c3;
                ctx.fillRect(3,2,1,5); ctx.fillRect(8,1,1,6); ctx.fillRect(13,3,1,4);
                ctx.fillRect(5,9,1,5); ctx.fillRect(10,8,1,6); ctx.fillRect(2,10,1,4);
                ctx.fillStyle = c4; ctx.fillRect(0,8,S,1);
                ctx.fillRect(7,0,1,8); ctx.fillRect(3,8,1,8); ctx.fillRect(12,8,1,8);
                break;

            case T.DOOR:
                ctx.fillStyle = c4; ctx.fillRect(1,0,14,S);
                ctx.fillStyle = c1; ctx.fillRect(3,1,10,14);
                ctx.fillStyle = c2; ctx.fillRect(4,2,8,5); ctx.fillRect(4,9,8,4);
                ctx.fillStyle = c3; ctx.fillRect(4,2,8,1); ctx.fillRect(4,9,8,1);
                ctx.fillStyle = '#d4aa70'; ctx.fillRect(10,7,2,2);
                ctx.fillStyle = '#b8943e'; ctx.fillRect(10,7,1,1);
                break;

            case T.WATER: case T.WATER2: {
                // Bright vivid water with shimmer
                ctx.fillStyle = c2;
                ctx.fillRect(0,3,S,5); ctx.fillRect(2,9,S,4);
                ctx.fillStyle = c4;
                ctx.fillRect(0,13,S,3);
                // Wave crests (bright highlights)
                ctx.fillStyle = c3;
                ctx.fillRect(1,2,4,1); ctx.fillRect(7,1,5,1); ctx.fillRect(12,3,3,1);
                ctx.fillRect(0,8,3,1); ctx.fillRect(5,7,4,1); ctx.fillRect(10,9,4,1);
                // White sparkle highlights
                ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.35;
                ctx.fillRect(2,1,3,1); ctx.fillRect(9,0,2,1); ctx.fillRect(4,6,2,1); ctx.fillRect(11,8,3,1);
                ctx.globalAlpha = 0.18;
                ctx.fillRect(0,4,2,1); ctx.fillRect(6,3,3,1); ctx.fillRect(13,5,2,1);
                ctx.fillRect(1,10,2,1); ctx.fillRect(8,11,3,1);
                ctx.globalAlpha = 1;
                break;
            }

            case T.TREE_TRUNK: {
                // Thick trunk on grass with visible bark and roots
                const gc = '#5cad42';
                ctx.fillStyle = gc; ctx.fillRect(0,0,S,S);
                // Grass blades around trunk
                ctx.fillStyle = '#68b84e';
                ctx.fillRect(0,1,1,3); ctx.fillRect(2,0,1,2); ctx.fillRect(13,1,1,3); ctx.fillRect(15,0,1,2);
                ctx.fillRect(0,9,1,3); ctx.fillRect(2,10,1,2); ctx.fillRect(13,8,1,4); ctx.fillRect(15,10,1,2);
                // Trunk
                ctx.fillStyle = c1; ctx.fillRect(4,0,8,S);
                ctx.fillStyle = c3; ctx.fillRect(6,0,3,S); // bark highlight
                ctx.fillStyle = c4; ctx.fillRect(4,0,1,S); ctx.fillRect(11,0,1,S); // dark edges
                // Bark texture
                ctx.fillStyle = c4;
                ctx.fillRect(5,2,1,2); ctx.fillRect(8,5,1,3); ctx.fillRect(5,8,1,2);
                ctx.fillRect(9,10,1,2); ctx.fillRect(6,13,1,2);
                ctx.fillStyle = c2;
                ctx.fillRect(7,1,1,2); ctx.fillRect(10,4,1,2); ctx.fillRect(7,9,1,2);
                // Roots spreading out
                ctx.fillStyle = c1;
                ctx.fillRect(2,13,3,2); ctx.fillRect(11,14,3,2);
                ctx.fillRect(1,14,2,2); ctx.fillRect(13,13,2,2);
                ctx.fillStyle = c2;
                ctx.fillRect(3,14,1,1); ctx.fillRect(12,14,1,1);
                break;
            }

            case T.TREE_TOP: case T.TREE_TOP2: {
                // Dense lush canopy with light dapples
                // Outer canopy shadow
                ctx.fillStyle = c4;
                ctx.fillRect(0,3,S,12); ctx.fillRect(1,1,14,2);
                // Main foliage body
                ctx.fillStyle = c1;
                ctx.fillRect(1,2,14,12); ctx.fillRect(2,1,12,1); ctx.fillRect(0,5,1,6); ctx.fillRect(15,5,1,6);
                // Inner darker foliage
                ctx.fillStyle = c2;
                ctx.fillRect(2,8,12,6); ctx.fillRect(1,10,2,4); ctx.fillRect(13,10,2,4);
                // Top highlight layer
                ctx.fillStyle = c3;
                ctx.fillRect(3,1,10,4); ctx.fillRect(5,0,6,2);
                // Scattered light dapples (like sunlight through leaves)
                ctx.fillStyle = c3;
                ctx.fillRect(4,3,2,1); ctx.fillRect(8,2,2,1); ctx.fillRect(12,4,1,1);
                ctx.fillRect(2,5,1,1); ctx.fillRect(6,6,2,1); ctx.fillRect(10,5,2,1);
                ctx.fillRect(3,8,1,1); ctx.fillRect(7,9,2,1); ctx.fillRect(11,7,1,1);
                ctx.fillRect(5,11,1,1); ctx.fillRect(9,10,1,1); ctx.fillRect(13,8,1,1);
                // Deep shadow accents
                ctx.fillStyle = c4;
                ctx.fillRect(3,12,2,2); ctx.fillRect(8,13,3,1); ctx.fillRect(12,11,2,2);
                ctx.fillRect(1,8,1,3); ctx.fillRect(14,9,1,2);
                break;
            }

            case T.ROOF: case T.ROOF2:
                ctx.fillStyle = c1; ctx.fillRect(0,0,S,S);
                ctx.fillStyle = c2;
                for (let x = 0; x < S; x += 4) { ctx.fillRect(x, 1, 3, 3); ctx.fillRect(x, 5, 3, 1); }
                for (let x = 2; x < S; x += 4) { ctx.fillRect(x, 8, 3, 3); ctx.fillRect(x, 12, 3, 1); }
                ctx.fillStyle = c3; ctx.fillRect(0,7,S,1);
                ctx.fillStyle = c4;
                for (let x = 0; x < S; x += 4) ctx.fillRect(x, 4, 3, 1);
                for (let x = 2; x < S; x += 4) ctx.fillRect(x, 11, 3, 1);
                break;

            case T.FENCE_H: {
                // Wooden fence on lush grass
                const gc2 = '#5cad42';
                ctx.fillStyle = gc2; ctx.fillRect(0,0,S,S);
                ctx.fillStyle = '#68b84e';
                ctx.fillRect(1,1,1,3); ctx.fillRect(5,0,1,2); ctx.fillRect(9,2,1,3);
                ctx.fillRect(1,9,1,2); ctx.fillRect(6,12,1,3); ctx.fillRect(11,10,1,2);
                ctx.fillStyle = c1; ctx.fillRect(0,5,S,2); ctx.fillRect(0,10,S,2);
                ctx.fillStyle = c2; ctx.fillRect(2,3,2,12); ctx.fillRect(12,3,2,12);
                ctx.fillStyle = c3; ctx.fillRect(3,4,1,10); ctx.fillRect(13,4,1,10);
                ctx.fillStyle = c4; ctx.fillRect(0,6,S,1); ctx.fillRect(0,11,S,1);
                break;
            }

            case T.FENCE_V: {
                const gc3 = '#5cad42';
                ctx.fillStyle = gc3; ctx.fillRect(0,0,S,S);
                ctx.fillStyle = '#68b84e';
                ctx.fillRect(1,1,1,3); ctx.fillRect(13,2,1,3); ctx.fillRect(2,10,1,3); ctx.fillRect(14,9,1,3);
                ctx.fillStyle = c1; ctx.fillRect(5,0,2,S); ctx.fillRect(10,0,2,S);
                ctx.fillStyle = c2; ctx.fillRect(3,2,12,2); ctx.fillRect(3,12,12,2);
                ctx.fillStyle = c3; ctx.fillRect(6,0,1,S); ctx.fillRect(11,0,1,S);
                break;
            }

            case T.CROP1: case T.CROP2: case T.CROP3: {
                // Rich tilled soil with lush crop rows
                ctx.fillStyle = '#7a5830'; ctx.fillRect(0,0,S,S);
                ctx.fillStyle = '#6b4820'; // furrows
                ctx.fillRect(0,4,S,1); ctx.fillRect(0,9,S,1); ctx.fillRect(0,14,S,1);
                ctx.fillStyle = '#8a6838'; // lighter soil
                ctx.fillRect(2,1,3,2); ctx.fillRect(8,6,3,2); ctx.fillRect(1,11,3,2);
                // Stems
                ctx.fillStyle = c1;
                for (let x = 1; x < S; x += 3) { ctx.fillRect(x, 1, 1, 3); ctx.fillRect(x, 6, 1, 3); ctx.fillRect(x, 11, 1, 3); }
                // Leaves / tops
                ctx.fillStyle = c2;
                for (let x = 0; x < S; x += 3) { ctx.fillRect(x, 0, 3, 2); ctx.fillRect(x, 5, 3, 2); ctx.fillRect(x, 10, 3, 2); }
                // Bright highlights
                ctx.fillStyle = c3;
                ctx.fillRect(1,0,1,1); ctx.fillRect(4,5,1,1); ctx.fillRect(7,0,1,1); ctx.fillRect(10,5,1,1); ctx.fillRect(13,10,1,1);
                break;
            }

            case T.FLOWER1: case T.FLOWER2: {
                // Colorful flower clusters on grass (like reference image)
                const gc4 = '#5cad42';
                ctx.fillStyle = gc4; ctx.fillRect(0,0,S,S);
                // Grass blades underneath
                ctx.fillStyle = '#68b84e';
                ctx.fillRect(0,1,1,3); ctx.fillRect(4,0,1,2); ctx.fillRect(8,2,1,3);
                ctx.fillRect(12,0,1,3); ctx.fillRect(2,8,1,3); ctx.fillRect(6,9,1,2);
                ctx.fillRect(10,8,1,3); ctx.fillRect(14,10,1,2);
                // Stems
                ctx.fillStyle = '#388030';
                ctx.fillRect(2,4,1,7); ctx.fillRect(6,3,1,8); ctx.fillRect(10,5,1,6);
                ctx.fillRect(14,4,1,6); ctx.fillRect(4,7,1,5);
                // Leaves
                ctx.fillStyle = '#48902a';
                ctx.fillRect(1,7,2,1); ctx.fillRect(5,6,2,1); ctx.fillRect(9,8,2,1);
                ctx.fillRect(3,10,2,1); ctx.fillRect(13,7,2,1);
                // Flower petals (multiple colors like reference)
                ctx.fillStyle = c1; // main color
                ctx.fillRect(1,1,3,3); ctx.fillRect(5,1,3,3); ctx.fillRect(9,2,3,3);
                ctx.fillRect(13,1,3,3); ctx.fillRect(3,6,3,2);
                // White accent petals
                ctx.fillStyle = '#fff';
                ctx.fillRect(1,1,1,1); ctx.fillRect(5,1,1,1); ctx.fillRect(9,2,1,1); ctx.fillRect(13,1,1,1);
                // Second flower color (complement)
                const fc2 = type === T.FLOWER1 ? '#fff' : '#e84080';
                ctx.fillStyle = fc2;
                ctx.fillRect(0,8,2,2); ctx.fillRect(7,9,3,2); ctx.fillRect(12,8,2,2);
                // Stamen dots
                ctx.fillStyle = '#f0c030';
                ctx.fillRect(2,2,1,1); ctx.fillRect(6,2,1,1); ctx.fillRect(10,3,1,1);
                ctx.fillRect(14,2,1,1); ctx.fillRect(4,7,1,1);
                break;
            }

            case T.BUSH: {
                // Large round bush with volume (like reference)
                const gc5 = '#5cad42';
                ctx.fillStyle = gc5; ctx.fillRect(0,0,S,S);
                // Grass peeking
                ctx.fillStyle = '#68b84e';
                ctx.fillRect(0,1,1,2); ctx.fillRect(15,0,1,3); ctx.fillRect(0,13,1,3); ctx.fillRect(15,14,1,2);
                // Bush shadow
                ctx.fillStyle = c4; ctx.fillRect(2,6,13,10);
                // Bush body
                ctx.fillStyle = c1; ctx.fillRect(1,4,14,10);
                ctx.fillRect(3,2,10,3); ctx.fillRect(0,6,1,6); ctx.fillRect(15,6,1,6);
                // Inner dark foliage
                ctx.fillStyle = c2;
                ctx.fillRect(2,8,12,6); ctx.fillRect(1,10,1,4);
                // Top highlight
                ctx.fillStyle = c3;
                ctx.fillRect(4,2,8,3); ctx.fillRect(5,1,6,2);
                // Light dapples
                ctx.fillStyle = c3;
                ctx.fillRect(3,5,2,1); ctx.fillRect(7,4,2,1); ctx.fillRect(11,3,2,1);
                ctx.fillRect(4,7,1,1); ctx.fillRect(9,6,1,1);
                // Small flower accents on bush
                ctx.fillStyle = '#e84080'; ctx.fillRect(5,5,1,1); ctx.fillRect(10,4,1,1);
                ctx.fillStyle = '#f0a030'; ctx.fillRect(3,7,1,1); ctx.fillRect(11,6,1,1);
                ctx.fillStyle = '#fff'; ctx.fillRect(7,3,1,1); ctx.fillRect(12,5,1,1);
                break;
            }

            case T.ROCK: {
                // Gray stones on grass (like reference cobbles)
                const gc6 = '#5cad42';
                ctx.fillStyle = gc6; ctx.fillRect(0,0,S,S);
                ctx.fillStyle = '#68b84e';
                ctx.fillRect(1,0,1,3); ctx.fillRect(14,1,1,2); ctx.fillRect(0,12,1,3); ctx.fillRect(15,11,1,3);
                // Rock shadow
                ctx.fillStyle = c4; ctx.fillRect(2,6,12,10);
                // Main rock body
                ctx.fillStyle = c1; ctx.fillRect(3,4,10,9);
                // Top face (lighter)
                ctx.fillStyle = c3; ctx.fillRect(4,3,8,4);
                // Side face
                ctx.fillStyle = c2; ctx.fillRect(3,7,10,5);
                // Highlights
                ctx.fillStyle = c3;
                ctx.fillRect(5,3,3,1); ctx.fillRect(4,4,2,1);
                // Cracks
                ctx.fillStyle = c4;
                ctx.fillRect(6,5,1,3); ctx.fillRect(8,6,1,2); ctx.fillRect(5,9,1,2);
                // Moss on rock
                ctx.fillStyle = '#5cad42';
                ctx.fillRect(3,11,2,1); ctx.fillRect(10,12,2,1);
                ctx.fillStyle = '#489238';
                ctx.fillRect(4,12,1,1); ctx.fillRect(11,11,1,1);
                break;
            }

            case T.BARREL:
                ctx.fillStyle = c1; ctx.fillRect(3,2,10,12);
                ctx.fillStyle = c3; ctx.fillRect(4,3,2,10);
                ctx.fillStyle = c4; ctx.fillRect(10,3,2,10);
                ctx.fillStyle = c2; ctx.fillRect(4,1,8,2); ctx.fillRect(4,13,8,2);
                ctx.fillStyle = '#6e6e6e'; ctx.fillRect(3,4,10,1); ctx.fillRect(3,10,10,1);
                ctx.fillStyle = '#888'; ctx.fillRect(4,4,1,1); ctx.fillRect(4,10,1,1);
                break;

            case T.CRATE:
                ctx.fillStyle = c1; ctx.fillRect(2,2,12,12);
                ctx.fillStyle = c4; ctx.fillRect(2,2,12,1); ctx.fillRect(2,13,12,1);
                ctx.fillStyle = c4; ctx.fillRect(2,2,1,12); ctx.fillRect(13,2,1,12);
                ctx.fillStyle = c2; ctx.fillRect(3,3,10,10);
                ctx.fillStyle = c3; ctx.fillRect(7,3,1,10); ctx.fillRect(3,7,10,1);
                ctx.fillStyle = '#888'; ctx.fillRect(3,3,1,1); ctx.fillRect(12,3,1,1);
                ctx.fillRect(3,12,1,1); ctx.fillRect(12,12,1,1);
                break;

            case T.TABLE:
                ctx.fillStyle = c4; ctx.fillRect(3,5,11,9);
                ctx.fillStyle = c1; ctx.fillRect(2,3,12,8);
                ctx.fillStyle = c3; ctx.fillRect(2,3,12,1);
                ctx.fillStyle = c2; ctx.fillRect(3,4,10,1);
                ctx.fillStyle = c4; ctx.fillRect(3,11,2,3); ctx.fillRect(11,11,2,3);
                break;

            case T.CHAIR:
                ctx.fillStyle = c1; ctx.fillRect(4,1,8,4);
                ctx.fillStyle = c3; ctx.fillRect(4,1,8,1);
                ctx.fillStyle = c2; ctx.fillRect(4,5,8,5);
                ctx.fillStyle = c4; ctx.fillRect(4,10,2,4); ctx.fillRect(10,10,2,4);
                ctx.fillStyle = c3; ctx.fillRect(5,6,6,1);
                break;

            case T.BED:
                ctx.fillStyle = c4; ctx.fillRect(2,2,12,13);
                ctx.fillStyle = c1; ctx.fillRect(3,3,10,11);
                ctx.fillStyle = '#5c6bc0'; ctx.fillRect(3,5,10,9);
                ctx.fillStyle = '#7986cb'; ctx.fillRect(4,6,8,3);
                ctx.fillStyle = '#fff'; ctx.fillRect(4,2,8,3);
                ctx.fillStyle = '#e8e8e8'; ctx.fillRect(5,3,6,1);
                ctx.fillStyle = '#3f51b5'; ctx.fillRect(5,8,2,1); ctx.fillRect(9,10,2,1);
                break;

            case T.ANVIL:
                ctx.fillStyle = c4; ctx.fillRect(4,10,8,4);
                ctx.fillStyle = c1; ctx.fillRect(3,6,10,5);
                ctx.fillStyle = c2; ctx.fillRect(2,4,12,3);
                ctx.fillStyle = c3; ctx.fillRect(4,2,8,3);
                ctx.fillStyle = c4; ctx.fillRect(1,5,3,2);
                ctx.fillStyle = '#888'; ctx.fillRect(5,3,6,1);
                break;

            case T.FURNACE:
                ctx.fillStyle = '#455a64'; ctx.fillRect(2,1,12,14);
                ctx.fillStyle = '#37474f'; ctx.fillRect(2,1,12,2);
                ctx.fillStyle = c1; ctx.fillRect(4,7,8,6);
                ctx.fillStyle = c2; ctx.fillRect(5,5,6,3);
                ctx.fillStyle = '#ff9800'; ctx.fillRect(5,8,6,4);
                ctx.fillStyle = '#ffeb3b'; ctx.fillRect(6,9,4,2);
                ctx.fillStyle = '#fff'; ctx.globalAlpha=0.3; ctx.fillRect(7,10,2,1); ctx.globalAlpha=1;
                break;

            case T.COUNTER:
                ctx.fillStyle = c4; ctx.fillRect(0,5,S,9);
                ctx.fillStyle = c1; ctx.fillRect(0,3,S,8);
                ctx.fillStyle = c3; ctx.fillRect(0,3,S,1);
                ctx.fillStyle = c2; ctx.fillRect(1,4,14,1);
                ctx.fillStyle = c4; ctx.fillRect(0,11,S,1);
                break;

            case T.BOOKSHELF:
                ctx.fillStyle = c1; ctx.fillRect(1,0,14,S);
                ctx.fillStyle = c4; ctx.fillRect(1,0,14,1); ctx.fillRect(1,7,14,1);
                ctx.fillStyle = '#c62828'; ctx.fillRect(2,1,2,6);
                ctx.fillStyle = '#1565c0'; ctx.fillRect(4,1,3,6);
                ctx.fillStyle = '#2e7d32'; ctx.fillRect(7,2,2,5);
                ctx.fillStyle = '#f9a825'; ctx.fillRect(9,1,2,6);
                ctx.fillStyle = '#6a1b9a'; ctx.fillRect(11,1,3,6);
                ctx.fillStyle = '#e65100'; ctx.fillRect(2,8,3,6);
                ctx.fillStyle = '#00838f'; ctx.fillRect(5,9,2,5);
                ctx.fillStyle = '#ad1457'; ctx.fillRect(7,8,3,6);
                ctx.fillStyle = '#33691e'; ctx.fillRect(10,8,2,6);
                ctx.fillStyle = '#4527a0'; ctx.fillRect(12,9,2,5);
                break;

            case T.WELL: {
                const gc7 = '#5cad42';
                ctx.fillStyle = gc7; ctx.fillRect(0,0,S,S);
                ctx.fillStyle = '#68b84e';
                ctx.fillRect(1,0,1,3); ctx.fillRect(14,1,1,2); ctx.fillRect(0,13,1,3); ctx.fillRect(15,13,1,3);
                ctx.fillStyle = c4; ctx.fillRect(3,3,10,10);
                ctx.fillStyle = c1; ctx.fillRect(3,3,10,10);
                ctx.fillStyle = '#2890c8'; ctx.fillRect(5,5,6,6);
                ctx.fillStyle = '#58c0f0'; ctx.fillRect(6,6,3,2);
                ctx.fillStyle = c2;
                ctx.fillRect(3,3,10,2); ctx.fillRect(3,11,10,2);
                ctx.fillRect(3,3,2,10); ctx.fillRect(11,3,2,10);
                ctx.fillStyle = c3; ctx.fillRect(4,4,1,1); ctx.fillRect(11,4,1,1);
                break;
            }

            case T.ALTAR:
                ctx.fillStyle = c4; ctx.fillRect(4,6,8,9);
                ctx.fillStyle = c1; ctx.fillRect(3,4,10,9);
                ctx.fillStyle = c2; ctx.fillRect(4,2,8,3);
                ctx.fillStyle = '#fff'; ctx.fillRect(6,3,4,1);
                ctx.fillStyle = '#fff'; ctx.fillRect(7,2,2,2);
                ctx.fillStyle = '#fff8e1'; ctx.fillRect(4,1,1,3); ctx.fillRect(11,1,1,3);
                ctx.fillStyle = '#ff9800'; ctx.fillRect(4,0,1,1); ctx.fillRect(11,0,1,1);
                break;

            case T.SAND: {
                // Sandy shore with grass transition
                ctx.fillStyle = c2;
                ctx.fillRect(2,3,3,1); ctx.fillRect(8,6,3,1); ctx.fillRect(4,11,3,1);
                ctx.fillRect(12,2,3,1); ctx.fillRect(0,8,2,1);
                ctx.fillStyle = c3;
                ctx.fillRect(6,1,2,1); ctx.fillRect(11,5,2,1); ctx.fillRect(1,9,2,1); ctx.fillRect(9,13,2,1);
                ctx.fillStyle = c4;
                ctx.fillRect(5,4,1,1); ctx.fillRect(10,8,1,1); ctx.fillRect(3,12,1,1);
                // Grass tufts
                ctx.fillStyle = '#5cad42';
                ctx.fillRect(0,0,1,2); ctx.fillRect(15,0,1,1);
                ctx.fillStyle = '#68b84e';
                ctx.fillRect(1,0,1,1); ctx.fillRect(14,0,1,1);
                break;
            }

            case T.BRIDGE:
                ctx.fillStyle = c1; ctx.fillRect(0,0,S,S);
                ctx.fillStyle = c4;
                ctx.fillRect(0,3,S,1); ctx.fillRect(0,7,S,1); ctx.fillRect(0,11,S,1);
                ctx.fillStyle = c2;
                ctx.fillRect(0,0,S,2); ctx.fillRect(0,14,S,2);
                ctx.fillStyle = c3;
                ctx.fillRect(2,0,2,S); ctx.fillRect(12,0,2,S);
                ctx.fillStyle = c4; ctx.fillRect(3,1,1,14); ctx.fillRect(13,1,1,14);
                break;

            case T.STALL:
                ctx.fillStyle = c1; ctx.fillRect(1,6,14,8);
                ctx.fillStyle = '#e65100'; ctx.fillRect(0,1,8,5);
                ctx.fillStyle = '#ff8f00'; ctx.fillRect(8,1,8,5);
                ctx.fillStyle = '#e65100'; ctx.fillRect(0,0,S,1);
                ctx.fillStyle = c2; ctx.fillRect(2,7,12,5);
                ctx.fillStyle = '#8bc34a'; ctx.fillRect(3,8,3,2);
                ctx.fillStyle = '#ff5722'; ctx.fillRect(7,8,3,2);
                ctx.fillStyle = '#ffeb3b'; ctx.fillRect(11,8,3,2);
                break;

            case T.WEAPON_RACK:
                ctx.fillStyle = c1; ctx.fillRect(2,0,12,S);
                ctx.fillStyle = c2; ctx.fillRect(2,0,1,S); ctx.fillRect(13,0,1,S);
                ctx.fillStyle = '#b0bec5';
                ctx.fillRect(4,2,1,10); ctx.fillRect(7,1,1,11); ctx.fillRect(10,2,1,10);
                ctx.fillStyle = '#8d6e63';
                ctx.fillRect(4,12,1,3); ctx.fillRect(7,12,1,3); ctx.fillRect(10,12,1,3);
                ctx.fillStyle = '#d4aa70'; ctx.fillRect(5,4,1,1); ctx.fillRect(11,4,1,1);
                break;

            case T.WINDOW:
                ctx.fillStyle = '#574a32'; ctx.fillRect(0,0,S,S);
                ctx.fillStyle = c1; ctx.fillRect(2,2,12,12);
                ctx.fillStyle = c2;
                ctx.fillRect(3,3,4,4); ctx.fillRect(9,3,4,4);
                ctx.fillRect(3,9,4,4); ctx.fillRect(9,9,4,4);
                ctx.fillStyle = '#574a32';
                ctx.fillRect(7,2,2,12); ctx.fillRect(2,7,12,2);
                ctx.fillStyle = c3;
                ctx.fillRect(3,3,2,1); ctx.fillRect(9,3,2,1);
                ctx.fillStyle = '#fff'; ctx.globalAlpha=0.15; ctx.fillRect(3,3,1,2); ctx.fillRect(9,3,1,2); ctx.globalAlpha=1;
                break;

            case T.DARK_FLOOR:
                ctx.fillStyle = c1; ctx.fillRect(0,0,S,S);
                ctx.fillStyle = c2; ctx.fillRect(0,0,S,1); ctx.fillRect(0,0,1,S);
                ctx.fillStyle = c4;
                ctx.fillRect(4,3,1,3); ctx.fillRect(5,5,2,1); ctx.fillRect(9,8,1,4); ctx.fillRect(10,11,3,1);
                ctx.fillStyle = c3; ctx.fillRect(2,10,1,1); ctx.fillRect(12,5,1,1);
                break;

            case T.RUG:
                ctx.fillStyle = '#d4b896'; ctx.fillRect(0,0,S,S);
                ctx.fillStyle = c1; ctx.fillRect(2,2,12,12);
                ctx.fillStyle = c2; ctx.fillRect(3,3,10,10);
                ctx.fillStyle = c4; ctx.fillRect(5,5,6,6);
                ctx.fillStyle = c1; ctx.fillRect(6,6,4,4);
                ctx.fillStyle = '#ffb300'; ctx.fillRect(7,7,2,2);
                ctx.fillStyle = c1; ctx.fillRect(3,14,2,1); ctx.fillRect(7,14,2,1); ctx.fillRect(11,14,2,1);
                break;

            case T.CAULDRON:
                ctx.fillStyle = c4; ctx.fillRect(4,5,8,10);
                ctx.fillStyle = c1; ctx.fillRect(3,4,10,9);
                ctx.fillStyle = c2; ctx.fillRect(4,3,8,2);
                ctx.fillStyle = '#388e3c'; ctx.fillRect(5,6,6,5);
                ctx.fillStyle = '#66bb6a'; ctx.fillRect(6,7,4,3);
                ctx.fillStyle = '#81c784'; ctx.fillRect(6,6,1,1); ctx.fillRect(9,8,1,1);
                ctx.fillStyle='#fff'; ctx.globalAlpha=0.2;
                ctx.fillRect(6,1,1,2); ctx.fillRect(9,0,1,3);
                ctx.globalAlpha=1;
                ctx.fillStyle = '#333'; ctx.fillRect(4,13,2,2); ctx.fillRect(10,13,2,2);
                break;
        }
    }

    // Generate the town layout based on world locations
    generateLayout(locations) {
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

        // Add grass variation
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const r = ((x * 7 + y * 13 + x*y) % 17);
                if (r < 5) this.grid[y][x] = T.GRASS2;
                else if (r < 8) this.grid[y][x] = T.GRASS3;
            }
        }

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
        if (this._agentHouseMap[agentId]) return this._agentHouseMap[agentId];
        // Count how many agents are in each house
        const houseCounts = {};
        subIds.forEach(id => houseCounts[id] = 0);
        Object.values(this._agentHouseMap).forEach(hid => { if (houseCounts[hid] !== undefined) houseCounts[hid]++; });
        // Assign to least-populated house
        const bestHouse = subIds.reduce((a, b) => (houseCounts[a] <= houseCounts[b] ? a : b));
        this._agentHouseMap[agentId] = bestHouse;
        return bestHouse;
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
    _drawCompletedBuildings(ctx, completedBuildings) {
        // Map building keys to nearby locations and pixel art draw functions
        const BUILDING_PLACEMENTS = {
            watchtower:      { near: 'guardpost',        offsetX: -2, offsetY: -2 },
            granary:         { near: 'farm',             offsetX: 8,  offsetY: -1 },
            marketplace:     { near: 'town_square',      offsetX: 9,  offsetY: -1 },
            well_upgrade:    { near: 'well',             offsetX: 0,  offsetY: -1 },
            training_ground: { near: 'guardpost',        offsetX: 7,  offsetY: 0 },
            brewery:         { near: 'tavern',           offsetX: -3, offsetY: -1 },
            garden:          { near: 'clinic',           offsetX: -3, offsetY: -1 },
            school:          { near: 'library',          offsetX: -3, offsetY: 0 },
            farm_irrigation: { near: 'farm',             offsetX: -2, offsetY: 5 },
            forge_bellows:   { near: 'workshop',         offsetX: -3, offsetY: -1 },
            clinic_upgrade:  { near: 'clinic',           offsetX: 6,  offsetY: -1 },
            town_walls:      { near: 'town_square',      offsetX: -5, offsetY: -3 },
        };

        for (const building of completedBuildings) {
            const key = building.buildingKey || building.key;
            let bx, by;
            if (Number.isFinite(building.siteX)) {
                // v4.9.0 玩家選址的建築:畫在玩家挑的位置
                bx = building.siteX * TILE;
                by = building.siteY * TILE;
            } else {
                const placement = BUILDING_PLACEMENTS[key];
                if (!placement) continue;
                const zone = this.buildingZones[placement.near] || this.natureZones[placement.near];
                if (!zone) continue;
                bx = (zone.x + placement.offsetX) * TILE;
                by = (zone.y + placement.offsetY) * TILE;
            }

            if (Number.isFinite(building.siteX)) {
                // 佔 2x2 地塊:先鋪石板底座,再放大 2 倍畫建築
                ctx.fillStyle = '#b9b3a8'; ctx.fillRect(bx, by, TILE * 2, TILE * 2);
                ctx.fillStyle = '#a49e93';
                ctx.fillRect(bx, by, TILE * 2, 1); ctx.fillRect(bx, by, 1, TILE * 2);
                ctx.save();
                ctx.translate(bx, by);
                ctx.scale(2, 2);
                this._drawBuildingIcon(ctx, key, 0, 0);
                ctx.restore();
            } else {
                this._drawBuildingIcon(ctx, key, bx, by);
            }

            // Small label
            const cx = Number.isFinite(building.siteX) ? bx + TILE : bx + 8;
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            const label = building.name;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(cx - tw/2 - 2, by - 4, tw + 4, 9);
            ctx.fillStyle = '#ffd700';
            ctx.fillText(label, cx, by + 3);
        }
    }

    // v4.9.0 施工中工地:土地+鷹架+進度條
    _drawConstructionSites(ctx) {
        for (const p of (this.constructionSites || [])) {
            const x = p.siteX * TILE, y = p.siteY * TILE;
            // 2x2 土地基底
            ctx.fillStyle = '#9b7b52'; ctx.fillRect(x, y, TILE * 2, TILE * 2);
            ctx.fillStyle = '#8a6a42';
            for (let i = 0; i < 6; i++) ctx.fillRect(x + 3 + (i * 9) % 26, y + 4 + (i * 13) % 24, 3, 2);
            // 鷹架(木架)
            ctx.fillStyle = '#8B5A2B';
            ctx.fillRect(x + 2, y + 2, 2, 26); ctx.fillRect(x + 28, y + 2, 2, 26);
            ctx.fillRect(x + 2, y + 2, 28, 2); ctx.fillRect(x + 2, y + 14, 28, 2);
            // 木材堆
            ctx.fillStyle = '#A0522D'; ctx.fillRect(x + 8, y + 22, 12, 3);
            ctx.fillStyle = '#8B4513'; ctx.fillRect(x + 8, y + 25, 12, 3);
            // 進度條
            const prog = Math.min(1, (p.workDone || 0) / (p.workRequired || 1));
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y - 6, TILE * 2, 4);
            ctx.fillStyle = '#4caf50'; ctx.fillRect(x + 1, y - 5, (TILE * 2 - 2) * prog, 2);
            // 標籤
            ctx.font = '7px monospace'; ctx.textAlign = 'center';
            const label = `🚧${p.name}`;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x + TILE - tw / 2 - 2, y - 16, tw + 4, 9);
            ctx.fillStyle = '#ffcc66'; ctx.fillText(label, x + TILE, y - 9);
        }
    }

    _drawBuildingIcon(ctx, key, x, y) {
        const T = TILE;
        switch (key) {
            case 'watchtower': // Tall tower
                ctx.fillStyle = '#8B7355'; ctx.fillRect(x+4, y+4, 8, 16);  // Tower body
                ctx.fillStyle = '#A0522D'; ctx.fillRect(x+2, y+4, 12, 3);  // Top platform
                ctx.fillStyle = '#654321'; ctx.fillRect(x+6, y+1, 4, 3);   // Lookout
                ctx.fillStyle = '#FFD700'; ctx.fillRect(x+7, y+2, 2, 1);   // Window
                ctx.fillStyle = '#555'; ctx.fillRect(x+6, y+17, 4, 3);     // Door
                break;
            case 'granary': // Barn/silo
                ctx.fillStyle = '#B8860B'; ctx.fillRect(x+2, y+6, 12, 10); // Body
                ctx.fillStyle = '#DAA520'; ctx.fillRect(x+1, y+4, 14, 3);  // Roof
                ctx.fillStyle = '#8B6914'; ctx.fillRect(x+4, y+5, 2, 2);   // Peak
                ctx.fillStyle = '#654321'; ctx.fillRect(x+6, y+12, 4, 4);  // Door
                ctx.fillStyle = '#FFD700'; ctx.fillRect(x+3, y+8, 2, 2);   // Grain window
                ctx.fillStyle = '#FFD700'; ctx.fillRect(x+11, y+8, 2, 2);
                break;
            case 'marketplace': // Market stall
                ctx.fillStyle = '#CD853F'; ctx.fillRect(x+1, y+8, 14, 8);  // Counter
                ctx.fillStyle = '#FF6347'; ctx.fillRect(x+0, y+4, 16, 4);  // Canopy
                ctx.fillStyle = '#FFD700'; ctx.fillRect(x+4, y+5, 2, 2);   // Stripe
                ctx.fillStyle = '#FFD700'; ctx.fillRect(x+10, y+5, 2, 2);
                ctx.fillStyle = '#8FBC8F'; ctx.fillRect(x+2, y+9, 3, 2);   // Goods
                ctx.fillStyle = '#DEB887'; ctx.fillRect(x+6, y+9, 3, 2);
                ctx.fillStyle = '#F4A460'; ctx.fillRect(x+10, y+9, 3, 2);
                break;
            case 'well_upgrade': // Improved well
                ctx.fillStyle = '#708090'; ctx.fillRect(x+3, y+8, 10, 6);  // Well stone
                ctx.fillStyle = '#A9A9A9'; ctx.fillRect(x+2, y+6, 12, 3);  // Rim
                ctx.fillStyle = '#4682B4'; ctx.fillRect(x+5, y+9, 6, 3);   // Water
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+3, y+3, 2, 5);   // Post
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+11, y+3, 2, 5);
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+3, y+3, 10, 2);  // Crossbar
                break;
            case 'training_ground': // Training area
                ctx.fillStyle = '#DEB887'; ctx.fillRect(x+1, y+8, 14, 8);  // Sand ground
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+2, y+6, 2, 8);   // Post
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+12, y+6, 2, 8);  // Post
                ctx.fillStyle = '#CD853F'; ctx.fillRect(x+2, y+6, 12, 2);  // Crossbar
                ctx.fillStyle = '#C0C0C0'; ctx.fillRect(x+6, y+10, 1, 4);  // Sword
                ctx.fillStyle = '#C0C0C0'; ctx.fillRect(x+9, y+10, 1, 4);  // Sword
                break;
            case 'brewery': // Barrel house
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+2, y+6, 12, 10); // Building
                ctx.fillStyle = '#A0522D'; ctx.fillRect(x+1, y+4, 14, 3);  // Roof
                ctx.fillStyle = '#D2691E'; ctx.fillRect(x+3, y+8, 4, 3);   // Barrel 1
                ctx.fillStyle = '#D2691E'; ctx.fillRect(x+9, y+8, 4, 3);   // Barrel 2
                ctx.fillStyle = '#DAA520'; ctx.fillRect(x+4, y+9, 2, 1);   // Tap
                ctx.fillStyle = '#DAA520'; ctx.fillRect(x+10, y+9, 2, 1);
                break;
            case 'garden': // Herb garden
                ctx.fillStyle = '#654321'; ctx.fillRect(x+1, y+6, 14, 10); // Soil
                ctx.fillStyle = '#228B22'; ctx.fillRect(x+2, y+7, 3, 3);   // Herb 1
                ctx.fillStyle = '#32CD32'; ctx.fillRect(x+6, y+7, 3, 3);   // Herb 2
                ctx.fillStyle = '#006400'; ctx.fillRect(x+10, y+7, 3, 3);  // Herb 3
                ctx.fillStyle = '#90EE90'; ctx.fillRect(x+2, y+11, 3, 3);  // Herb 4
                ctx.fillStyle = '#7CFC00'; ctx.fillRect(x+6, y+11, 3, 3);  // Herb 5
                ctx.fillStyle = '#228B22'; ctx.fillRect(x+10, y+11, 3, 3); // Herb 6
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+0, y+5, 16, 2);  // Fence top
                break;
            case 'school': // School building
                ctx.fillStyle = '#B22222'; ctx.fillRect(x+2, y+6, 12, 10); // Body
                ctx.fillStyle = '#8B0000'; ctx.fillRect(x+1, y+4, 14, 3);  // Roof
                ctx.fillStyle = '#FFD700'; ctx.fillRect(x+6, y+12, 4, 4);  // Door
                ctx.fillStyle = '#87CEEB'; ctx.fillRect(x+3, y+8, 3, 3);   // Window
                ctx.fillStyle = '#87CEEB'; ctx.fillRect(x+10, y+8, 3, 3);  // Window
                ctx.fillStyle = '#FFD700'; ctx.fillRect(x+7, y+3, 2, 2);   // Bell
                break;
            case 'farm_irrigation': // Water channels
                ctx.fillStyle = '#4682B4'; ctx.fillRect(x+1, y+10, 14, 2); // Main channel
                ctx.fillStyle = '#4682B4'; ctx.fillRect(x+3, y+8, 2, 6);   // Branch 1
                ctx.fillStyle = '#4682B4'; ctx.fillRect(x+7, y+8, 2, 6);   // Branch 2
                ctx.fillStyle = '#4682B4'; ctx.fillRect(x+11, y+8, 2, 6);  // Branch 3
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+0, y+9, 2, 4);   // Gate
                break;
            case 'forge_bellows': // Bellows machine
                ctx.fillStyle = '#696969'; ctx.fillRect(x+3, y+8, 10, 8);  // Body
                ctx.fillStyle = '#A9A9A9'; ctx.fillRect(x+2, y+6, 12, 3);  // Top
                ctx.fillStyle = '#FF4500'; ctx.fillRect(x+5, y+10, 6, 4);  // Fire
                ctx.fillStyle = '#FFD700'; ctx.fillRect(x+6, y+11, 4, 2);  // Glow
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+1, y+10, 3, 4);  // Bellows
                break;
            case 'clinic_upgrade': // Medical wing
                ctx.fillStyle = '#F5F5F5'; ctx.fillRect(x+2, y+6, 12, 10); // White building
                ctx.fillStyle = '#DCDCDC'; ctx.fillRect(x+1, y+4, 14, 3);  // Roof
                ctx.fillStyle = '#FF0000'; ctx.fillRect(x+6, y+7, 4, 1);   // Red cross H
                ctx.fillStyle = '#FF0000'; ctx.fillRect(x+7, y+6, 2, 3);   // Red cross V
                ctx.fillStyle = '#87CEEB'; ctx.fillRect(x+3, y+9, 3, 3);   // Window
                ctx.fillStyle = '#87CEEB'; ctx.fillRect(x+10, y+9, 3, 3);  // Window
                ctx.fillStyle = '#654321'; ctx.fillRect(x+6, y+12, 4, 4);  // Door
                break;
            case 'town_walls': // Wall segments
                ctx.fillStyle = '#808080'; ctx.fillRect(x+0, y+6, 3, 14);  // Left wall
                ctx.fillStyle = '#808080'; ctx.fillRect(x+13, y+6, 3, 14); // Right wall
                ctx.fillStyle = '#808080'; ctx.fillRect(x+0, y+6, 16, 3);  // Top wall
                ctx.fillStyle = '#A9A9A9'; ctx.fillRect(x+1, y+6, 2, 2);   // Battlement
                ctx.fillStyle = '#A9A9A9'; ctx.fillRect(x+5, y+6, 2, 2);
                ctx.fillStyle = '#A9A9A9'; ctx.fillRect(x+9, y+6, 2, 2);
                ctx.fillStyle = '#A9A9A9'; ctx.fillRect(x+13, y+6, 2, 2);
                ctx.fillStyle = '#696969'; ctx.fillRect(x+6, y+9, 4, 6);   // Gate
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+7, y+10, 2, 5);  // Gate door
                break;
            default: // Generic small structure
                ctx.fillStyle = '#A0522D'; ctx.fillRect(x+3, y+8, 10, 8);
                ctx.fillStyle = '#8B4513'; ctx.fillRect(x+2, y+6, 12, 3);
                ctx.fillStyle = '#654321'; ctx.fillRect(x+6, y+12, 4, 4);
                break;
        }
    }

    // Draw farm plot overlays near the farm building
    _drawFarmOverlay(ctx, farmData) {
        const farmZone = this.buildingZones['farm'] || this.natureZones['farm'];
        if (!farmZone) return;
        const plots = farmData.plots || [];
        if (plots.length === 0) return;

        // Crop-specific colors for different growth stages
        const CROP_COLORS = {
            wheat:        { sprout:'#7ec850', mid:'#5cad42', mature:'#e8c840', ready:'#daa520' },
            potato:       { sprout:'#6aaa38', mid:'#4c9838', mature:'#8b7355', ready:'#c49a50' },
            rice:         { sprout:'#90d070', mid:'#70b050', mature:'#b8d860', ready:'#d4c840' },
            corn:         { sprout:'#6ec050', mid:'#4c9838', mature:'#c8a830', ready:'#dab030' },
            cotton:       { sprout:'#70b860', mid:'#60a850', mature:'#e0d8d0', ready:'#f0e8e0' },
            flowers:      { sprout:'#70b860', mid:'#e090b0', mature:'#f080a0', ready:'#ff70a0' },
            herbs:        { sprout:'#60b848', mid:'#48a038', mature:'#389830', ready:'#308828' },
            mushroom:     { sprout:'#b8a080', mid:'#a08868', mature:'#c0a878', ready:'#d8c090' },
            sugarcane:    { sprout:'#70b860', mid:'#58a048', mature:'#90c870', ready:'#a0d880' },
            tea:          { sprout:'#60a048', mid:'#488838', mature:'#407830', ready:'#386828' },
            grapes:       { sprout:'#70b860', mid:'#6880b0', mature:'#8060a0', ready:'#704898' },
            golden_wheat: { sprout:'#a0c050', mid:'#c0b040', mature:'#e8d040', ready:'#ffd700' },
            dragon_fruit: { sprout:'#c06880', mid:'#d05070', mature:'#e83860', ready:'#ff2050' },
        };
        const DEFAULT_COLORS = { sprout:'#7ec850', mid:'#5cad42', mature:'#8bc34a', ready:'#ffd700' };

        const startX = (farmZone.x - 3) * TILE;
        const startY = (farmZone.y + farmZone.h + 1) * TILE;
        const plotSize = 14;
        const gap = 2;
        const cols = 4;
        const frame = this.animFrame || 0;

        for (let i = 0; i < plots.length; i++) {
            const plot = plots[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const px = startX + col * (plotSize + gap);
            const py = startY + row * (plotSize + gap);
            const cropColors = CROP_COLORS[plot.crop] || DEFAULT_COLORS;

            // Soil texture with furrow lines
            if (plot.state === 'empty') {
                ctx.fillStyle = '#8B7355';
                ctx.fillRect(px, py, plotSize, plotSize);
                // Subtle soil texture
                ctx.fillStyle = 'rgba(100,80,55,0.4)';
                for (let ly = 2; ly < plotSize; ly += 3) {
                    ctx.fillRect(px + 1, py + ly, plotSize - 2, 1);
                }
            } else if (plot.state === 'tilled') {
                ctx.fillStyle = '#5a3a20';
                ctx.fillRect(px, py, plotSize, plotSize);
                // Tilled furrow lines
                ctx.fillStyle = '#4a2a15';
                for (let ly = 1; ly < plotSize; ly += 3) {
                    ctx.fillRect(px, py + ly, plotSize, 1);
                }
                // Moisture sheen
                ctx.fillStyle = 'rgba(100,140,180,0.15)';
                ctx.fillRect(px, py, plotSize, plotSize);
            } else {
                // Dark soil base for growing/ready
                ctx.fillStyle = '#4a2a15';
                ctx.fillRect(px, py, plotSize, plotSize);
                // Subtle furrows
                ctx.fillStyle = '#3a1a10';
                for (let ly = 2; ly < plotSize; ly += 3) {
                    ctx.fillRect(px, py + ly, plotSize, 1);
                }
            }

            // === Crop growth visualization ===
            if (plot.state === 'growing') {
                const progress = plot.growthProgress || 0;
                const stage = progress < 25 ? 'sprout' : progress < 60 ? 'mid' : 'mature';
                const color = cropColors[stage];

                if (progress < 25) {
                    // Sprout stage: tiny green dots
                    ctx.fillStyle = color;
                    ctx.fillRect(px + 3, py + plotSize - 3, 2, 2);
                    ctx.fillRect(px + 9, py + plotSize - 3, 2, 2);
                    // Soil mound
                    ctx.fillStyle = '#6B4226';
                    ctx.fillRect(px + 2, py + plotSize - 1, 4, 1);
                    ctx.fillRect(px + 8, py + plotSize - 1, 4, 1);
                } else if (progress < 60) {
                    // Mid growth: small plants with leaves
                    const h = Math.round(4 + (progress - 25) / 35 * 4);
                    ctx.fillStyle = '#3a6828'; // stem
                    ctx.fillRect(px + 3, py + plotSize - h, 1, h);
                    ctx.fillRect(px + 10, py + plotSize - h, 1, h);
                    // Leaves
                    ctx.fillStyle = color;
                    ctx.fillRect(px + 1, py + plotSize - h + 1, 3, 2);
                    ctx.fillRect(px + 4, py + plotSize - h + 2, 2, 2);
                    ctx.fillRect(px + 8, py + plotSize - h + 1, 3, 2);
                    ctx.fillRect(px + 11, py + plotSize - h + 2, 2, 2);
                } else {
                    // Near-mature: full plants with detail
                    const h = Math.round(8 + (progress - 60) / 40 * 3);
                    // Stems
                    ctx.fillStyle = '#3a6828';
                    ctx.fillRect(px + 3, py + plotSize - h, 1, h);
                    ctx.fillRect(px + 7, py + plotSize - h, 1, h);
                    ctx.fillRect(px + 10, py + plotSize - h, 1, h);
                    // Foliage
                    ctx.fillStyle = color;
                    ctx.fillRect(px + 1, py + plotSize - h, 5, 3);
                    ctx.fillRect(px + 2, py + plotSize - h + 3, 3, 2);
                    ctx.fillRect(px + 8, py + plotSize - h, 5, 3);
                    ctx.fillRect(px + 9, py + plotSize - h + 3, 3, 2);
                    // Highlight
                    ctx.fillStyle = 'rgba(255,255,200,0.2)';
                    ctx.fillRect(px + 2, py + plotSize - h, 2, 1);
                    ctx.fillRect(px + 9, py + plotSize - h, 2, 1);
                }

                // Water level indicator bar at bottom
                const waterPct = (plot.waterLevel || 0) / 100;
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(px, py + plotSize - 1, plotSize, 1);
                ctx.fillStyle = waterPct > 0.6 ? 'rgba(60,140,220,0.7)' : waterPct > 0.3 ? 'rgba(220,180,60,0.7)' : 'rgba(220,60,60,0.7)';
                ctx.fillRect(px, py + plotSize - 1, Math.round(plotSize * waterPct), 1);

                // Fertilized sparkle
                if (plot.fertilized && frame % 30 < 15) {
                    ctx.fillStyle = 'rgba(180,255,100,0.5)';
                    ctx.fillRect(px + (frame % 7) * 2, py + 1, 1, 1);
                }

            } else if (plot.state === 'ready') {
                // Mature crop: full golden/colored display with sway animation
                const color = cropColors.ready;
                const sway = Math.sin(frame * 0.05 + i * 1.5) * 0.5;

                // Full plant body
                ctx.fillStyle = '#3a6828';
                ctx.fillRect(px + 3, py + 3, 1, plotSize - 4);
                ctx.fillRect(px + 7, py + 3, 1, plotSize - 4);
                ctx.fillRect(px + 10, py + 4, 1, plotSize - 5);

                // Crop heads / fruits
                ctx.fillStyle = color;
                ctx.fillRect(px + 1, py + 1 + Math.round(sway), 5, 4);
                ctx.fillRect(px + 8, py + 2 + Math.round(sway), 5, 3);
                ctx.fillRect(px + 5, py + 3 + Math.round(sway), 3, 3);

                // Highlight shimmer
                ctx.fillStyle = 'rgba(255,255,200,0.35)';
                ctx.fillRect(px + 2, py + 1 + Math.round(sway), 2, 1);
                ctx.fillRect(px + 9, py + 2 + Math.round(sway), 2, 1);

                // Pulsing ready glow
                const glowAlpha = 0.1 + 0.08 * Math.sin(frame * 0.08 + i);
                ctx.fillStyle = `rgba(255,215,0,${glowAlpha})`;
                ctx.fillRect(px - 1, py - 1, plotSize + 2, plotSize + 2);

            } else if (plot.state === 'withered') {
                // Dead/withered: brown stalks, drooping
                ctx.fillStyle = '#7a5c38';
                ctx.fillRect(px + 3, py + 5, 1, 7);
                ctx.fillRect(px + 9, py + 6, 1, 6);
                // Drooping top
                ctx.fillStyle = '#5a4028';
                ctx.fillRect(px + 4, py + 5, 2, 1);
                ctx.fillRect(px + 10, py + 6, 2, 1);
                // Dry leaves on ground
                ctx.fillStyle = '#8B6914';
                ctx.fillRect(px + 1, py + plotSize - 2, 3, 1);
                ctx.fillRect(px + 7, py + plotSize - 2, 2, 1);
            }

            // Plot border
            ctx.strokeStyle = plot.state === 'ready' ? 'rgba(255,215,0,0.6)' :
                              plot.state === 'growing' ? 'rgba(100,180,60,0.3)' :
                              'rgba(139,115,85,0.3)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, plotSize, plotSize);
        }

        // Farm info label
        const totalPlots = plots.length;
        const readyCount = plots.filter(p => p.state === 'ready').length;
        const growingCount = plots.filter(p => p.state === 'growing').length;
        ctx.font = '6px monospace';
        ctx.textAlign = 'center';
        const labelX = startX + (cols * (plotSize + gap)) / 2;
        const labelY = startY - 3;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(labelX - 20, labelY - 5, 40, 8);
        ctx.fillStyle = readyCount > 0 ? '#ffd700' : growingCount > 0 ? '#90ee90' : '#b0b0b0';
        const statusText = readyCount > 0 ? `${t('農場')} ${readyCount}${t('塊可收')}` : growingCount > 0 ? `${t('農場')} ${growingCount}${t('塊生長中')}` : `${t('農場')} ${totalPlots}${t('塊')}`;
        ctx.fillText(statusText, labelX, labelY);
    }

    // Draw factory building icons
    _drawFactoryOverlay(ctx, processingData) {
        const factories = processingData.builtFactories || {};
        const keys = Object.keys(factories);
        if (keys.length === 0) return;

        // Place factories near workshop
        const baseZone = this.buildingZones['workshop'] || this.buildingZones['town_square'];
        if (!baseZone) return;

        let offsetIdx = 0;
        const placements = [
            { dx: -4, dy: -3 }, { dx: -4, dy: 1 }, { dx: 9, dy: -3 }, { dx: 9, dy: 1 },
            { dx: -4, dy: 5 }, { dx: 9, dy: 5 }, { dx: -4, dy: -7 },
        ];

        for (const key of keys) {
            const factory = factories[key];
            const def = typeof FACTORIES !== 'undefined' ? FACTORIES[key] : null;
            if (!def) continue;
            const p = placements[offsetIdx % placements.length];
            const fx = (baseZone.x + p.dx) * TILE;
            const fy = (baseZone.y + p.dy) * TILE;

            // Building body
            if (factory.status === 'building') {
                ctx.fillStyle = 'rgba(160,120,80,0.6)';
                ctx.fillRect(fx, fy, 24, 18);
                ctx.strokeStyle = '#aaa';
                ctx.setLineDash([2, 2]);
                ctx.strokeRect(fx, fy, 24, 18);
                ctx.setLineDash([]);
                // Progress bar
                const pct = factory.buildProgress / factory.buildRequired;
                ctx.fillStyle = '#333';
                ctx.fillRect(fx + 2, fy + 14, 20, 3);
                ctx.fillStyle = '#4caf50';
                ctx.fillRect(fx + 2, fy + 14, Math.round(20 * pct), 3);
            } else {
                // Active factory
                ctx.fillStyle = '#7a6040';
                ctx.fillRect(fx, fy + 4, 24, 14);
                ctx.fillStyle = '#a07050';
                ctx.fillRect(fx - 1, fy + 2, 26, 4); // Roof
                // Chimney
                ctx.fillStyle = '#666';
                ctx.fillRect(fx + 18, fy - 2, 4, 6);
                // Door
                ctx.fillStyle = '#4a3020';
                ctx.fillRect(fx + 9, fy + 12, 6, 6);
                // Window
                ctx.fillStyle = factory.recipe ? '#ffeb3b' : '#555';
                ctx.fillRect(fx + 3, fy + 7, 4, 4);
            }

            // Label
            ctx.font = '6px monospace';
            ctx.textAlign = 'center';
            const lx = fx + 12;
            const ly = fy - 2;
            const label = `${def.icon}${def.name}`;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(lx - tw / 2 - 2, ly - 5, tw + 4, 7);
            ctx.fillStyle = factory.status === 'active' ? '#ffd700' : '#aaa';
            ctx.fillText(label, lx, ly);

            offsetIdx++;
        }
    }

    // Draw industry level badges
    _drawIndustryBadges(ctx, industryData) {
        const INDUSTRY_LOCATIONS = {
            lumber: 'workshop',
            quarry: 'workshop',
            farming: 'farm',
            mining: 'workshop',
        };
        const industries = industryData.industries || {};
        let badgeIdx = 0;
        for (const [key, ind] of Object.entries(industries)) {
            const locKey = INDUSTRY_LOCATIONS[key] || 'town_square';
            const zone = this.buildingZones[locKey] || this.natureZones[locKey];
            if (!zone) continue;
            const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[key] : null;
            if (!def) continue;

            const bx = zone.x * TILE - 2 + badgeIdx * 28;
            const by = (zone.y - 1) * TILE - 4;

            // Badge background
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(bx, by, 26, 10);
            ctx.strokeStyle = ind.level >= 4 ? '#ffd700' : ind.level >= 2 ? '#4fc3f7' : '#888';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(bx, by, 26, 10);

            // Text
            ctx.font = '6px monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#fff';
            ctx.fillText(`${def.icon}Lv${ind.level}`, bx + 2, by + 7);

            badgeIdx++;
        }
    }

    // Update agent positions (smooth interpolation)
    // Add a speech bubble for NPC conversation on the map
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
    _isInsideBuilding(px, py) {
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
        // Wall, roof, window, and fence tiles are not walkable
        return tile !== T.WALL_TOP && tile !== T.WALL_FRONT && tile !== T.WINDOW
            && tile !== T.ROOF && tile !== T.ROOF2
            && tile !== T.FENCE_H && tile !== T.FENCE_V;
    }

    // Find the nearest walkable position to target, avoiding walls
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

        // A* with 8-directional movement
        const key = (x, y) => x + y * this.cols;
        const open = []; // min-heap by f
        const gScore = new Map();
        const parent = new Map();
        const closed = new Set();

        const h = (x, y) => Math.abs(x - ex) + Math.abs(y - ey); // Manhattan
        const startKey = key(sxc, syc);
        gScore.set(startKey, 0);
        open.push({ x: sxc, y: syc, f: h(sxc, syc) });

        const dirs = [
            { dx: 0, dy: -1, cost: 1 }, { dx: 0, dy: 1, cost: 1 },
            { dx: -1, dy: 0, cost: 1 }, { dx: 1, dy: 0, cost: 1 },
            { dx: -1, dy: -1, cost: 1.41 }, { dx: 1, dy: -1, cost: 1.41 },
            { dx: -1, dy: 1, cost: 1.41 }, { dx: 1, dy: 1, cost: 1.41 },
        ];

        let iterations = 0;
        const MAX_ITER = 2000; // prevent lag on large maps

        while (open.length > 0 && iterations < MAX_ITER) {
            iterations++;
            // Find lowest f in open (simple linear scan — adequate for small grids)
            let bestIdx = 0;
            for (let i = 1; i < open.length; i++) {
                if (open[i].f < open[bestIdx].f) bestIdx = i;
            }
            const cur = open[bestIdx];
            open.splice(bestIdx, 1);

            const ck = key(cur.x, cur.y);
            if (closed.has(ck)) continue;
            closed.add(ck);

            // Reached goal
            if (cur.x === ex && cur.y === ey) {
                // Reconstruct path as pixel waypoints
                const path = [];
                let k = ck;
                while (k !== undefined) {
                    const py = Math.floor(k / this.cols);
                    const px = k - py * this.cols;
                    path.unshift({ x: (px + 0.5) * TILE, y: (py + 0.5) * TILE });
                    k = parent.get(k);
                }
                // Simplify: remove collinear waypoints
                return this._simplifyPath(path);
            }

            const curG = gScore.get(ck) || 0;

            for (const d of dirs) {
                const nx = cur.x + d.dx, ny = cur.y + d.dy;
                if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
                const nk = key(nx, ny);
                if (closed.has(nk)) continue;
                if (!this._isTileWalkable(nx, ny)) continue;

                // For diagonal, both adjacent cardinal tiles must be walkable (no corner cutting)
                if (d.dx !== 0 && d.dy !== 0) {
                    if (!this._isTileWalkable(cur.x + d.dx, cur.y) || !this._isTileWalkable(cur.x, cur.y + d.dy)) continue;
                }

                const ng = curG + d.cost;
                if (!gScore.has(nk) || ng < gScore.get(nk)) {
                    gScore.set(nk, ng);
                    parent.set(nk, ck);
                    open.push({ x: nx, y: ny, f: ng + h(nx, ny) });
                }
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
            let targetX, targetY;

            // For residential areas, route agents to their specific house
            const homeLocation = agent.home_location || agent.homeLocation;
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
                // Add offset within zone so agents don't overlap
                const existing = Object.values(this.agentPositions).filter(p => {
                    const dx = Math.abs(p.targetX - locCenter.x);
                    const dy = Math.abs(p.targetY - locCenter.y);
                    return dx < TILE * 3 && dy < TILE * 3;
                });
                const idx = existing.length;
                const spreadX = ((idx % 4) - 1.5) * TILE;
                const spreadY = (Math.floor(idx / 4) - 0.5) * TILE;
                targetX = locCenter.x + spreadX;
                targetY = locCenter.y + spreadY;
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
                const isSleeping = activity === 'sleeping';
                if (isSleeping && !this.agentPositions[aid].walking) {
                    // Already at rest position — don't move or update target
                    this.agentPositions[aid].walkStep = 0;
                    continue;
                }

                const pos = this.agentPositions[aid];
                // Check if NPC is changing to a different location (entering a new building)
                const prevTarget = { x: pos.targetX, y: pos.targetY };
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
                        pos.doorPhase = null;
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
    _variedColors(base, name, jobKey) {
        this._colorCache = this._colorCache || {};
        const key = jobKey + '|' + name;
        if (this._colorCache[key]) return this._colorCache[key];
        let h = 2166136261;
        for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = (h * 16777619) >>> 0; }
        const SKINS = ['#fce4c8', '#f6ddbe', '#eecca4', '#e0bc98', '#cda074', '#b88458'];
        const HAIRS = ['#241812', '#3f2810', '#5a3a1a', '#754824', '#9a6a2a', '#c8a860', '#8c8c92', '#33263f', '#6a2a1a'];
        const skin = SKINS[h % SKINS.length];
        const hair = HAIRS[(h >>> 3) % HAIRS.length];
        const bJit = (((h >>> 6) % 5) - 2) * 0.05;
        const pJit = (((h >>> 10) % 3) - 1) * 0.06;
        const c = { ...base, skin,
            hair, hairDk: this._shadeHex(hair, -0.38), hairLt: this._shadeHex(hair, 0.32),
            body: this._shadeHex(base.body, bJit), bodyDk: this._shadeHex(base.bodyDk, bJit),
            pants: this._shadeHex(base.pants, pJit) };
        this._colorCache[key] = c;
        return c;
    }

    _drawAgent(ctx, x, y, jobKey, isPlayer, isSelected, name, walking, walkStep, gender, jobTitle, dir4) {
        const c = isPlayer ? JOB_COLORS.player : this._variedColors(JOB_COLORS[jobKey] || JOB_COLORS.default, name || '', jobKey);
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
        this._drawChibiHair(ctx, sx, sy, c, jobKey, isPlayer, isFemale);

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
            const nameShort = name.split('(')[0].trim();
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
    _drawFarmAction(ctx, x, y, frame, agentId) {
        const sx = Math.floor(x - 8);
        const sy = Math.floor(y - 20);
        const phase = Math.floor(frame / 20) % 4;
        // Use agent id hash to offset animation phase so they look different
        const offset = (agentId.charCodeAt(0) || 0) % 4;
        const action = (phase + offset) % 4;

        if (action === 0 || action === 1) {
            // Hoeing / tilling animation: arm swings down
            const swingY = action === 0 ? 0 : 3;
            // Tool (hoe) - brown stick with metal tip
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(sx + 14, sy + 12 + swingY, 2, 10);
            ctx.fillStyle = '#888';
            ctx.fillRect(sx + 13, sy + 21 + swingY, 4, 2);
            // Dirt particles when hitting
            if (action === 1) {
                ctx.fillStyle = 'rgba(139,115,85,0.7)';
                const pf = (frame % 10);
                ctx.fillRect(sx + 12 - pf, sy + 23 - pf * 0.5, 2, 2);
                ctx.fillRect(sx + 18 + pf * 0.5, sy + 22 - pf * 0.3, 2, 1);
            }
        } else if (action === 2) {
            // Watering animation: pouring water
            ctx.fillStyle = '#6080a0';
            ctx.fillRect(sx + 14, sy + 12, 4, 5); // watering can body
            ctx.fillRect(sx + 18, sy + 14, 3, 1); // spout
            // Water drops
            const dropFrame = frame % 12;
            ctx.fillStyle = 'rgba(60,140,220,0.7)';
            ctx.fillRect(sx + 19, sy + 16 + dropFrame * 0.5, 1, 2);
            if (dropFrame > 3) ctx.fillRect(sx + 20, sy + 15 + (dropFrame - 3) * 0.5, 1, 2);
        } else {
            // Harvesting animation: picking crops
            const pickY = Math.sin(frame * 0.15) * 2;
            // Basket
            ctx.fillStyle = '#b8944c';
            ctx.fillRect(sx - 4, sy + 16, 8, 6);
            ctx.fillStyle = '#9a7838';
            ctx.fillRect(sx - 4, sy + 16, 8, 1);
            // Crops in basket
            ctx.fillStyle = '#daa520';
            ctx.fillRect(sx - 3, sy + 14, 3, 2);
            ctx.fillRect(sx + 1, sy + 15, 2, 1);
            // Hand reaching down
            ctx.fillStyle = '#fce4c8';
            ctx.fillRect(sx + 14, sy + 14 + pickY, 3, 3);
        }

        // Small action label
        const actionLabels = [t('翻土'), t('翻土'), t('澆水'), t('收穫')];
        ctx.font = '5px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - 10, sy - 2, 20, 6);
        ctx.fillStyle = '#90ee90';
        ctx.fillText(actionLabels[action], x, sy + 3);
    }

    // Main render
    render(agents, selectedAgent, playerLoc, completedBuildings, extraData) {
        // Check if canvas needs resizing (handles window resize, DPR changes)
        this._checkResize();
        const ctx = this.ctx;
        if (!ctx || !this.grid) return;
        this.animFrame++;

        // Clear entire canvas and apply camera transform
        const dpr = this._dpr;
        const scale = this.zoom * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(scale, 0, 0, scale, -this.camX * scale, -this.camY * scale);

        // v4.5.0 美術二輪:lazy 預計算屋頂配色與窗戶清單(地圖生成/讀檔後第一次 render)
        if (!this._artGridReady || this._artGridSrc !== this.grid) this._postProcessArt();
        // v4.6.0 效能:靜態底圖 1 次 drawImage + 動態水面
        if (!this._staticLayer || this._staticSrc !== this.grid) this._buildStaticLayer();
        ctx.drawImage(this._staticLayer, 0, 0);
        this._drawWaterAnim(ctx);
        this._drawDecorations(ctx);

        // Water animation: shimmer effect
        if (this.animFrame % 30 === 0) {
            this.waterFrame = (this.waterFrame + 1) % 3;
        }
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === T.WATER || this.grid[y][x] === T.WATER2) {
                    ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(this.animFrame * 0.05 + x + y)})`;
                    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
                }
            }
        }

        // Draw completed buildings on the map
        if (completedBuildings && completedBuildings.length) {
            this._drawCompletedBuildings(ctx, completedBuildings);
        }

        // v4.9.0 施工中的工地
        if (this.constructionSites?.length) {
            this._drawConstructionSites(ctx);
        }

        // Draw farm plots overlay near farm location
        if (extraData?.farm?.plots?.length > 0) {
            this._drawFarmOverlay(ctx, extraData.farm);
        }
        // Draw factory icons near workshop/tavern
        if (extraData?.processing?.builtFactories) {
            this._drawFactoryOverlay(ctx, extraData.processing);
        }
        // Draw industry level badges on relevant buildings
        if (extraData?.industry?.industries) {
            this._drawIndustryBadges(ctx, extraData.industry);
        }

        // Highlight player's current location zone
        if (playerLoc) {
            const zone = this.buildingZones[playerLoc] || this.natureZones[playerLoc];
            if (zone) {
                ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(zone.x * TILE - 2, zone.y * TILE - 2, zone.w * TILE + 4, zone.h * TILE + 4);
                ctx.setLineDash([]);
            }
        }

        // Draw location labels
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        for (const [locId, lbl] of Object.entries(this.labelPositions)) {
            const isPlayerHere = locId === playerLoc;
            // Background
            const tw = ctx.measureText(lbl.name).width;
            ctx.fillStyle = isPlayerHere ? 'rgba(0,229,255,0.85)' : 'rgba(0,0,0,0.7)';
            const bgX = lbl.x - tw/2 - 4;
            const bgY = lbl.y - 9;
            ctx.fillRect(bgX, bgY, tw + 8, 13);
            // Border
            ctx.strokeStyle = isPlayerHere ? '#00e5ff' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bgX, bgY, tw + 8, 13);
            // Text
            ctx.fillStyle = isPlayerHere ? '#000' : '#fff';
            ctx.fillText(lbl.name, lbl.x, lbl.y);
        }

        // Draw move indicator (pulsing circle at click destination)
        if (this._moveIndicator && Date.now() < this._moveIndicator.expiry) {
            const mi = this._moveIndicator;
            const elapsed = 1 - (mi.expiry - Date.now()) / 1500;
            const radius = 6 + elapsed * 8;
            const alpha = Math.max(0, 0.6 - elapsed * 0.6);
            ctx.beginPath();
            ctx.arc(mi.x, mi.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(mi.x, mi.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 229, 255, ${alpha + 0.2})`;
            ctx.fill();
        }

        // Draw agents
        const sortedAgents = Object.entries(this.agentPositions).sort((a, b) => a[1].y - b[1].y);
        for (const [aid, pos] of sortedAgents) {
            const agent = agents[aid];
            if (!agent) continue;
            const isPlayer = aid === 'player';
            const isSelected = aid === selectedAgent;
            this._drawAgent(ctx, pos.x, pos.y, pos.job, isPlayer, isSelected, agent.name || 'You', pos.walking, pos.walkStep, pos.gender, agent.job?.title || '', pos.dir4 || 'down');
            // Action animation overlay for farming NPCs
            if (!pos.walking && pos.atFarm && (pos.job === 'farmer' || pos.activity === 'working') && !isPlayer) {
                this._drawFarmAction(ctx, pos.x, pos.y, this.animFrame, aid);
            }
            // v4.2.0 愛恨糾葛頭上表情(💘 暗戀 / 💕 交往 / 💍 已婚 / 🖤 出軌 / 💢 敵對)
            const emote = this.agentEmotes[aid];
            if (emote && !isPlayer) {
                const bob = Math.sin(this.animFrame / 12 + pos.x) * 1.5;
                ctx.font = '9px serif';
                ctx.textAlign = 'center';
                ctx.fillText(emote, pos.x, pos.y - 24 + bob);
            }
        }

        // Draw zzz above sleeping NPCs
        for (const [aid, pos] of sortedAgents) {
            const agent = agents[aid];
            if (!agent || aid === 'player') continue;
            if (agent.activity !== 'sleeping') continue;
            // Animated zzz: three z's floating upward at different phases
            const phase = (this.animFrame + aid.charCodeAt(0) * 7) % 90;
            ctx.font = 'bold 7px monospace';
            ctx.textAlign = 'center';
            for (let i = 0; i < 3; i++) {
                const t = ((phase + i * 30) % 90) / 90; // 0-1 cycle
                const zx = pos.x + 6 + i * 3;
                const zy = pos.y - 20 - t * 12;
                const alpha = t < 0.8 ? 0.7 : 0.7 - (t - 0.8) * 3.5; // fade out at end
                if (alpha <= 0) continue;
                ctx.fillStyle = `rgba(150,180,255,${alpha})`;
                ctx.font = `bold ${6 + i * 1.5}px monospace`;
                ctx.fillText('z', zx, zy);
            }
        }

        // Draw NPC conversation speech bubbles (only near player)
        ctx.font = '7px monospace';
        const now = Date.now();
        const activeConvos = this._activeConvoBubbles || [];
        const shownBubbleAgents = new Set();
        const playerPos = this.agentPositions['player'];
        const BUBBLE_RANGE = TILE * 8; // Only show bubbles within 8 tiles of player
        for (const convo of activeConvos) {
            if (now > convo.expiry) continue;
            const fadeAlpha = Math.min(1, (convo.expiry - now) / 2000); // Fade in last 2s
            for (const bubble of convo.bubbles) {
                const pos = this.agentPositions[bubble.agentId];
                if (!pos) continue;
                // Skip bubbles far from player
                if (playerPos) {
                    const pdx = pos.x - playerPos.x, pdy = pos.y - playerPos.y;
                    if (Math.sqrt(pdx*pdx + pdy*pdy) > BUBBLE_RANGE) continue;
                }
                shownBubbleAgents.add(bubble.agentId);
                const text = bubble.text.substring(0, 24);
                const tw = ctx.measureText(text).width;
                const bx = pos.x - tw/2 - 4;
                const by = pos.y - 30;
                // Speech bubble with colored tint
                ctx.fillStyle = `rgba(255,255,220,${0.95 * fadeAlpha})`;
                ctx.beginPath();
                const r = 3;
                ctx.moveTo(bx + r, by);
                ctx.lineTo(bx + tw + 8 - r, by);
                ctx.arcTo(bx + tw + 8, by, bx + tw + 8, by + r, r);
                ctx.lineTo(bx + tw + 8, by + 13 - r);
                ctx.arcTo(bx + tw + 8, by + 13, bx + tw + 8 - r, by + 13, r);
                ctx.lineTo(bx + r, by + 13);
                ctx.arcTo(bx, by + 13, bx, by + 13 - r, r);
                ctx.lineTo(bx, by + r);
                ctx.arcTo(bx, by, bx + r, by, r);
                ctx.fill();
                // Tail
                ctx.beginPath();
                ctx.moveTo(pos.x - 3, by + 13);
                ctx.lineTo(pos.x, by + 18);
                ctx.lineTo(pos.x + 3, by + 13);
                ctx.fill();
                // Border
                ctx.strokeStyle = `rgba(200,180,100,${0.6 * fadeAlpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();
                // Text
                ctx.fillStyle = `rgba(50,50,50,${fadeAlpha})`;
                ctx.textAlign = 'center';
                ctx.fillText(text, pos.x, by + 10);
                // Speaker name above
                ctx.font = 'bold 6px monospace';
                ctx.fillStyle = `rgba(100,80,30,${0.7 * fadeAlpha})`;
                ctx.fillText(bubble.speaker, pos.x, by - 2);
                ctx.font = '7px monospace';
            }
        }
        // Clean expired bubbles
        if (this._activeConvoBubbles) {
            this._activeConvoBubbles = this._activeConvoBubbles.filter(c => now < c.expiry);
        }

        // Draw thought bubbles for agents NOT currently showing speech bubbles
        // Only show dialogue/emotional thoughts near the player (skip status updates)
        const STATUS_PATTERNS = /技能進步|已完成\d|進步了|開啟|建造|產業|工廠/;
        for (const [aid, pos] of sortedAgents) {
            const agent = agents[aid];
            if (!agent || aid === 'player' || !agent.current_thought) continue;
            if (shownBubbleAgents.has(aid)) continue; // Skip if showing speech
            // Skip status-like thoughts (skill progress, building progress, etc.)
            if (STATUS_PATTERNS.test(agent.current_thought)) continue;
            // Only show thought bubbles near the player
            if (playerPos) {
                const pdx = pos.x - playerPos.x, pdy = pos.y - playerPos.y;
                if (Math.sqrt(pdx*pdx + pdy*pdy) > BUBBLE_RANGE) continue;
            }
            // Show thoughts less frequently
            if ((this.animFrame + aid.charCodeAt(0)) % 120 < 80) continue;

            const thought = agent.current_thought.substring(0, 30);
            const tw = ctx.measureText(thought).width;
            const bx = pos.x - tw/2 - 4;
            const by = pos.y - 28;

            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillRect(bx, by, tw + 8, 12);
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, tw + 8, 12);
            // Bubble tail
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillRect(pos.x - 2, by + 12, 4, 3);

            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.fillText(thought, pos.x, by + 9);
        }

        // === Exploration Zone Markers on Map Edges ===
        this._drawExplorationMarkers(ctx);

        // === Graveyard Markers ===
        this._drawGraveyardMarkers(ctx);

        // === Festival Decorations ===
        this._drawFestivalDecorations(ctx);

        // === Ambient Particles ===
        this._updateAndDrawParticles(ctx);

        // === Day/Night Cycle Overlay ===
        this._renderDayNightOverlay(ctx);
        this._renderWindowGlow(ctx);

        // v5.6.0 浮動特效畫在最上層(不被夜晚壓暗)
        this._updateAndDrawFloatFx(ctx);

        // v5.9.0 螢幕暗角(電影感框景,日間極淡)
        this._renderScreenVignette(ctx);
    }

    // v5.9.0 螢幕空間暗角:柔和暗化畫面四角,把視線收攏到中央(cinematic framing)
    _renderScreenVignette(ctx) {
        const w = this.canvas.width, hh = this.canvas.height;
        if (!w || !hh) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const inner = Math.min(w, hh) * 0.42;
        const outer = Math.max(w, hh) * 0.72;
        const g = ctx.createRadialGradient(w / 2, hh / 2, inner, w / 2, hh / 2, outer);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(8,6,18,0.26)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, hh);
        ctx.restore();
    }

    _updateAndDrawParticles(ctx) {
        this._particleTimer++;

        // Spawn chimney smoke from buildings (every 20 frames)
        if (this._particleTimer % 20 === 0) {
            for (const [locId, zone] of Object.entries(this.buildingZones)) {
                if (['tavern','workshop','clinic'].includes(locId) || locId.startsWith('residential')) {
                    const cx = (zone.x + 1) * TILE + 4;
                    const cy = zone.y * TILE - 2;
                    this._particles.push({
                        x: cx + Math.random() * 4 - 2, y: cy,
                        vx: (Math.random() - 0.5) * 0.3, vy: -0.3 - Math.random() * 0.2,
                        life: 40 + Math.random() * 30, maxLife: 70,
                        size: 2 + Math.random(), type: 'smoke'
                    });
                }
            }
        }

        // Fireflies at night (every 15 frames)
        const h = this.timeHour || 12;
        if ((h >= 20 || h < 5) && this._particleTimer % 15 === 0) {
            for (const [locId, zone] of Object.entries(this.natureZones)) {
                if (Math.random() < 0.3) {
                    this._particles.push({
                        x: (zone.x + Math.random() * zone.w) * TILE,
                        y: (zone.y + Math.random() * zone.h) * TILE,
                        vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.3,
                        life: 60 + Math.random() * 40, maxLife: 100,
                        size: 1, type: 'firefly', phase: Math.random() * Math.PI * 2
                    });
                }
            }
        }

        // Falling leaves in daytime (every 40 frames)
        if (h >= 7 && h < 19 && this._particleTimer % 40 === 0) {
            const forestZone = this.natureZones['forest'];
            if (forestZone && Math.random() < 0.5) {
                this._particles.push({
                    x: (forestZone.x + Math.random() * forestZone.w) * TILE,
                    y: forestZone.y * TILE,
                    vx: 0.3 + Math.random() * 0.3, vy: 0.4 + Math.random() * 0.3,
                    life: 80, maxLife: 80,
                    size: 1, type: 'leaf', phase: Math.random() * Math.PI * 2
                });
            }
        }

        // Update and draw particles
        for (let i = this._particles.length - 1; i >= 0; i--) {
            const p = this._particles[i];
            p.x += p.vx; p.y += p.vy; p.life--;
            if (p.life <= 0) { this._particles.splice(i, 1); continue; }

            const alpha = Math.min(1, p.life / (p.maxLife * 0.3));

            if (p.type === 'smoke') {
                p.size += 0.03; // expand
                p.vx += (Math.random() - 0.5) * 0.05; // drift
                ctx.fillStyle = `rgba(180,180,180,${alpha * 0.25})`;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            } else if (p.type === 'firefly') {
                const glow = Math.sin(this.animFrame * 0.1 + p.phase) * 0.5 + 0.5;
                p.vx += (Math.random() - 0.5) * 0.1;
                p.vy += (Math.random() - 0.5) * 0.1;
                p.vx *= 0.95; p.vy *= 0.95;
                ctx.fillStyle = `rgba(200,255,100,${alpha * glow * 0.8})`;
                ctx.fillRect(p.x, p.y, 2, 2);
                ctx.fillStyle = `rgba(200,255,100,${alpha * glow * 0.3})`;
                ctx.fillRect(p.x - 1, p.y - 1, 4, 4); // glow
            } else if (p.type === 'leaf') {
                p.vx += Math.sin(this.animFrame * 0.05 + p.phase) * 0.02; // flutter
                ctx.fillStyle = `rgba(139,119,42,${alpha * 0.6})`;
                ctx.fillRect(p.x, p.y, 2, 1);
            } else if (p.type === 'festival') {
                ctx.fillStyle = p.color || '#FFD700';
                ctx.globalAlpha = alpha;
                ctx.fillRect(p.x, p.y, p.size, p.size);
                ctx.globalAlpha = 1;
            }
        }

        // Keep particle count reasonable
        if (this._particles.length > 200) this._particles = this._particles.slice(-150);
    }

    // ===== v5.6.0 浮動特效(打擊感):彈跳描邊數字/愛心 + emoji 爆裂 =====
    // 掛在關鍵事件:送禮好感+、賺錢、里程碑、心動、combo。map 座標,和角色同一個相機空間。
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

    _updateAndDrawFloatFx(ctx) {
        const fx = this._floatFx;
        if (!fx || !fx.length) return;
        ctx.textAlign = 'center';
        for (let i = fx.length - 1; i >= 0; i--) {
            const f = fx[i];
            f.life++;
            if (f.grav) f.vy += f.grav;
            f.x += f.vx; f.y += f.vy;
            if (f.vy < 0 && !f.grav) f.vy *= 0.97; // 上升減速
            if (f.life >= f.maxLife) { fx.splice(i, 1); continue; }
            const t = f.life / f.maxLife;
            const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
            // 冒出時的彈跳放大(pop)
            const popScale = f.life < 6 ? 0.5 + (f.life / 6) * 0.7 : (f.life < 10 ? 1.2 - (f.life - 6) / 4 * 0.2 : 1);
            const fs = Math.max(1, Math.round(f.size * popScale));
            ctx.font = `bold ${fs}px 'Segoe UI', sans-serif`;
            ctx.globalAlpha = Math.max(0, alpha);
            // 描邊(黑色外框讓字跳出來,像參考圖的傷害數字)
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineJoin = 'round';
            ctx.strokeText(f.text, f.x, f.y);
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;
    }

    _drawExplorationMarkers(ctx) {
        const data = this.explorationData;
        if (!data || !data.discoveredZones) return;
        const zones = Object.keys(data.discoveredZones);
        if (!zones.length) return;

        const TILE = 16;
        const icons = { deep_forest:'🌲', ancient_ruins:'🏛', abandoned_mine:'⛏', mountain_pass:'⛰', riverside_cave:'🕳', cursed_swamp:'🌿' };
        const names = { deep_forest:t('幽深森林'), ancient_ruins:t('古代遺跡'), abandoned_mine:t('廢棄礦坑'), mountain_pass:t('山間隘口'), riverside_cave:t('河畔洞窟'), cursed_swamp:t('詛咒沼澤') };

        // Place markers at map edges
        const edgePositions = [
            { x: 2 * TILE, y: 2 * TILE },
            { x: (this.cols - 4) * TILE, y: 2 * TILE },
            { x: 2 * TILE, y: (this.rows - 3) * TILE },
            { x: (this.cols - 4) * TILE, y: (this.rows - 3) * TILE },
            { x: Math.floor(this.cols / 2) * TILE, y: 1 * TILE },
            { x: Math.floor(this.cols / 2) * TILE, y: (this.rows - 2) * TILE },
        ];

        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        zones.forEach((zoneId, i) => {
            if (i >= edgePositions.length) return;
            const pos = edgePositions[i];
            const name = names[zoneId] || zoneId;
            const active = (data.activeExpeditions || []).some(e => e.zoneId === zoneId);

            // Arrow indicator pointing outward
            ctx.fillStyle = active ? 'rgba(255,200,50,0.85)' : 'rgba(180,220,255,0.75)';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = active ? '#ffa500' : '#88aadd';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Zone icon
            ctx.fillStyle = '#333';
            ctx.fillText(icons[zoneId] || '?', pos.x, pos.y + 3);

            // Label
            const tw = ctx.measureText(name).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(pos.x - tw/2 - 3, pos.y + 6, tw + 6, 11);
            ctx.fillStyle = active ? '#ffd700' : '#aaddff';
            ctx.fillText(name, pos.x, pos.y + 14);
        });
    }

    _drawGraveyardMarkers(ctx) {
        const graves = this.graveyardData;
        if (!graves || !graves.length) return;

        // Draw graveyard near chapel or at edge of residential area
        const chapelZone = this.buildingZones['chapel'] || this.natureZones['chapel'];
        const TILE = 16;
        let baseX, baseY;
        if (chapelZone) {
            baseX = (chapelZone.x + chapelZone.w) * TILE + TILE;
            baseY = chapelZone.y * TILE;
        } else {
            // Fallback position
            baseX = (this.cols - 8) * TILE;
            baseY = (this.rows - 8) * TILE;
        }

        // Draw gravestones (max 10 visible)
        const visibleGraves = graves.slice(-10);
        ctx.font = '6px monospace';
        ctx.textAlign = 'center';
        visibleGraves.forEach((g, i) => {
            const row = Math.floor(i / 5);
            const col = i % 5;
            const gx = baseX + col * 14;
            const gy = baseY + row * 18;

            // Gravestone shape
            ctx.fillStyle = '#667788';
            ctx.fillRect(gx - 4, gy - 8, 8, 10);
            ctx.beginPath();
            ctx.arc(gx, gy - 8, 4, Math.PI, 0);
            ctx.fill();

            // Cross
            ctx.fillStyle = '#aabbcc';
            ctx.fillRect(gx - 0.5, gy - 7, 1, 5);
            ctx.fillRect(gx - 2, gy - 5, 4, 1);

            // Name tooltip on hover (just draw small text)
            ctx.fillStyle = '#aaa';
            ctx.fillText(g.name.slice(-1), gx, gy + 6);
        });

        // Graveyard label
        if (visibleGraves.length > 0) {
            const labelX = baseX + 25;
            const labelY = baseY - 14;
            ctx.font = 'bold 7px monospace';
            const text = t('墓園');
            const tw = ctx.measureText(text).width;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(labelX - tw/2 - 3, labelY - 7, tw + 6, 11);
            ctx.fillStyle = '#999';
            ctx.fillText(text, labelX, labelY);
        }
    }

    _drawFestivalDecorations(ctx) {
        const data = this.festivalData;
        if (!data || !data.activeFestival) return;

        const TILE = 16;
        const festival = data.activeFestival;
        const pulse = Math.sin(this.animFrame * 0.08) * 0.3 + 0.7;

        // Draw festival banner at town square (above the location label)
        const squareZone = this.buildingZones['town_square'] || this.natureZones['town_square'];
        if (squareZone) {
            const cx = (squareZone.x + squareZone.w / 2) * TILE;
            const cy = squareZone.y * TILE - 24;

            // Banner
            ctx.fillStyle = `rgba(255,200,50,${0.6 * pulse})`;
            const bannerText = `${festival.icon} ${festival.name}`;
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            const bw = ctx.measureText(bannerText).width + 12;
            ctx.fillRect(cx - bw/2, cy - 4, bw, 12);
            ctx.strokeStyle = `rgba(255,150,0,${0.8 * pulse})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - bw/2, cy - 4, bw, 12);

            ctx.fillStyle = '#8B4513';
            ctx.fillText(bannerText, cx, cy + 5);
        }

        // Sparkle particles during festival
        if (this.animFrame % 8 === 0) {
            const colors = ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#98FB98'];
            for (let i = 0; i < 3; i++) {
                this._particles.push({
                    x: Math.random() * this.cols * TILE,
                    y: Math.random() * this.rows * TILE,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: -Math.random() * 0.3 - 0.1,
                    life: 60 + Math.random() * 60,
                    maxLife: 120,
                    size: 2 + Math.random() * 2,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    type: 'festival',
                });
            }
        }
    }

    _renderDayNightOverlay(ctx) {
        const h = this.timeHour + this.timeMinute / 60;
        // Calculate night intensity (0 = day, 1 = deep night)
        let nightAmount = 0;

        if (h >= 22 || h < 4) {
            nightAmount = 1;
        } else if (h >= 4 && h < 6) {
            nightAmount = 1 - (h - 4) / 2; // dawn fade out
        } else if (h >= 6 && h < 7) {
            nightAmount = 0; // morning
        } else if (h >= 7 && h < 17) {
            nightAmount = 0; // daytime
        } else if (h >= 17 && h < 19) {
            nightAmount = 0; // sunset glow only, no overlay
        } else if (h >= 19 && h < 22) {
            nightAmount = (h - 19) / 3; // dusk fade in
        }

        // Use map dimensions for overlay (camera transform handles positioning)
        const ow = this.mapWidth;
        const oh = this.mapHeight;

        // v5.9.0 時段色調 grading(讓不同時間有電影感的光線)
        // 清晨 5–7.5:冷藍薄光 + 一抹晨曦暖光
        if (h >= 5 && h < 7.5) {
            const t = Math.max(0, h < 6.2 ? (h - 5) / 1.2 : 1 - (h - 6.2) / 1.3);
            ctx.save();
            ctx.globalCompositeOperation = 'soft-light';
            ctx.fillStyle = `rgba(110,145,215,${(t * 0.30).toFixed(3)})`; ctx.fillRect(0, 0, ow, oh);
            ctx.restore();
            ctx.fillStyle = `rgba(255,205,130,${(t * 0.09).toFixed(3)})`; ctx.fillRect(0, 0, ow, oh);
        }
        // 黃金時刻 16–19.5:暖橘金光斜照(最有味道的時段)
        if (h >= 16 && h < 19.5) {
            const t = Math.max(0, h < 18 ? (h - 16) / 2 : 1 - (h - 18) / 1.5);
            ctx.save();
            ctx.globalCompositeOperation = 'soft-light';
            ctx.fillStyle = `rgba(255,150,50,${(t * 0.45).toFixed(3)})`; ctx.fillRect(0, 0, ow, oh);
            ctx.restore();
            ctx.fillStyle = `rgba(255,125,45,${(t * 0.08).toFixed(3)})`; ctx.fillRect(0, 0, ow, oh);
        }

        if (nightAmount <= 0) return;

        // v4.5.1 夜晚改用 multiply 混色:變暗但保留色彩對比,不再有半透明疊色的「起霧感」
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        const r = Math.round(255 - (255 - 118) * nightAmount);
        const g2 = Math.round(255 - (255 - 132) * nightAmount);
        const b = Math.round(255 - (255 - 200) * nightAmount);
        ctx.fillStyle = `rgb(${r},${g2},${b})`;
        ctx.fillRect(0, 0, ow, oh);
        ctx.restore();

        // Moon at night (only when nightAmount > 0.4)
        if (nightAmount > 0.4) {
            this._renderMoon(ctx, h, nightAmount);
        }

        // Stars at night
        if (nightAmount > 0.2) {
            this._renderStars(ctx, nightAmount);
        }

        // Campfires & torches — the main night indicators
        this._renderCampfires(ctx, nightAmount);

        // Window lights at night
        if (nightAmount > 0.15) {
            this._renderWindowLights(ctx, h);
        }

        // Vignette effect at night — darker edges
        if (nightAmount > 0.3) {
            this._renderNightVignette(ctx, ow, oh, nightAmount);
        }
    }

    // Animated campfires at key locations + torches near buildings
    _renderCampfires(ctx, nightAmount) {
        const alpha = nightAmount;
        const frame = this.animFrame;

        // Campfire locations: town_square, tavern, guardpost, well
        const campfireLocIds = ['town_square', 'tavern', 'guardpost', 'well'];
        const torchLocIds = Object.keys(this.buildingZones).filter(id => !campfireLocIds.includes(id));

        // Draw campfires
        for (const locId of campfireLocIds) {
            const zone = this.buildingZones[locId] || this.natureZones[locId];
            if (!zone) continue;
            const cx = (zone.x + zone.w / 2) * TILE;
            const cy = (zone.y + zone.h - 1) * TILE;
            this._drawCampfire(ctx, cx, cy, alpha, frame, locId);
        }

        // Draw small torches near other buildings
        for (const locId of torchLocIds) {
            const zone = this.buildingZones[locId];
            if (!zone) continue;
            // Some buildings dark late at night
            const h = this.timeHour;
            if ((h >= 1 && h < 5) && !['tavern','guardpost','clinic'].includes(locId)) continue;
            const tx = zone.x * TILE + 2;
            const ty = (zone.y + zone.h / 2) * TILE;
            this._drawTorch(ctx, tx, ty, alpha, frame, locId);
        }
    }

    _drawCampfire(ctx, cx, cy, alpha, frame, seed) {
        // Warm ground glow — larger radius for contrast against dark night
        const glowRadius = 55 + Math.sin(frame * 0.08) * 6;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        grad.addColorStop(0, `rgba(255, 160, 50, ${(alpha * 0.35).toFixed(3)})`);
        grad.addColorStop(0.4, `rgba(255, 100, 20, ${(alpha * 0.15).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - glowRadius, cy - glowRadius, glowRadius * 2, glowRadius * 2);

        // Fire base (logs)
        ctx.fillStyle = `rgba(80, 40, 10, ${alpha.toFixed(2)})`;
        ctx.fillRect(cx - 4, cy + 1, 8, 2);
        ctx.fillRect(cx - 3, cy, 2, 3);
        ctx.fillRect(cx + 1, cy, 2, 3);

        // Animated flames — 3 flame tongues with different phases
        const seedHash = seed.length * 7;
        for (let i = 0; i < 3; i++) {
            const phase = frame * 0.15 + i * 2.1 + seedHash;
            const flicker = Math.sin(phase) * 0.4 + 0.6;
            const sway = Math.sin(phase * 0.7) * 2;
            const h = 4 + flicker * 4;
            const fx = cx - 2 + i * 2 + sway;
            const fy = cy - h;

            // Outer flame (orange-red)
            ctx.fillStyle = `rgba(255, ${Math.floor(80 + flicker * 60)}, 0, ${(alpha * 0.9).toFixed(2)})`;
            ctx.fillRect(fx - 1, fy + 1, 3, Math.floor(h - 1));

            // Inner flame (yellow-white)
            ctx.fillStyle = `rgba(255, 240, ${Math.floor(100 + flicker * 100)}, ${(alpha * 0.95).toFixed(2)})`;
            ctx.fillRect(fx, fy + Math.floor(h * 0.3), 1, Math.floor(h * 0.5));
        }

        // Occasional sparks
        if ((frame + seedHash) % 20 < 2) {
            const sx = cx + (Math.sin(frame * 0.3 + seedHash) * 6);
            const sy = cy - 8 - (frame % 10);
            ctx.fillStyle = `rgba(255, 200, 50, ${(alpha * 0.7).toFixed(2)})`;
            ctx.fillRect(sx, sy, 1, 1);
        }
    }

    _drawTorch(ctx, tx, ty, alpha, frame, seed) {
        const seedHash = seed.length * 13;
        const phase = frame * 0.12 + seedHash;
        const flicker = Math.sin(phase) * 0.3 + 0.7;

        // Torch stick
        ctx.fillStyle = `rgba(100, 60, 20, ${alpha.toFixed(2)})`;
        ctx.fillRect(tx, ty - 2, 1, 5);

        // Small flame
        const fh = 2 + flicker * 2;
        ctx.fillStyle = `rgba(255, ${Math.floor(120 + flicker * 60)}, 20, ${(alpha * 0.9).toFixed(2)})`;
        ctx.fillRect(tx - 1, ty - 2 - fh, 3, Math.floor(fh));
        ctx.fillStyle = `rgba(255, 240, 100, ${(alpha * 0.8).toFixed(2)})`;
        ctx.fillRect(tx, ty - 2 - fh + 1, 1, Math.max(1, Math.floor(fh * 0.5)));

        // Warm glow — bigger and brighter
        const gr = 26 + flicker * 5;
        const grad = ctx.createRadialGradient(tx, ty - 3, 0, tx, ty - 3, gr);
        grad.addColorStop(0, `rgba(255, 150, 50, ${(alpha * 0.2).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(255, 120, 30, ${(alpha * 0.06).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255, 120, 30, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(tx - gr, ty - 3 - gr, gr * 2, gr * 2);
    }

    _renderStars(ctx, alpha) {
        const seed = 42;
        const count = 80; // More stars for denser sky
        for (let i = 0; i < count; i++) {
            const sx = ((seed * (i + 1) * 73 + i * 17) % this.mapWidth);
            const sy = ((seed * (i + 1) * 37 + i * 91) % (this.mapHeight * 0.55));
            const twinkle = 0.4 + 0.6 * Math.sin(this.animFrame * 0.025 + i * 2.1);
            const isBright = (i % 7 === 0);
            const size = isBright ? 2 : 1;
            const brightness = isBright ? 1.0 : 0.85;
            ctx.fillStyle = `rgba(255, 255, 240, ${(alpha * twinkle * brightness).toFixed(2)})`;
            ctx.fillRect(Math.floor(sx), Math.floor(sy), size, size);
            // Bright stars get a subtle glow halo
            if (isBright && alpha > 0.5) {
                ctx.fillStyle = `rgba(200, 220, 255, ${(alpha * twinkle * 0.15).toFixed(2)})`;
                ctx.fillRect(Math.floor(sx) - 1, Math.floor(sy) - 1, 4, 4);
            }
        }
    }

    _renderMoon(ctx, hour, nightAmount) {
        // Moon position moves across the sky from east to west
        const moonProgress = (hour >= 19) ? (hour - 19) / 12 : (hour + 5) / 12;
        const mx = this.mapWidth * 0.15 + moonProgress * this.mapWidth * 0.7;
        const arc = Math.sin(moonProgress * Math.PI);
        const my = this.mapHeight * 0.05 + (1 - arc) * this.mapHeight * 0.08;
        const moonAlpha = nightAmount * 0.95;

        // Outer atmospheric glow (very large, subtle)
        const outerR = 120;
        const outerGrad = ctx.createRadialGradient(mx, my, 0, mx, my, outerR);
        outerGrad.addColorStop(0, `rgba(180, 200, 240, ${(moonAlpha * 0.12).toFixed(3)})`);
        outerGrad.addColorStop(0.3, `rgba(140, 170, 220, ${(moonAlpha * 0.06).toFixed(3)})`);
        outerGrad.addColorStop(0.6, `rgba(100, 130, 200, ${(moonAlpha * 0.02).toFixed(3)})`);
        outerGrad.addColorStop(1, 'rgba(100, 130, 200, 0)');
        ctx.fillStyle = outerGrad;
        ctx.fillRect(mx - outerR, my - outerR, outerR * 2, outerR * 2);

        // Inner glow halo
        const glowR = 55;
        const grad = ctx.createRadialGradient(mx, my, 0, mx, my, glowR);
        grad.addColorStop(0, `rgba(220, 235, 255, ${(moonAlpha * 0.35).toFixed(3)})`);
        grad.addColorStop(0.3, `rgba(200, 220, 255, ${(moonAlpha * 0.18).toFixed(3)})`);
        grad.addColorStop(0.6, `rgba(150, 180, 230, ${(moonAlpha * 0.06).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(150, 180, 230, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(mx - glowR, my - glowR, glowR * 2, glowR * 2);

        // Moon body (larger, brighter)
        ctx.fillStyle = `rgba(245, 248, 255, ${(moonAlpha * 0.98).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(mx, my, 14, 0, Math.PI * 2);
        ctx.fill();

        // Subtle surface texture (darker patches)
        ctx.fillStyle = `rgba(200, 210, 230, ${(moonAlpha * 0.2).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(mx - 3, my - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mx + 4, my + 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mx - 1, my + 5, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Shadow for crescent shape
        ctx.fillStyle = `rgba(8, 12, 40, ${(moonAlpha * 0.9).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(mx + 7, my - 2, 12, 0, Math.PI * 2);
        ctx.fill();

        // Bright edge highlight on the lit side
        ctx.strokeStyle = `rgba(255, 255, 255, ${(moonAlpha * 0.4).toFixed(2)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mx, my, 14, Math.PI * 0.7, Math.PI * 1.8);
        ctx.stroke();
    }

    _renderNightVignette(ctx, w, h, nightAmount) {
        const vigAlpha = nightAmount * 0.25;
        // Top edge
        const gradT = ctx.createLinearGradient(0, 0, 0, h * 0.2);
        gradT.addColorStop(0, `rgba(0, 0, 15, ${vigAlpha.toFixed(3)})`);
        gradT.addColorStop(1, 'rgba(0, 0, 15, 0)');
        ctx.fillStyle = gradT;
        ctx.fillRect(0, 0, w, h * 0.2);
        // Bottom edge
        const gradB = ctx.createLinearGradient(0, h * 0.85, 0, h);
        gradB.addColorStop(0, 'rgba(0, 0, 15, 0)');
        gradB.addColorStop(1, `rgba(0, 0, 15, ${vigAlpha.toFixed(3)})`);
        ctx.fillStyle = gradB;
        ctx.fillRect(0, h * 0.85, w, h * 0.15);
        // Left edge
        const gradL = ctx.createLinearGradient(0, 0, w * 0.12, 0);
        gradL.addColorStop(0, `rgba(0, 0, 15, ${(vigAlpha * 0.6).toFixed(3)})`);
        gradL.addColorStop(1, 'rgba(0, 0, 15, 0)');
        ctx.fillStyle = gradL;
        ctx.fillRect(0, 0, w * 0.12, h);
        // Right edge
        const gradR = ctx.createLinearGradient(w * 0.88, 0, w, 0);
        gradR.addColorStop(0, 'rgba(0, 0, 15, 0)');
        gradR.addColorStop(1, `rgba(0, 0, 15, ${(vigAlpha * 0.6).toFixed(3)})`);
        ctx.fillStyle = gradR;
        ctx.fillRect(w * 0.88, 0, w * 0.12, h);
    }

    _renderWindowLights(ctx, hour) {
        const lightAlpha = (hour >= 22 || hour < 4) ? 0.8 : (hour >= 20 ? (hour - 20) * 0.4 : hour >= 19 ? (hour - 19) * 0.8 : (6 - hour) * 0.4);
        // Draw warm glow on building zones
        for (const [locId, zone] of Object.entries(this.buildingZones)) {
            // Some buildings have lights off late at night
            if ((hour >= 1 && hour < 5) && !['tavern','guardpost','clinic'].includes(locId)) continue;
            const cx = (zone.x + zone.w / 2) * TILE;
            const cy = (zone.y + zone.h / 2) * TILE;
            const radius = Math.max(zone.w, zone.h) * TILE * 0.7;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0, `rgba(255, 200, 80, ${(lightAlpha * 0.4).toFixed(2)})`);
            grad.addColorStop(0.6, `rgba(255, 180, 60, ${(lightAlpha * 0.12).toFixed(2)})`);
            grad.addColorStop(1, 'rgba(255, 180, 60, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        }
    }

    // Render NPC pixel art avatar to a data URL for use in contact list etc.
    // Returns a cached data URL string of the NPC's sprite.
    renderAvatarDataURL(jobKey, gender, name) {
        // v5.10.0 帶入名字讓聯絡人頭像與地圖上的村民配色一致(同職業也能分辨)
        const cacheKey = `${jobKey}_${gender}_${name || ''}`;
        if (!this._avatarCache) this._avatarCache = {};
        if (this._avatarCache[cacheKey]) return this._avatarCache[cacheKey];

        const scale = 3;
        const spriteW = 16, spriteH = 28;
        const w = spriteW * scale, h = spriteH * scale;
        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const ctx = offscreen.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Scale up so pixel art is crisp
        ctx.scale(scale, scale);

        // Draw the agent at a fixed position (centered in the sprite area)
        // _drawAgent expects center-bottom x,y — sprite is 16w x 24h drawn from (x-8, y-20)
        // We place center at x=8, bottom at y=spriteH-2 so sprite fits nicely
        this._drawAgent(ctx, 8, spriteH - 4, jobKey, false, false, name || '', false, 0, gender, '');

        const dataUrl = offscreen.toDataURL('image/png');
        this._avatarCache[cacheKey] = dataUrl;
        return dataUrl;
    }
}

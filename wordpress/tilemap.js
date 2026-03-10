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
    [T.GRASS]:    ['#5cad42','#4c9838','#6ec050','#3a8028'],
    [T.GRASS2]:   ['#68b84e','#58a540','#7acc5a','#489235'],
    [T.GRASS3]:   ['#489238','#38802a','#58a545','#286820'],
    [T.DIRT]:     ['#b08850','#956e3a','#c8a068','#7a5828'],
    [T.STONE_PATH]:['#8a7a68','#6e6050','#a09080','#585048'],
    [T.WALL_TOP]: ['#6b5a3e','#574a32','#7d6a4a','#4a3d28'],
    [T.WALL_FRONT]:['#8b7355','#7a644a','#9e8462','#6b5640'],
    [T.FLOOR]:    ['#d4b896','#c4a882','#e0c8a8','#b49a72'],
    [T.FLOOR2]:   ['#c9ad87','#b89d78','#d8bc96','#a88d68'],
    [T.DOOR]:     ['#a0784c','#8b6840','#b8885a','#704830'],
    [T.WATER]:    ['#38a8e0','#2890c8','#58c0f0','#2078b0'],
    [T.WATER2]:   ['#2890c8','#1878b0','#38a0d8','#106898'],
    [T.TREE_TRUNK]:['#6b4226','#5a3720','#7a4d2c','#4a2e18'],
    [T.TREE_TOP]: ['#1e6828','#105018','#2c8838','#0a3810'],
    [T.TREE_TOP2]:['#2c8838','#1e6828','#3ca848','#105018'],
    [T.ROOF]:     ['#b44040','#983434','#cc4c4c','#802828'],
    [T.ROOF2]:    ['#a03030','#882828','#b83838','#701e1e'],
    [T.FENCE_H]:  ['#8b6e4e','#7a6040','#a07e5a','#6a5235'],
    [T.FENCE_V]:  ['#8b6e4e','#7a6040','#a07e5a','#6a5235'],
    [T.CROP1]:    ['#78b040','#60982e','#90c858','#4a8020'],
    [T.CROP2]:    ['#88c048','#70a838','#a0d060','#589830'],
    [T.CROP3]:    ['#98d058','#80b848','#b0e070','#68a038'],
    [T.FLOWER1]:  ['#e84080','#c83068','#f06098','#a82050'],
    [T.FLOWER2]:  ['#f0a030','#d88820','#f8b848','#c07018'],
    [T.BUSH]:     ['#1e6828','#105018','#2c8838','#083010'],
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
        this.buildingZones = {}; // {locationId: {x,y,w,h}}
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
            // Exact zone click
            for (const [locId, zone] of Object.entries(this.buildingZones)) {
                if (px >= zone.x * TILE && px < (zone.x + zone.w) * TILE &&
                    py >= zone.y * TILE && py < (zone.y + zone.h) * TILE) {
                    this._moveIndicator = { x: (zone.x + zone.w / 2) * TILE, y: (zone.y + zone.h / 2) * TILE, expiry: Date.now() + 1500 };
                    this.onClick(locId);
                    return;
                }
            }
            for (const [locId, zone] of Object.entries(this.natureZones)) {
                if (px >= zone.x * TILE && px < (zone.x + zone.w) * TILE &&
                    py >= zone.y * TILE && py < (zone.y + zone.h) * TILE) {
                    this._moveIndicator = { x: (zone.x + zone.w / 2) * TILE, y: (zone.y + zone.h / 2) * TILE, expiry: Date.now() + 1500 };
                    this.onClick(locId);
                    return;
                }
            }
            // Clicked on empty space — find nearest location and move there
            let bestLoc = null, bestDist = Infinity;
            const allZones = { ...this.buildingZones, ...this.natureZones };
            for (const [locId, zone] of Object.entries(allZones)) {
                const cx = (zone.x + zone.w / 2) * TILE;
                const cy = (zone.y + zone.h / 2) * TILE;
                const dist = (px - cx) ** 2 + (py - cy) ** 2;
                if (dist < bestDist) { bestDist = dist; bestLoc = locId; }
            }
            if (bestLoc) {
                // Show move indicator at the target zone
                const zone = allZones[bestLoc];
                if (zone) {
                    this._moveIndicator = {
                        x: (zone.x + zone.w / 2) * TILE,
                        y: (zone.y + zone.h / 2) * TILE,
                        expiry: Date.now() + 1500,
                    };
                }
                this.onClick(bestLoc);
            }
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
    }

    _drawTile(ctx, type, colors) {
        const [c1, c2, c3, c4] = colors;
        const S = TILE; // 16
        ctx.fillStyle = c1;
        ctx.fillRect(0, 0, S, S);

        switch(type) {
            case T.GRASS: case T.GRASS2: case T.GRASS3: {
                // Lush grass with visible blade strokes (RPG style)
                // Base with subtle variation patches
                ctx.fillStyle = c2;
                ctx.fillRect(0,0,8,8); ctx.fillRect(8,8,8,8);
                ctx.fillStyle = c1;
                ctx.fillRect(2,1,5,6); ctx.fillRect(9,9,6,5);
                // Tall grass blades (vertical strokes, the key visual!)
                ctx.fillStyle = c3; // bright blade color
                ctx.fillRect(1,0,1,4); ctx.fillRect(3,1,1,5); ctx.fillRect(5,0,1,4);
                ctx.fillRect(7,2,1,4); ctx.fillRect(9,0,1,5); ctx.fillRect(11,1,1,4);
                ctx.fillRect(13,0,1,3); ctx.fillRect(15,2,1,4);
                // Second row of blades
                ctx.fillRect(0,7,1,4); ctx.fillRect(2,8,1,5); ctx.fillRect(4,7,1,4);
                ctx.fillRect(6,9,1,4); ctx.fillRect(8,7,1,5); ctx.fillRect(10,8,1,4);
                ctx.fillRect(12,9,1,3); ctx.fillRect(14,7,1,5);
                // Dark blade bases
                ctx.fillStyle = c4;
                ctx.fillRect(1,4,1,2); ctx.fillRect(3,5,1,2); ctx.fillRect(5,4,1,2);
                ctx.fillRect(9,5,1,2); ctx.fillRect(11,4,1,2);
                ctx.fillRect(0,11,1,2); ctx.fillRect(2,12,1,2); ctx.fillRect(4,11,1,2);
                ctx.fillRect(8,12,1,2); ctx.fillRect(10,11,1,2); ctx.fillRect(14,12,1,2);
                // Bright tips
                ctx.fillStyle = c3;
                ctx.fillRect(1,0,1,1); ctx.fillRect(5,0,1,1); ctx.fillRect(9,0,1,1); ctx.fillRect(13,0,1,1);
                ctx.fillRect(0,7,1,1); ctx.fillRect(4,7,1,1); ctx.fillRect(8,7,1,1);
                // Tiny flower accents
                if (type === T.GRASS2) {
                    ctx.fillStyle='#f0a030'; ctx.fillRect(6,3,2,2); ctx.fillRect(12,11,2,2);
                    ctx.fillStyle='#fff'; ctx.fillRect(6,3,1,1); ctx.fillRect(12,11,1,1);
                }
                if (type === T.GRASS3) {
                    // Darker grass has small mushroom/pebble
                    ctx.fillStyle='#b0a890'; ctx.fillRect(7,5,2,1);
                    ctx.fillStyle='#c0b8a0'; ctx.fillRect(7,4,2,1);
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

        // Connect to nearest road with dirt path
        this._connectToRoad(x + tmpl.doorX, y + h + 1);

        this.buildingZones[locId] = { x, y, w, h: h + 1 };
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
            this._connectToRoad(hx + house.doorX, hy + house.h + 1);
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
            const placement = BUILDING_PLACEMENTS[building.key];
            if (!placement) continue;
            const zone = this.buildingZones[placement.near] || this.natureZones[placement.near];
            if (!zone) continue;

            const bx = (zone.x + placement.offsetX) * TILE;
            const by = (zone.y + placement.offsetY) * TILE;

            this._drawBuildingIcon(ctx, building.key, bx, by);

            // Small label
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            const label = building.name;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(bx + 8 - tw/2 - 2, by - 4, tw + 4, 9);
            ctx.fillStyle = '#ffd700';
            ctx.fillText(label, bx + 8, by + 3);
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

        const startX = (farmZone.x - 3) * TILE;
        const startY = (farmZone.y + farmZone.h + 1) * TILE;
        const plotSize = 12;
        const cols = 4;

        for (let i = 0; i < plots.length; i++) {
            const plot = plots[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const px = startX + col * (plotSize + 2);
            const py = startY + row * (plotSize + 2);

            // Background soil
            ctx.fillStyle = plot.state === 'empty' ? '#8B7355' :
                            plot.state === 'tilled' ? '#6B4226' :
                            plot.state === 'withered' ? '#5a3a2a' : '#5a3a20';
            ctx.fillRect(px, py, plotSize, plotSize);

            // Crop visual
            if (plot.state === 'growing') {
                const progress = plot.growthProgress || 0;
                const h = Math.max(2, Math.round(progress / 100 * 8));
                ctx.fillStyle = '#4caf50';
                ctx.fillRect(px + 2, py + plotSize - h, 3, h);
                ctx.fillRect(px + 7, py + plotSize - h, 3, h);
                // Water indicator
                if (plot.waterLevel < 40) {
                    ctx.fillStyle = 'rgba(255,100,100,0.6)';
                    ctx.fillRect(px, py, 2, 2);
                }
            } else if (plot.state === 'ready') {
                // Mature crop - golden
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(px + 1, py + 2, 4, 8);
                ctx.fillRect(px + 7, py + 2, 4, 8);
                // Pulse effect
                if (this.animFrame % 40 < 20) {
                    ctx.fillStyle = 'rgba(255,215,0,0.3)';
                    ctx.fillRect(px - 1, py - 1, plotSize + 2, plotSize + 2);
                }
            } else if (plot.state === 'withered') {
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(px + 3, py + 4, 2, 6);
                ctx.fillRect(px + 8, py + 5, 2, 5);
            }

            // Border
            ctx.strokeStyle = plot.state === 'ready' ? '#ffd700' : 'rgba(139,115,85,0.5)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, plotSize, plotSize);
        }

        // Farm label
        ctx.font = '6px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const labelX = startX + (cols * (plotSize + 2)) / 2;
        const labelY = startY - 3;
        ctx.fillRect(labelX - 12, labelY - 5, 24, 7);
        ctx.fillStyle = '#90ee90';
        ctx.fillText('🌾農場', labelX, labelY);
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

    updateAgents(agents, locations, chatTarget) {
        this.chatTarget = chatTarget || null;
        const WALK_SPEED = 0.6; // pixels per frame — slower for easier clicking
        for (const [aid, agent] of Object.entries(agents)) {
            const locCenter = this.getLocationCenter(agent.current_location);
            // Add offset within zone so agents don't overlap
            const existing = Object.values(this.agentPositions).filter(p => {
                const dx = Math.abs(p.targetX - locCenter.x);
                const dy = Math.abs(p.targetY - locCenter.y);
                return dx < TILE * 3 && dy < TILE * 3;
            });
            const idx = existing.length;
            const spreadX = ((idx % 4) - 1.5) * TILE;
            const spreadY = (Math.floor(idx / 4) - 0.5) * TILE;

            const targetX = locCenter.x + spreadX;
            const targetY = locCenter.y + spreadY;

            // Extract job key string from agent data
            const jobKey = (agent.job && agent.job.key) ? agent.job.key : (typeof agent.job === 'string' ? agent.job : 'default');

            const gender = agent.gender || 'male';

            if (!this.agentPositions[aid]) {
                this.agentPositions[aid] = { x: targetX, y: targetY, targetX, targetY, job: jobKey, gender, walking: false, walkStep: 0 };
            } else {
                this.agentPositions[aid].targetX = targetX;
                this.agentPositions[aid].targetY = targetY;
                this.agentPositions[aid].job = jobKey;
                this.agentPositions[aid].gender = gender;
                // Freeze agents involved in player chat
                const isChatting = chatTarget && (aid === chatTarget || aid === 'player');
                // Constant-speed walking
                const dx = targetX - this.agentPositions[aid].x;
                const dy = targetY - this.agentPositions[aid].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (isChatting) {
                    // Stop walking and face each other
                    this.agentPositions[aid].walking = false;
                    this.agentPositions[aid].walkStep = 0;
                    if (chatTarget && aid === 'player' && this.agentPositions[chatTarget]) {
                        this.agentPositions[aid].facing = this.agentPositions[chatTarget].x > this.agentPositions[aid].x ? 1 : -1;
                    } else if (chatTarget && aid === chatTarget && this.agentPositions['player']) {
                        this.agentPositions[aid].facing = this.agentPositions['player'].x > this.agentPositions[aid].x ? 1 : -1;
                    }
                } else if (dist > 1) {
                    // Walk toward target at constant speed
                    const step = Math.min(WALK_SPEED, dist);
                    this.agentPositions[aid].x += (dx / dist) * step;
                    this.agentPositions[aid].y += (dy / dist) * step;
                    this.agentPositions[aid].walking = true;
                    this.agentPositions[aid].walkStep = (this.agentPositions[aid].walkStep || 0) + 1;
                    // Face direction: 1 = right, -1 = left
                    this.agentPositions[aid].facing = dx > 0 ? 1 : dx < 0 ? -1 : (this.agentPositions[aid].facing || 1);
                } else {
                    this.agentPositions[aid].x = targetX;
                    this.agentPositions[aid].y = targetY;
                    this.agentPositions[aid].walking = false;
                    this.agentPositions[aid].walkStep = 0;
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
    _drawAgent(ctx, x, y, jobKey, isPlayer, isSelected, name, walking, walkStep, gender) {
        const c = isPlayer ? JOB_COLORS.player : (JOB_COLORS[jobKey] || JOB_COLORS.default);
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

        // === Eyes (large anime-style) ===
        // Eye whites
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 4, sy + 5, 3, 3);
        ctx.fillRect(sx + 9, sy + 5, 3, 3);
        // Iris
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(sx + 5, sy + 5, 2, 3);
        ctx.fillRect(sx + 10, sy + 5, 2, 3);
        // Pupil
        ctx.fillStyle = '#111';
        ctx.fillRect(sx + 5, sy + 6, 2, 2);
        ctx.fillRect(sx + 10, sy + 6, 2, 2);
        // Eye highlight (the anime sparkle!)
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 5, sy + 5, 1, 1);
        ctx.fillRect(sx + 10, sy + 5, 1, 1);
        // Lower eye highlight
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(sx + 6, sy + 7, 1, 1);
        ctx.fillRect(sx + 11, sy + 7, 1, 1);

        // === Nose hint ===
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(sx + 8, sy + 8, 1, 1);

        // === Mouth ===
        ctx.fillStyle = '#c08070';
        ctx.fillRect(sx + 7, sy + 9, 2, 1);

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
            const ay = sy - 6 + arrowBob;
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(sx + 5, ay, 6, 2);
            ctx.fillRect(sx + 6, ay - 2, 4, 2);
            ctx.fillRect(sx + 7, ay - 4, 2, 2);
            ctx.fillStyle = 'rgba(0,229,255,0.35)';
            ctx.fillRect(sx + 4, ay + 2, 8, 1);
        }

        // === Name label ===
        if (isSelected || isPlayer) {
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            const nameShort = name.split('(')[0].trim();
            const tw = ctx.measureText(nameShort).width;
            const lx = sx + 8 - tw / 2 - 3;
            const ly = sy - 12;
            ctx.fillStyle = isPlayer ? 'rgba(0,229,255,0.88)' : 'rgba(0,0,0,0.78)';
            ctx.fillRect(lx, ly, tw + 6, 11);
            ctx.fillStyle = isPlayer ? '#003' : '#fff';
            ctx.fillText(nameShort, sx + 8, sy - 3);
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

        // Draw tile grid
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const tile = this.grid[y][x];
                const cached = this.tileCache[tile];
                if (cached) {
                    ctx.drawImage(cached, x * TILE, y * TILE);
                }
            }
        }

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
            this._drawAgent(ctx, pos.x, pos.y, pos.job, isPlayer, isSelected, agent.name || 'You', pos.walking, pos.walkStep, pos.gender);
        }

        // Draw NPC conversation speech bubbles (higher priority than thoughts)
        ctx.font = '7px monospace';
        const now = Date.now();
        const activeConvos = this._activeConvoBubbles || [];
        const shownBubbleAgents = new Set();
        for (const convo of activeConvos) {
            if (now > convo.expiry) continue;
            const fadeAlpha = Math.min(1, (convo.expiry - now) / 2000); // Fade in last 2s
            for (const bubble of convo.bubbles) {
                const pos = this.agentPositions[bubble.agentId];
                if (!pos) continue;
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
        for (const [aid, pos] of sortedAgents) {
            const agent = agents[aid];
            if (!agent || aid === 'player' || !agent.current_thought) continue;
            if (shownBubbleAgents.has(aid)) continue; // Skip if showing speech
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

    _drawExplorationMarkers(ctx) {
        const data = this.explorationData;
        if (!data || !data.discoveredZones) return;
        const zones = Object.keys(data.discoveredZones);
        if (!zones.length) return;

        const TILE = 16;
        const icons = { deep_forest:'🌲', ancient_ruins:'🏛', abandoned_mine:'⛏', mountain_pass:'⛰', riverside_cave:'🕳', cursed_swamp:'🌿' };
        const names = { deep_forest:'幽深森林', ancient_ruins:'古代遺跡', abandoned_mine:'廢棄礦坑', mountain_pass:'山間隘口', riverside_cave:'河畔洞窟', cursed_swamp:'詛咒沼澤' };

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
            const text = '墓園';
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

        // Draw festival banner at town square
        const squareZone = this.buildingZones['town_square'] || this.natureZones['town_square'];
        if (squareZone) {
            const cx = (squareZone.x + squareZone.w / 2) * TILE;
            const cy = squareZone.y * TILE - 8;

            // Banner
            ctx.fillStyle = `rgba(255,200,50,${0.6 * pulse})`;
            ctx.fillRect(cx - 30, cy - 4, 60, 12);
            ctx.strokeStyle = `rgba(255,150,0,${0.8 * pulse})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - 30, cy - 4, 60, 12);

            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#8B4513';
            ctx.fillText(`${festival.icon} ${festival.name}`, cx, cy + 5);
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

        // Sunset warm tint (very subtle, no fog)
        if (h >= 17 && h < 19.5) {
            const t = (h < 18.5) ? (h - 17) / 1.5 : 1 - (h - 18.5);
            ctx.fillStyle = `rgba(255, 140, 50, ${(t * 0.06).toFixed(3)})`;
            ctx.fillRect(0, 0, ow, oh);
        }

        if (nightAmount <= 0) return;

        // Very light blue tint instead of heavy fog — just enough to shift palette
        const tintAlpha = nightAmount * 0.15;
        ctx.fillStyle = `rgba(15, 20, 60, ${tintAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, ow, oh);

        // Stars at night
        if (nightAmount > 0.3) {
            this._renderStars(ctx, nightAmount * 0.9);
        }

        // Campfires & torches — the main night indicators
        this._renderCampfires(ctx, nightAmount);

        // Window lights at night
        if (nightAmount > 0.2) {
            this._renderWindowLights(ctx, h);
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
        // Warm ground glow
        const glowRadius = 40 + Math.sin(frame * 0.08) * 5;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        grad.addColorStop(0, `rgba(255, 160, 50, ${(alpha * 0.25).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(255, 100, 20, ${(alpha * 0.10).toFixed(3)})`);
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

        // Small warm glow
        const gr = 18 + flicker * 4;
        const grad = ctx.createRadialGradient(tx, ty - 3, 0, tx, ty - 3, gr);
        grad.addColorStop(0, `rgba(255, 150, 50, ${(alpha * 0.12).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255, 120, 30, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(tx - gr, ty - 3 - gr, gr * 2, gr * 2);
    }

    _renderStars(ctx, alpha) {
        // Use deterministic positions based on grid so stars don't flicker
        const seed = 42;
        const count = 40;
        for (let i = 0; i < count; i++) {
            const sx = ((seed * (i + 1) * 73) % this.mapWidth);
            const sy = ((seed * (i + 1) * 37 + i * 91) % (this.mapHeight * 0.6));
            const twinkle = 0.5 + 0.5 * Math.sin(this.animFrame * 0.02 + i * 2.1);
            const size = (i % 5 === 0) ? 2 : 1;
            ctx.fillStyle = `rgba(255, 255, 240, ${(alpha * twinkle * 0.9).toFixed(2)})`;
            ctx.fillRect(Math.floor(sx), Math.floor(sy), size, size);
        }
    }

    _renderWindowLights(ctx, hour) {
        const lightAlpha = (hour >= 22 || hour < 4) ? 0.7 : (hour >= 20 ? (hour - 20) * 0.35 : (6 - hour) * 0.35);
        // Draw warm glow on building zones
        for (const [locId, zone] of Object.entries(this.buildingZones)) {
            // Some buildings have lights off late at night
            if ((hour >= 1 && hour < 5) && !['tavern','guardpost','clinic'].includes(locId)) continue;
            const cx = (zone.x + zone.w / 2) * TILE;
            const cy = (zone.y + zone.h / 2) * TILE;
            const radius = Math.max(zone.w, zone.h) * TILE * 0.6;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0, `rgba(255, 200, 80, ${(lightAlpha * 0.3).toFixed(2)})`);
            grad.addColorStop(1, 'rgba(255, 200, 80, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        }
    }
}

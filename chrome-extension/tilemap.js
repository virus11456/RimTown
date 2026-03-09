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
const TILE_COLORS = {
    [T.GRASS]:    ['#4a8c3f','#3f7a35','#56a348','#2d6628'],
    [T.GRASS2]:   ['#55a044','#469038','#60b050','#3d7a35'],
    [T.GRASS3]:   ['#3d7a35','#2d6628','#4a8c3f','#1f5520'],
    [T.DIRT]:     ['#c4a56e','#a88b55','#d4b580','#9a7e4a'],
    [T.STONE_PATH]:['#9e9e9e','#828282','#bababa','#707070'],
    [T.WALL_TOP]: ['#6b5a3e','#574a32','#7d6a4a','#4a3d28'],
    [T.WALL_FRONT]:['#8b7355','#7a644a','#9e8462','#6b5640'],
    [T.FLOOR]:    ['#d4b896','#c4a882','#e0c8a8','#b49a72'],
    [T.FLOOR2]:   ['#c9ad87','#b89d78','#d8bc96','#a88d68'],
    [T.DOOR]:     ['#a0784c','#8b6840','#b8885a','#704830'],
    [T.WATER]:    ['#3d88c8','#3070b0','#50a0e0','#2858a0'],
    [T.WATER2]:   ['#3070b0','#2860a0','#3880c0','#204890'],
    [T.TREE_TRUNK]:['#6b4226','#5a3720','#7a4d2c','#4a2e18'],
    [T.TREE_TOP]: ['#2d6b1e','#1e5514','#3a8828','#184410'],
    [T.TREE_TOP2]:['#3a8a2a','#2d7520','#48a035','#206518'],
    [T.ROOF]:     ['#b44040','#983434','#cc4c4c','#802828'],
    [T.ROOF2]:    ['#a03030','#882828','#b83838','#701e1e'],
    [T.FENCE_H]:  ['#8b6e4e','#7a6040','#a07e5a','#6a5235'],
    [T.FENCE_V]:  ['#8b6e4e','#7a6040','#a07e5a','#6a5235'],
    [T.CROP1]:    ['#7cb342','#6a9a38','#8ec050','#5a8830'],
    [T.CROP2]:    ['#8bc34a','#78b040','#9cd058','#68a035'],
    [T.CROP3]:    ['#9ccc65','#88ba58','#b0da78','#78a848'],
    [T.FLOWER1]:  ['#e91e63','#c2185b','#f06292','#ad1457'],
    [T.FLOWER2]:  ['#ffeb3b','#fbc02d','#fff176','#f9a825'],
    [T.BUSH]:     ['#2e7d32','#1b5e20','#43a047','#0d4710'],
    [T.ROCK]:     ['#78909c','#607d8b','#90a4ae','#4e6d7a'],
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
    [T.SAND]:     ['#ffe0b2','#ffc880','#ffeccc','#ddb070'],
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

// Agent sprite colors by job
const JOB_COLORS = {
    mayor:     { body:'#e94560', hair:'#333' },
    doctor:    { body:'#ffffff', hair:'#5a3a1a' },
    blacksmith:{ body:'#78909c', hair:'#222' },
    cook:      { body:'#ff9800', hair:'#4a2a0a' },
    farmer:    { body:'#8bc34a', hair:'#6b4226' },
    trader:    { body:'#9c27b0', hair:'#333' },
    guard:     { body:'#455a64', hair:'#222' },
    researcher:{ body:'#2196f3', hair:'#4a3a2a' },
    miner:     { body:'#795548', hair:'#333' },
    priest:    { body:'#ffe082', hair:'#5a3a1a' },
    carpenter: { body:'#a1887f', hair:'#4a2a0a' },
    tailor:    { body:'#f48fb1', hair:'#333' },
    player:    { body:'#00e5ff', hair:'#fff' },
    default:   { body:'#90a4ae', hair:'#555' },
};

class PixelTileMap {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cols = 64;
        this.rows = 48;
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
        this.canvas.width = this.cols * TILE;
        this.canvas.height = this.rows * TILE;
        this.ctx.imageSmoothingEnabled = false;
        // Handle clicks
        this.canvas.addEventListener('click', (e) => {
            if (!this.onClick) return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const px = (e.clientX - rect.left) * scaleX;
            const py = (e.clientY - rect.top) * scaleY;
            // Check if an agent was clicked first
            for (const [aid, pos] of Object.entries(this.agentPositions)) {
                if (aid === 'player') continue;
                if (Math.abs(px - pos.x) < 8 && Math.abs(py - pos.y) < 10) {
                    if (this.onAgentClick) this.onAgentClick(aid);
                    return;
                }
            }
            // Check which location zone was clicked
            for (const [locId, zone] of Object.entries(this.buildingZones)) {
                if (px >= zone.x * TILE && px < (zone.x + zone.w) * TILE &&
                    py >= zone.y * TILE && py < (zone.y + zone.h) * TILE) {
                    this.onClick(locId);
                    return;
                }
            }
            for (const [locId, zone] of Object.entries(this.natureZones)) {
                if (px >= zone.x * TILE && px < (zone.x + zone.w) * TILE &&
                    py >= zone.y * TILE && py < (zone.y + zone.h) * TILE) {
                    this.onClick(locId);
                    return;
                }
            }
        });
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
        ctx.fillStyle = c1;
        ctx.fillRect(0, 0, TILE, TILE);

        switch(type) {
            case T.GRASS: case T.GRASS2: case T.GRASS3:
                // Dithered grass with varied blade patterns
                ctx.fillStyle = c2;
                ctx.fillRect(1,2,1,2); ctx.fillRect(5,1,1,3); ctx.fillRect(9,3,1,2); ctx.fillRect(13,1,1,2);
                ctx.fillRect(3,8,1,2); ctx.fillRect(7,7,1,3); ctx.fillRect(11,9,1,2); ctx.fillRect(14,6,1,2);
                ctx.fillStyle = c3;
                ctx.fillRect(2,5,1,2); ctx.fillRect(6,4,1,2); ctx.fillRect(10,6,1,2);
                ctx.fillRect(0,10,1,2); ctx.fillRect(4,12,1,2); ctx.fillRect(8,11,1,2); ctx.fillRect(12,13,1,2);
                ctx.fillStyle = c4;
                ctx.fillRect(3,14,1,1); ctx.fillRect(9,0,1,1); ctx.fillRect(15,10,1,1);
                // Tiny wildflower accents
                if (type === T.GRASS2) { ctx.fillStyle='#ffeb3b'; ctx.fillRect(4,3,1,1); ctx.fillRect(12,10,1,1); }
                if (type === T.GRASS3) { ctx.fillStyle='#e0e0e0'; ctx.fillRect(7,5,1,1); } // small pebble
                break;

            case T.DIRT:
                // Textured dirt with pebbles and tracks
                ctx.fillStyle = c2;
                ctx.fillRect(1,2,2,1); ctx.fillRect(6,5,3,1); ctx.fillRect(10,1,2,1); ctx.fillRect(3,9,2,1);
                ctx.fillRect(8,11,3,1); ctx.fillRect(13,7,2,1); ctx.fillRect(0,14,2,1);
                ctx.fillStyle = c3;
                ctx.fillRect(4,4,1,1); ctx.fillRect(9,8,1,1); ctx.fillRect(14,12,1,1); ctx.fillRect(2,12,1,1);
                ctx.fillStyle = c4; // darker cracks
                ctx.fillRect(7,3,1,1); ctx.fillRect(12,9,1,1); ctx.fillRect(1,7,1,1);
                break;

            case T.STONE_PATH:
                // Cobblestone pattern with mortar lines
                ctx.fillStyle = c2; ctx.fillRect(0,0,7,7); ctx.fillRect(8,8,8,8);
                ctx.fillStyle = c4; ctx.fillRect(7,0,1,TILE); ctx.fillRect(0,7,TILE,1); // mortar
                ctx.fillStyle = c3; // highlights
                ctx.fillRect(1,1,2,2); ctx.fillRect(4,3,2,2); ctx.fillRect(9,9,2,2); ctx.fillRect(12,11,2,2);
                ctx.fillStyle = c4; // worn spots
                ctx.fillRect(3,5,1,1); ctx.fillRect(10,13,1,1);
                break;

            case T.WALL_TOP:
                // Detailed brick wall top with shadow
                ctx.fillStyle = c2; ctx.fillRect(0,TILE-2,TILE,2); // shadow
                ctx.fillStyle = c4; ctx.fillRect(0,0,TILE,1); // top edge
                ctx.fillStyle = c1;
                for (let x = 0; x < TILE; x += 4) ctx.fillRect(x, 2, 3, 4);
                for (let x = 2; x < TILE; x += 4) ctx.fillRect(x, 8, 3, 4);
                ctx.fillStyle = c3; // brick highlights
                ctx.fillRect(0,2,1,1); ctx.fillRect(4,2,1,1); ctx.fillRect(2,8,1,1); ctx.fillRect(6,8,1,1);
                ctx.fillStyle = c4; ctx.fillRect(0,6,TILE,1); ctx.fillRect(0,12,TILE,1); // mortar lines
                break;

            case T.WALL_FRONT:
                // Textured wall with brick pattern and shadow
                ctx.fillStyle = c2;
                for (let x = 0; x < TILE; x += 4) ctx.fillRect(x, 0, 3, 7);
                for (let x = 2; x < TILE; x += 4) ctx.fillRect(x, 8, 3, 8);
                ctx.fillStyle = c4; ctx.fillRect(0, 7, TILE, 1); // mortar line
                ctx.fillStyle = c3; // brick highlights
                for (let x = 0; x < TILE; x += 4) ctx.fillRect(x, 1, 1, 1);
                for (let x = 2; x < TILE; x += 4) ctx.fillRect(x, 9, 1, 1);
                break;

            case T.FLOOR: case T.FLOOR2:
                // Wooden floorboards
                ctx.fillStyle = c2; ctx.fillRect(0,0,TILE,1); ctx.fillRect(0,0,1,TILE);
                ctx.fillStyle = c3; // plank grain
                ctx.fillRect(3,2,1,5); ctx.fillRect(8,1,1,6); ctx.fillRect(13,3,1,4);
                ctx.fillRect(5,9,1,5); ctx.fillRect(10,8,1,6); ctx.fillRect(2,10,1,4);
                ctx.fillStyle = c4; ctx.fillRect(0,8,TILE,1); // plank seam
                ctx.fillRect(7,0,1,8); ctx.fillRect(3,8,1,8); ctx.fillRect(12,8,1,8); // vertical seams
                break;

            case T.DOOR:
                // Ornate wooden door with frame and panels
                ctx.fillStyle = c4; ctx.fillRect(1,0,14,TILE); // frame
                ctx.fillStyle = c1; ctx.fillRect(3,1,10,14); // door body
                ctx.fillStyle = c2; // panels
                ctx.fillRect(4,2,8,5); ctx.fillRect(4,9,8,4);
                ctx.fillStyle = c3; // panel borders
                ctx.fillRect(4,2,8,1); ctx.fillRect(4,9,8,1);
                ctx.fillStyle = '#d4aa70'; ctx.fillRect(10,7,2,2); // handle
                ctx.fillStyle = '#b8943e'; ctx.fillRect(10,7,1,1); // handle highlight
                break;

            case T.WATER: case T.WATER2:
                // Deeper water with wave patterns
                ctx.fillStyle = c2; ctx.fillRect(0,3,TILE,5); ctx.fillRect(3,8,TILE,5);
                ctx.fillStyle = c4; ctx.fillRect(0,12,TILE,4); // deep shadow
                ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.2;
                ctx.fillRect(1,2,5,1); ctx.fillRect(8,6,6,1); ctx.fillRect(2,10,4,1);
                ctx.globalAlpha = 0.1;
                ctx.fillRect(6,4,3,1); ctx.fillRect(11,8,4,1);
                ctx.globalAlpha = 1;
                break;

            case T.TREE_TRUNK:
                // Detailed trunk with bark texture and roots
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(5,0,6,TILE); // trunk
                ctx.fillStyle = c2; ctx.fillRect(7,0,2,TILE); // light bark
                ctx.fillStyle = c4; ctx.fillRect(5,0,1,TILE); ctx.fillRect(10,0,1,TILE); // dark bark edges
                // bark texture
                ctx.fillStyle = c4; ctx.fillRect(6,3,1,2); ctx.fillRect(8,7,1,2); ctx.fillRect(6,11,1,2);
                // roots
                ctx.fillStyle = c1; ctx.fillRect(3,13,3,2); ctx.fillRect(10,14,3,2);
                ctx.fillStyle = c2; ctx.fillRect(4,14,1,1); ctx.fillRect(11,14,1,1);
                break;

            case T.TREE_TOP: case T.TREE_TOP2:
                // Lush canopy with depth and highlights
                ctx.fillStyle = c1; ctx.fillRect(1,2,14,12); // main foliage
                ctx.fillStyle = c3; ctx.fillRect(2,8,12,6); // shadow layer
                ctx.fillStyle = c2; ctx.fillRect(3,1,10,5); // top highlight
                // Leafy edge detail
                ctx.fillStyle = c1; ctx.fillRect(0,4,2,8); ctx.fillRect(14,4,2,8);
                ctx.fillRect(2,1,2,2); ctx.fillRect(12,1,2,2);
                // Light dapples
                ctx.fillStyle = c2; ctx.fillRect(4,3,2,1); ctx.fillRect(8,4,2,1); ctx.fillRect(6,6,2,1);
                ctx.fillRect(10,5,1,1); ctx.fillRect(3,7,1,1);
                // Deep shadow
                ctx.fillStyle = c4; ctx.fillRect(3,11,2,1); ctx.fillRect(7,12,3,1); ctx.fillRect(11,10,2,1);
                break;

            case T.ROOF: case T.ROOF2:
                // Detailed shingled roof with ridge line
                ctx.fillStyle = c1; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c2; // shingle rows
                for (let x = 0; x < TILE; x += 4) { ctx.fillRect(x, 1, 3, 3); ctx.fillRect(x, 5, 3, 1); }
                for (let x = 2; x < TILE; x += 4) { ctx.fillRect(x, 8, 3, 3); ctx.fillRect(x, 12, 3, 1); }
                ctx.fillStyle = c3; ctx.fillRect(0,7,TILE,1); // ridge shadow
                ctx.fillStyle = c4; // shingle shadow
                for (let x = 0; x < TILE; x += 4) ctx.fillRect(x, 4, 3, 1);
                for (let x = 2; x < TILE; x += 4) ctx.fillRect(x, 11, 3, 1);
                break;

            case T.FENCE_H:
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(0,5,TILE,2); ctx.fillRect(0,10,TILE,2);
                ctx.fillStyle = c2; ctx.fillRect(2,3,2,12); ctx.fillRect(12,3,2,12);
                ctx.fillStyle = c3; ctx.fillRect(3,4,1,10); ctx.fillRect(13,4,1,10); // highlight
                ctx.fillStyle = c4; ctx.fillRect(0,6,TILE,1); ctx.fillRect(0,11,TILE,1); // shadow
                break;

            case T.FENCE_V:
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(5,0,2,TILE); ctx.fillRect(10,0,2,TILE);
                ctx.fillStyle = c2; ctx.fillRect(3,2,12,2); ctx.fillRect(3,12,12,2);
                ctx.fillStyle = c3; ctx.fillRect(6,0,1,TILE); ctx.fillRect(11,0,1,TILE); // highlight
                break;

            case T.CROP1: case T.CROP2: case T.CROP3:
                // Rich farmland with detailed crops
                ctx.fillStyle = '#7a5e3e'; ctx.fillRect(0,0,TILE,TILE); // soil
                ctx.fillStyle = '#6b5030'; // furrows
                ctx.fillRect(0,4,TILE,1); ctx.fillRect(0,9,TILE,1); ctx.fillRect(0,14,TILE,1);
                ctx.fillStyle = c1; // stems
                for (let x = 2; x < TILE; x += 4) { ctx.fillRect(x, 1, 1, 3); ctx.fillRect(x, 6, 1, 3); ctx.fillRect(x, 11, 1, 3); }
                ctx.fillStyle = c2; // leaf tops
                for (let x = 1; x < TILE; x += 4) { ctx.fillRect(x, 0, 3, 2); ctx.fillRect(x, 5, 3, 2); ctx.fillRect(x, 10, 3, 2); }
                ctx.fillStyle = c3; // highlights
                ctx.fillRect(2,0,1,1); ctx.fillRect(6,5,1,1); ctx.fillRect(10,10,1,1);
                break;

            case T.FLOWER1: case T.FLOWER2:
                // Pretty flowers with multiple blooms
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = '#3d7a35'; // stems
                ctx.fillRect(3,5,1,7); ctx.fillRect(8,4,1,8); ctx.fillRect(13,6,1,6);
                // leaves
                ctx.fillStyle = '#2e7d32'; ctx.fillRect(2,8,2,1); ctx.fillRect(7,7,2,1); ctx.fillRect(12,9,2,1);
                // flowers
                ctx.fillStyle = c1;
                ctx.fillRect(2,2,3,3); ctx.fillRect(7,1,3,3); ctx.fillRect(12,3,3,3);
                ctx.fillStyle = c3; // center/stamen
                ctx.fillRect(3,3,1,1); ctx.fillRect(8,2,1,1); ctx.fillRect(13,4,1,1);
                // small buds
                ctx.fillStyle = c2; ctx.fillRect(5,6,2,2); ctx.fillRect(10,8,2,2);
                break;

            case T.BUSH:
                // Rounded bush with depth
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c4; ctx.fillRect(3,5,10,9); // shadow base
                ctx.fillStyle = c1; ctx.fillRect(2,4,12,9); // main body
                ctx.fillStyle = c3; ctx.fillRect(4,2,8,5); // top
                ctx.fillStyle = c2; ctx.fillRect(5,3,4,2); // highlight
                // berry accents
                ctx.fillStyle = '#e53935'; ctx.fillRect(4,6,1,1); ctx.fillRect(9,5,1,1); ctx.fillRect(7,8,1,1);
                break;

            case T.ROCK:
                // Realistic rock with cracks and moss
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c4; ctx.fillRect(2,6,12,9); // shadow
                ctx.fillStyle = c1; ctx.fillRect(3,4,10,9); // main rock
                ctx.fillStyle = c2; ctx.fillRect(5,3,6,3); // top face
                ctx.fillStyle = c3; ctx.fillRect(4,7,8,4); // side face
                // cracks
                ctx.fillStyle = c4; ctx.fillRect(6,5,1,3); ctx.fillRect(8,6,1,2);
                // moss
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(3,11,2,1); ctx.fillRect(10,12,2,1);
                break;

            case T.BARREL:
                // Wooden barrel with metal bands and shading
                ctx.fillStyle = c1; ctx.fillRect(3,2,10,12);
                ctx.fillStyle = c3; ctx.fillRect(4,3,2,10); // light stave
                ctx.fillStyle = c4; ctx.fillRect(10,3,2,10); // dark stave
                ctx.fillStyle = c2; ctx.fillRect(4,1,8,2); ctx.fillRect(4,13,8,2); // lids
                ctx.fillStyle = '#6e6e6e'; ctx.fillRect(3,4,10,1); ctx.fillRect(3,10,10,1); // metal bands
                ctx.fillStyle = '#888'; ctx.fillRect(4,4,1,1); ctx.fillRect(4,10,1,1); // band highlight
                break;

            case T.CRATE:
                // Wooden crate with nails and grain
                ctx.fillStyle = c1; ctx.fillRect(2,2,12,12);
                ctx.fillStyle = c4; ctx.fillRect(2,2,12,1); ctx.fillRect(2,13,12,1); // top/bottom
                ctx.fillStyle = c4; ctx.fillRect(2,2,1,12); ctx.fillRect(13,2,1,12); // sides
                ctx.fillStyle = c2; ctx.fillRect(3,3,10,10); // inner face
                ctx.fillStyle = c3; ctx.fillRect(7,3,1,10); ctx.fillRect(3,7,10,1); // cross braces
                ctx.fillStyle = '#888'; ctx.fillRect(3,3,1,1); ctx.fillRect(12,3,1,1); // nails
                ctx.fillRect(3,12,1,1); ctx.fillRect(12,12,1,1);
                break;

            case T.TABLE:
                // Wooden table with shadow
                ctx.fillStyle = c4; ctx.fillRect(3,5,11,9); // shadow
                ctx.fillStyle = c1; ctx.fillRect(2,3,12,8); // tabletop
                ctx.fillStyle = c3; ctx.fillRect(2,3,12,1); // top edge highlight
                ctx.fillStyle = c2; ctx.fillRect(3,4,10,1); // surface grain
                ctx.fillStyle = c4; // legs
                ctx.fillRect(3,11,2,3); ctx.fillRect(11,11,2,3);
                break;

            case T.CHAIR:
                // Chair with backrest and seat
                ctx.fillStyle = c1; ctx.fillRect(4,1,8,4); // backrest
                ctx.fillStyle = c3; ctx.fillRect(4,1,8,1); // top edge
                ctx.fillStyle = c2; ctx.fillRect(4,5,8,5); // seat
                ctx.fillStyle = c4; // legs
                ctx.fillRect(4,10,2,4); ctx.fillRect(10,10,2,4);
                ctx.fillStyle = c3; ctx.fillRect(5,6,6,1); // seat highlight
                break;

            case T.BED:
                // Cozy bed with pillow and patterned blanket
                ctx.fillStyle = c4; ctx.fillRect(2,2,12,13); // frame
                ctx.fillStyle = c1; ctx.fillRect(3,3,10,11); // mattress
                ctx.fillStyle = '#5c6bc0'; ctx.fillRect(3,5,10,9); // blanket
                ctx.fillStyle = '#7986cb'; ctx.fillRect(4,6,8,3); // blanket fold
                ctx.fillStyle = '#fff'; ctx.fillRect(4,2,8,3); // pillow
                ctx.fillStyle = '#e8e8e8'; ctx.fillRect(5,3,6,1); // pillow shadow
                ctx.fillStyle = '#3f51b5'; ctx.fillRect(5,8,2,1); ctx.fillRect(9,10,2,1); // blanket pattern
                break;

            case T.ANVIL:
                // Detailed anvil on stand
                ctx.fillStyle = c4; ctx.fillRect(4,10,8,4); // base
                ctx.fillStyle = c1; ctx.fillRect(3,6,10,5); // body
                ctx.fillStyle = c2; ctx.fillRect(2,4,12,3); // horn face
                ctx.fillStyle = c3; ctx.fillRect(4,2,8,3); // top face (highlight)
                ctx.fillStyle = c4; ctx.fillRect(1,5,3,2); // horn tip
                ctx.fillStyle = '#888'; ctx.fillRect(5,3,6,1); // edge shine
                break;

            case T.FURNACE:
                // Glowing furnace with fire
                ctx.fillStyle = '#455a64'; ctx.fillRect(2,1,12,14); // stone body
                ctx.fillStyle = '#37474f'; ctx.fillRect(2,1,12,2); // top
                ctx.fillStyle = c1; ctx.fillRect(4,7,8,6); // fire chamber
                ctx.fillStyle = c2; ctx.fillRect(5,5,6,3); // top glow
                ctx.fillStyle = '#ff9800'; ctx.fillRect(5,8,6,4); // fire
                ctx.fillStyle = '#ffeb3b'; ctx.fillRect(6,9,4,2); // flame core
                ctx.fillStyle = '#fff'; ctx.globalAlpha=0.3; ctx.fillRect(7,10,2,1); ctx.globalAlpha=1;
                break;

            case T.COUNTER:
                // Shop counter with items
                ctx.fillStyle = c4; ctx.fillRect(0,5,TILE,9); // shadow
                ctx.fillStyle = c1; ctx.fillRect(0,3,TILE,8); // counter body
                ctx.fillStyle = c3; ctx.fillRect(0,3,TILE,1); // top edge
                ctx.fillStyle = c2; ctx.fillRect(1,4,14,1); // surface
                ctx.fillStyle = c4; ctx.fillRect(0,11,TILE,1); // bottom edge
                break;

            case T.BOOKSHELF:
                // Colorful bookshelf with varied books
                ctx.fillStyle = c1; ctx.fillRect(1,0,14,TILE); // frame
                ctx.fillStyle = c4; ctx.fillRect(1,0,14,1); ctx.fillRect(1,7,14,1); // shelves
                ctx.fillStyle = '#c62828'; ctx.fillRect(2,1,2,6); // red book
                ctx.fillStyle = '#1565c0'; ctx.fillRect(4,1,3,6); // blue book
                ctx.fillStyle = '#2e7d32'; ctx.fillRect(7,2,2,5); // green book (shorter)
                ctx.fillStyle = '#f9a825'; ctx.fillRect(9,1,2,6); // gold book
                ctx.fillStyle = '#6a1b9a'; ctx.fillRect(11,1,3,6); // purple book
                ctx.fillStyle = '#e65100'; ctx.fillRect(2,8,3,6); // orange book
                ctx.fillStyle = '#00838f'; ctx.fillRect(5,9,2,5); // teal book
                ctx.fillStyle = '#ad1457'; ctx.fillRect(7,8,3,6); // crimson book
                ctx.fillStyle = '#33691e'; ctx.fillRect(10,8,2,6); // olive book
                ctx.fillStyle = '#4527a0'; ctx.fillRect(12,9,2,5); // indigo book
                break;

            case T.WELL:
                // Detailed well with bucket
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c4; ctx.fillRect(3,3,10,10); // well rim shadow
                ctx.fillStyle = c1; ctx.fillRect(3,3,10,10); // stone rim
                ctx.fillStyle = '#3070b0'; ctx.fillRect(5,5,6,6); // water
                ctx.fillStyle = '#50a0e0'; ctx.fillRect(6,6,3,2); // water highlight
                ctx.fillStyle = c2; // rim stones
                ctx.fillRect(3,3,10,2); ctx.fillRect(3,11,10,2);
                ctx.fillRect(3,3,2,10); ctx.fillRect(11,3,2,10);
                ctx.fillStyle = c3; ctx.fillRect(4,4,1,1); ctx.fillRect(11,4,1,1); // stone highlights
                break;

            case T.ALTAR:
                // Ornate altar with candles
                ctx.fillStyle = c4; ctx.fillRect(4,6,8,9); // shadow
                ctx.fillStyle = c1; ctx.fillRect(3,4,10,9); // altar body
                ctx.fillStyle = c2; ctx.fillRect(4,2,8,3); // top surface
                ctx.fillStyle = '#fff'; ctx.fillRect(6,3,4,1); // holy symbol
                ctx.fillStyle = '#fff'; ctx.fillRect(7,2,2,2); // cross
                // candles
                ctx.fillStyle = '#fff8e1'; ctx.fillRect(4,1,1,3); ctx.fillRect(11,1,1,3);
                ctx.fillStyle = '#ff9800'; ctx.fillRect(4,0,1,1); ctx.fillRect(11,0,1,1); // flames
                break;

            case T.SAND:
                // Textured sand with shells and ripples
                ctx.fillStyle = c2; ctx.fillRect(2,3,3,1); ctx.fillRect(9,7,2,1); ctx.fillRect(4,11,3,1);
                ctx.fillStyle = c3; ctx.fillRect(6,2,2,1); ctx.fillRect(12,5,2,1); ctx.fillRect(1,9,2,1);
                ctx.fillStyle = c4; ctx.fillRect(8,4,1,1); ctx.fillRect(3,8,1,1); ctx.fillRect(13,11,1,1); // pebbles
                ctx.fillStyle = '#ffe8cc'; ctx.fillRect(10,10,1,1); // shell
                break;

            case T.BRIDGE:
                // Wooden bridge with planks and railings
                ctx.fillStyle = c1; ctx.fillRect(0,0,TILE,TILE); // deck
                ctx.fillStyle = c4; // plank gaps
                ctx.fillRect(0,3,TILE,1); ctx.fillRect(0,7,TILE,1); ctx.fillRect(0,11,TILE,1);
                ctx.fillStyle = c2; // railings
                ctx.fillRect(0,0,TILE,2); ctx.fillRect(0,14,TILE,2);
                ctx.fillStyle = c3; // railing posts
                ctx.fillRect(2,0,2,TILE); ctx.fillRect(12,0,2,TILE);
                ctx.fillStyle = c4; ctx.fillRect(3,1,1,14); ctx.fillRect(13,1,1,14); // post shadow
                break;

            case T.STALL:
                // Market stall with striped canopy
                ctx.fillStyle = c1; ctx.fillRect(1,6,14,8); // counter
                ctx.fillStyle = '#e65100'; ctx.fillRect(0,1,8,5); // canopy left
                ctx.fillStyle = '#ff8f00'; ctx.fillRect(8,1,8,5); // canopy right stripe
                ctx.fillStyle = '#e65100'; ctx.fillRect(0,0,TILE,1); // top edge
                ctx.fillStyle = c2; ctx.fillRect(2,7,12,5); // counter surface
                ctx.fillStyle = '#8bc34a'; ctx.fillRect(3,8,3,2); // goods
                ctx.fillStyle = '#ff5722'; ctx.fillRect(7,8,3,2);
                ctx.fillStyle = '#ffeb3b'; ctx.fillRect(11,8,3,2);
                break;

            case T.WEAPON_RACK:
                // Weapon rack with swords and shield
                ctx.fillStyle = c1; ctx.fillRect(2,0,12,TILE); // rack
                ctx.fillStyle = c2; ctx.fillRect(2,0,1,TILE); ctx.fillRect(13,0,1,TILE); // edges
                ctx.fillStyle = '#b0bec5'; // swords
                ctx.fillRect(4,2,1,10); ctx.fillRect(7,1,1,11); ctx.fillRect(10,2,1,10);
                ctx.fillStyle = '#8d6e63'; // handles
                ctx.fillRect(4,12,1,3); ctx.fillRect(7,12,1,3); ctx.fillRect(10,12,1,3);
                ctx.fillStyle = c4; ctx.fillRect(5,4,1,1); ctx.fillRect(8,3,1,1); // crossguards
                ctx.fillStyle = '#d4aa70'; ctx.fillRect(5,4,1,1); ctx.fillRect(11,4,1,1); // gold detail
                break;

            case T.WINDOW:
                // Window with curtain and light reflection
                ctx.fillStyle = '#574a32'; ctx.fillRect(0,0,TILE,TILE); // wall frame
                ctx.fillStyle = c1; ctx.fillRect(2,2,12,12); // glass
                ctx.fillStyle = c2; // panes
                ctx.fillRect(3,3,4,4); ctx.fillRect(9,3,4,4);
                ctx.fillRect(3,9,4,4); ctx.fillRect(9,9,4,4);
                ctx.fillStyle = '#574a32'; // muntins
                ctx.fillRect(7,2,2,12); ctx.fillRect(2,7,12,2);
                ctx.fillStyle = c3; // light reflection
                ctx.fillRect(3,3,2,1); ctx.fillRect(9,3,2,1);
                ctx.fillStyle = '#fff'; ctx.globalAlpha=0.15; ctx.fillRect(3,3,1,2); ctx.fillRect(9,3,1,2); ctx.globalAlpha=1;
                break;

            case T.DARK_FLOOR:
                // Cave/mine floor with cracks
                ctx.fillStyle = c1; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c2; ctx.fillRect(0,0,TILE,1); ctx.fillRect(0,0,1,TILE);
                ctx.fillStyle = c4; // cracks
                ctx.fillRect(4,3,1,3); ctx.fillRect(5,5,2,1); ctx.fillRect(9,8,1,4); ctx.fillRect(10,11,3,1);
                ctx.fillStyle = c3; ctx.fillRect(2,10,1,1); ctx.fillRect(12,5,1,1); // pebbles
                break;

            case T.RUG:
                // Ornate rug with tassels and pattern
                ctx.fillStyle = '#d4b896'; ctx.fillRect(0,0,TILE,TILE); // floor
                ctx.fillStyle = c1; ctx.fillRect(2,2,12,12); // rug body
                ctx.fillStyle = c2; ctx.fillRect(3,3,10,10); // inner border
                ctx.fillStyle = c4; ctx.fillRect(5,5,6,6); // center pattern
                ctx.fillStyle = c1; ctx.fillRect(6,6,4,4); // inner diamond
                ctx.fillStyle = '#ffb300'; ctx.fillRect(7,7,2,2); // gold center
                // tassels
                ctx.fillStyle = c1; ctx.fillRect(3,14,2,1); ctx.fillRect(7,14,2,1); ctx.fillRect(11,14,2,1);
                break;

            case T.CAULDRON:
                // Bubbling cauldron with steam
                ctx.fillStyle = c4; ctx.fillRect(4,5,8,10); // shadow
                ctx.fillStyle = c1; ctx.fillRect(3,4,10,9); // body
                ctx.fillStyle = c2; ctx.fillRect(4,3,8,2); // rim
                ctx.fillStyle = '#388e3c'; ctx.fillRect(5,6,6,5); // liquid
                ctx.fillStyle = '#66bb6a'; ctx.fillRect(6,7,4,3); // highlight
                // bubbles
                ctx.fillStyle = '#81c784'; ctx.fillRect(6,6,1,1); ctx.fillRect(9,8,1,1);
                // steam
                ctx.fillStyle='#fff'; ctx.globalAlpha=0.2;
                ctx.fillRect(6,1,1,2); ctx.fillRect(9,0,1,3);
                ctx.globalAlpha=1;
                // legs
                ctx.fillStyle = '#333'; ctx.fillRect(4,13,2,2); ctx.fillRect(10,13,2,2);
                break;
        }
    }

    // Generate the town layout based on world locations
    generateLayout(locations) {
        this.grid = Array.from({length: this.rows}, () => Array(this.cols).fill(T.GRASS));
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
            town_square:  { x:26, y:20, type:'square' },
            tavern:       { x:15, y:18, type:'building' },
            chapel:       { x:40, y:10, type:'building' },
            park:         { x:5,  y:18, type:'nature' },
            well:         { x:30, y:26, type:'well' },

            // Work - spread around
            town_hall:    { x:25, y:8,  type:'building' },
            farm:         { x:5,  y:32, type:'farm' },
            quarry:       { x:50, y:33, type:'mine' },
            workshop:     { x:40, y:22, type:'building' },
            general_store:{ x:15, y:10, type:'building' },
            clinic:       { x:38, y:32, type:'building' },
            library:      { x:50, y:10, type:'building' },
            guardpost:    { x:5,  y:8,  type:'building' },

            // Residential
            residential_north:{ x:24, y:3,  type:'house_cluster' },
            residential_south:{ x:14, y:35, type:'house_cluster' },
            residential_east: { x:50, y:22, type:'house_cluster' },

            // Nature
            forest:  { x:3,  y:26, type:'forest' },
            river:   { x:33, y:38, type:'river' },
            hill:    { x:56, y:5,  type:'hill' },
            cave:    { x:56, y:40, type:'cave' },
            lake:    { x:45, y:40, type:'lake' },
            meadow:  { x:8,  y:42, type:'meadow' },
        };

        // Draw roads first - main horizontal and vertical roads
        const roadY1 = 16, roadY2 = 30;
        const roadX1 = 22, roadX2 = 38;

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
        for (let y = 18; y < 26; y++) {
            for (let x = 24; x < 34; x++) {
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
        // Place 2-3 small houses
        const house = TILE_BUILDING_TEMPLATES.house;
        const positions = [
            { dx: 0, dy: 0 },
            { dx: house.w + 1, dy: 0 },
        ];
        for (const p of positions) {
            const hx = x + p.dx, hy = y + p.dy;
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
        const totalW = house.w * 2 + 1;
        this.buildingZones[locId] = { x, y, w: totalW, h: house.h + 1 };
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
        for (let dy = 0; dy < 5; dy++) {
            for (let dx = 0; dx < 6; dx++) {
                if (y+dy < this.rows && x+dx < this.cols) {
                    const isTree = (dx + dy) % 2 === 0;
                    this.grid[y+dy][x+dx] = isTree ? T.TREE_TOP : T.TREE_TOP2;
                }
            }
        }
        // Small clearing
        if (y+2 < this.rows && x+3 < this.cols) this.grid[y+2][x+2] = T.GRASS;
        if (y+2 < this.rows && x+3 < this.cols) this.grid[y+2][x+3] = T.GRASS2;

        this.natureZones[locId] = { x, y, w: 6, h: 5 };
        this.labelPositions[locId] = { x: (x + 3) * TILE, y: y * TILE - 4, name };
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
        for (let dy = 0; dy < 5; dy++) {
            for (let dx = 0; dx < 7; dx++) {
                if (y+dy < this.rows && x+dx < this.cols) {
                    // Oval shape
                    const cx2 = 3, cy2 = 2;
                    const dist = ((dx-cx2)*(dx-cx2))/9 + ((dy-cy2)*(dy-cy2))/4;
                    if (dist < 1.2) {
                        this.grid[y+dy][x+dx] = (dx+dy) % 2 === 0 ? T.WATER : T.WATER2;
                    } else if (dist < 1.8) {
                        this.grid[y+dy][x+dx] = T.SAND;
                    }
                }
            }
        }
        // Lily pads (flowers on water edge)
        this.natureZones[locId] = { x, y, w: 7, h: 5 };
        this.labelPositions[locId] = { x: (x + 3.5) * TILE, y: y * TILE - 4, name };
    }

    _placeMeadow(locId, x, y, name) {
        for (let dy = 0; dy < 4; dy++) {
            for (let dx = 0; dx < 6; dx++) {
                if (y+dy < this.rows && x+dx < this.cols) {
                    const r = (dx * 3 + dy * 7) % 5;
                    if (r === 0) this.grid[y+dy][x+dx] = T.FLOWER1;
                    else if (r === 1) this.grid[y+dy][x+dx] = T.FLOWER2;
                    else this.grid[y+dy][x+dx] = T.GRASS2;
                }
            }
        }
        this.natureZones[locId] = { x, y, w: 6, h: 4 };
        this.labelPositions[locId] = { x: (x + 3) * TILE, y: y * TILE - 4, name };
    }

    _placeNatureArea(locId, x, y, name) {
        // Generic park/nature area
        for (let dy = 0; dy < 5; dy++) {
            for (let dx = 0; dx < 6; dx++) {
                if (y+dy < this.rows && x+dx < this.cols) {
                    const r = (dx * 5 + dy * 3) % 7;
                    if (r === 0) this.grid[y+dy][x+dx] = T.TREE_TOP;
                    else if (r === 1) this.grid[y+dy][x+dx] = T.FLOWER1;
                    else if (r === 2) this.grid[y+dy][x+dx] = T.BUSH;
                    else this.grid[y+dy][x+dx] = T.GRASS2;
                }
            }
        }
        // Bench
        if (y+2 < this.rows && x+3 < this.cols) this.grid[y+2][x+3] = T.CHAIR;

        this.natureZones[locId] = { x, y, w: 6, h: 5 };
        this.labelPositions[locId] = { x: (x + 3) * TILE, y: y * TILE - 4, name };
    }

    _connectToRoad(doorX, doorY) {
        // Draw a short dirt path from doorway toward nearest road
        const roadY1 = 16, roadY2 = 30, roadX1 = 22, roadX2 = 38;
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

    // Update agent positions (smooth interpolation)
    updateAgents(agents, locations) {
        const WALK_SPEED = 1.2; // pixels per frame — constant walking speed
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

            if (!this.agentPositions[aid]) {
                this.agentPositions[aid] = { x: targetX, y: targetY, targetX, targetY, job: agent.job || 'default', walking: false, walkStep: 0 };
            } else {
                this.agentPositions[aid].targetX = targetX;
                this.agentPositions[aid].targetY = targetY;
                this.agentPositions[aid].job = agent.job || 'default';
                // Constant-speed walking
                const dx = targetX - this.agentPositions[aid].x;
                const dy = targetY - this.agentPositions[aid].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 1) {
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

    // Draw agent sprite
    _drawAgent(ctx, x, y, jobKey, isPlayer, isSelected, name, walking, walkStep) {
        const colors = JOB_COLORS[jobKey] || JOB_COLORS.default;
        if (isPlayer) {
            colors.body = JOB_COLORS.player.body;
            colors.hair = JOB_COLORS.player.hair;
        }
        const sx = Math.floor(x - 5);
        const bob = walking ? Math.sin((walkStep || 0) * 0.4) * 1.2 : 0;
        const sy = Math.floor(y - 13 + bob);
        const ws = walkStep || 0;
        const legPhase = Math.floor(ws / 6) % 2;

        // Shadow (elliptical)
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(sx - 1, Math.floor(y) + 2, 12, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(sx, Math.floor(y) + 1, 10, 1);

        // Shoes
        ctx.fillStyle = '#3e2723';
        if (walking) {
            if (legPhase === 0) {
                ctx.fillRect(sx + 1, sy + 14, 3, 2); ctx.fillRect(sx + 6, sy + 14, 3, 2);
            } else {
                ctx.fillRect(sx + 3, sy + 14, 3, 2); ctx.fillRect(sx + 4, sy + 14, 3, 2);
            }
        } else {
            ctx.fillRect(sx + 2, sy + 14, 3, 2); ctx.fillRect(sx + 5, sy + 14, 3, 2);
        }

        // Legs (pants)
        ctx.fillStyle = '#455a64';
        if (walking) {
            if (legPhase === 0) {
                ctx.fillRect(sx + 2, sy + 12, 3, 2); ctx.fillRect(sx + 6, sy + 12, 3, 2);
            } else {
                ctx.fillRect(sx + 3, sy + 12, 3, 2); ctx.fillRect(sx + 4, sy + 12, 3, 2);
            }
        } else {
            ctx.fillRect(sx + 2, sy + 12, 3, 2); ctx.fillRect(sx + 5, sy + 12, 3, 2);
        }

        // Body (torso)
        ctx.fillStyle = colors.body;
        ctx.fillRect(sx + 1, sy + 5, 8, 7);
        // Body shading
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(sx + 2, sy + 5, 3, 7);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(sx + 7, sy + 5, 2, 7);
        // Collar/neckline
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(sx + 3, sy + 5, 4, 1);

        // Arms (animate slightly when walking)
        ctx.fillStyle = colors.body;
        if (walking) {
            const armSwing = legPhase === 0 ? 1 : -1;
            ctx.fillRect(sx - 1, sy + 6 + armSwing, 2, 5);
            ctx.fillRect(sx + 9, sy + 6 - armSwing, 2, 5);
            // Hands
            ctx.fillStyle = '#ffd5b4';
            ctx.fillRect(sx - 1, sy + 10 + armSwing, 2, 2);
            ctx.fillRect(sx + 9, sy + 10 - armSwing, 2, 2);
        } else {
            ctx.fillRect(sx - 1, sy + 6, 2, 5);
            ctx.fillRect(sx + 9, sy + 6, 2, 5);
            ctx.fillStyle = '#ffd5b4';
            ctx.fillRect(sx - 1, sy + 10, 2, 2);
            ctx.fillRect(sx + 9, sy + 10, 2, 2);
        }

        // Head
        ctx.fillStyle = '#ffd5b4';
        ctx.fillRect(sx + 2, sy, 6, 5);
        // Face shadow
        ctx.fillStyle = '#eec4a0';
        ctx.fillRect(sx + 6, sy + 1, 2, 3);

        // Hair
        ctx.fillStyle = colors.hair;
        ctx.fillRect(sx + 2, sy - 1, 6, 2); // top
        ctx.fillRect(sx + 1, sy - 1, 1, 4); // left side
        ctx.fillRect(sx + 8, sy - 1, 1, 4); // right side
        // Hair highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(sx + 3, sy - 1, 2, 1);

        // Eyes
        ctx.fillStyle = '#333';
        ctx.fillRect(sx + 3, sy + 2, 1, 1);
        ctx.fillRect(sx + 6, sy + 2, 1, 1);
        // Eye whites
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 3, sy + 2, 1, 1);
        ctx.fillStyle = '#333';
        ctx.fillRect(sx + 3, sy + 2, 1, 1); // pupil on white

        // Mouth hint
        ctx.fillStyle = '#d4a48c';
        ctx.fillRect(sx + 4, sy + 3, 2, 1);

        // Job accessory
        this._drawJobAccessory(ctx, sx, sy, jobKey, isPlayer, walking, ws);

        // Selection indicator
        if (isSelected) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(sx - 3, sy - 4, 16, 22);
            ctx.setLineDash([]);
        }
        if (isPlayer) {
            // Animated bouncing arrow
            const arrowBob = Math.sin(this.animFrame * 0.08) * 1.5;
            const ay = sy - 7 + arrowBob;
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(sx + 3, ay, 4, 2);
            ctx.fillRect(sx + 4, ay - 2, 2, 2);
            // Arrow glow
            ctx.fillStyle = 'rgba(0,229,255,0.3)';
            ctx.fillRect(sx + 2, ay + 2, 6, 1);
        }

        // Name label
        if (isSelected || isPlayer) {
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            const nameShort = name.split('(')[0].trim();
            const tw = ctx.measureText(nameShort).width;
            const lx = sx + 5 - tw/2 - 3;
            const ly = sy - 16;
            // Background with rounded look
            ctx.fillStyle = isPlayer ? 'rgba(0,229,255,0.85)' : 'rgba(0,0,0,0.75)';
            ctx.fillRect(lx, ly, tw + 6, 11);
            ctx.fillStyle = isPlayer ? '#003' : '#fff';
            ctx.fillText(nameShort, sx + 5, sy - 7);
        }
    }

    _drawJobAccessory(ctx, sx, sy, jobKey, isPlayer, walking, ws) {
        if (isPlayer) return; // Player has the arrow indicator
        switch (jobKey) {
            case 'doctor':
                // Red cross on body
                ctx.fillStyle = '#e53935';
                ctx.fillRect(sx + 4, sy + 7, 2, 1);
                ctx.fillRect(sx + 4, sy + 6, 1, 3);
                break;
            case 'guard':
                // Helmet visor
                ctx.fillStyle = '#78909c';
                ctx.fillRect(sx + 2, sy - 1, 6, 1);
                break;
            case 'cook':
                // Chef hat
                ctx.fillStyle = '#fff';
                ctx.fillRect(sx + 3, sy - 3, 4, 2);
                ctx.fillRect(sx + 2, sy - 2, 6, 1);
                break;
            case 'blacksmith':
                // Apron
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(sx + 2, sy + 8, 6, 4);
                break;
            case 'priest':
                // Holy collar
                ctx.fillStyle = '#fff';
                ctx.fillRect(sx + 3, sy + 4, 4, 1);
                break;
            case 'researcher':
                // Glasses
                ctx.fillStyle = '#90caf9';
                ctx.fillRect(sx + 2, sy + 2, 2, 1);
                ctx.fillRect(sx + 6, sy + 2, 2, 1);
                break;
            case 'mayor':
                // Sash
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(sx + 2, sy + 5, 1, 6);
                ctx.fillRect(sx + 3, sy + 6, 1, 5);
                break;
            case 'farmer':
                // Straw hat
                ctx.fillStyle = '#deb887';
                ctx.fillRect(sx + 1, sy - 2, 8, 1);
                ctx.fillStyle = '#c8a265';
                ctx.fillRect(sx + 2, sy - 3, 6, 2);
                break;
            case 'miner':
                // Headlamp
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(sx + 4, sy - 1, 2, 1);
                break;
            case 'tailor':
                // Measuring tape around neck
                ctx.fillStyle = '#ffeb3b';
                ctx.fillRect(sx + 1, sy + 4, 1, 3);
                ctx.fillRect(sx + 8, sy + 4, 1, 3);
                break;
            case 'trader':
                // Money pouch
                ctx.fillStyle = '#8d6e63';
                ctx.fillRect(sx + 7, sy + 9, 3, 2);
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(sx + 8, sy + 9, 1, 1);
                break;
            case 'carpenter':
                // Tool belt
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(sx + 1, sy + 10, 8, 1);
                ctx.fillStyle = '#90a4ae';
                ctx.fillRect(sx + 2, sy + 10, 1, 2); // hammer
                break;
        }
    }

    // Main render
    render(agents, selectedAgent, playerLoc, completedBuildings) {
        const ctx = this.ctx;
        this.animFrame++;

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

        // Draw agents
        const sortedAgents = Object.entries(this.agentPositions).sort((a, b) => a[1].y - b[1].y);
        for (const [aid, pos] of sortedAgents) {
            const agent = agents[aid];
            if (!agent) continue;
            const isPlayer = aid === 'player';
            const isSelected = aid === selectedAgent;
            this._drawAgent(ctx, pos.x, pos.y, pos.job, isPlayer, isSelected, agent.name || 'You', pos.walking, pos.walkStep);
        }

        // Draw thought bubbles for some agents
        ctx.font = '7px monospace';
        for (const [aid, pos] of sortedAgents) {
            const agent = agents[aid];
            if (!agent || aid === 'player' || !agent.current_thought) continue;
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
            }
        }

        // Keep particle count reasonable
        if (this._particles.length > 200) this._particles = this._particles.slice(-150);
    }

    _renderDayNightOverlay(ctx) {
        const h = this.timeHour + this.timeMinute / 60;
        // Calculate darkness & tint based on hour
        // 0=midnight, 6=dawn, 12=noon, 18=dusk, 24=midnight
        let darkness = 0;
        let tintR = 0, tintG = 0, tintB = 0;

        if (h >= 22 || h < 4) {
            // Deep night: dark blue overlay
            darkness = 0.55;
            tintR = 10; tintG = 15; tintB = 50;
        } else if (h >= 4 && h < 5.5) {
            // Pre-dawn: transitioning from night to dawn
            const t = (h - 4) / 1.5;
            darkness = 0.55 - t * 0.35;
            tintR = 10 + t * 50; tintG = 15 + t * 20; tintB = 50 - t * 20;
        } else if (h >= 5.5 && h < 7) {
            // Dawn: warm golden light
            const t = (h - 5.5) / 1.5;
            darkness = 0.2 - t * 0.2;
            tintR = 60 - t * 60; tintG = 35 - t * 35; tintB = 30 - t * 30;
        } else if (h >= 7 && h < 17) {
            // Daytime: no overlay
            darkness = 0;
        } else if (h >= 17 && h < 19) {
            // Sunset: warm orange tint
            const t = (h - 17) / 2;
            darkness = t * 0.15;
            tintR = t * 70; tintG = t * 30; tintB = 0;
        } else if (h >= 19 && h < 20.5) {
            // Dusk: transitioning to blue
            const t = (h - 19) / 1.5;
            darkness = 0.15 + t * 0.2;
            tintR = 70 - t * 50; tintG = 30 - t * 10; tintB = t * 30;
        } else if (h >= 20.5 && h < 22) {
            // Late dusk to night
            const t = (h - 20.5) / 1.5;
            darkness = 0.35 + t * 0.2;
            tintR = 20 - t * 10; tintG = 20 - t * 5; tintB = 30 + t * 20;
        }

        if (darkness <= 0) return;

        // Main darkness layer
        ctx.fillStyle = `rgba(${Math.round(tintR)}, ${Math.round(tintG)}, ${Math.round(tintB)}, ${darkness.toFixed(3)})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars at night (h >= 21 or h < 5)
        if (h >= 21 || h < 5) {
            const starAlpha = (h >= 22 || h < 4) ? 0.8 : (h >= 21 ? (h - 21) * 0.8 : (5 - h) * 0.8);
            this._renderStars(ctx, starAlpha);
        }

        // Window lights at night - warm glow from buildings
        if (h >= 20 || h < 6) {
            this._renderWindowLights(ctx, h);
        }
    }

    _renderStars(ctx, alpha) {
        // Use deterministic positions based on grid so stars don't flicker
        const seed = 42;
        const count = 40;
        for (let i = 0; i < count; i++) {
            const sx = ((seed * (i + 1) * 73) % this.canvas.width);
            const sy = ((seed * (i + 1) * 37 + i * 91) % (this.canvas.height * 0.6));
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

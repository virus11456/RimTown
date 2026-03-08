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

// Color palette for each tile
const TILE_COLORS = {
    [T.GRASS]:    ['#4a8c3f','#458537','#3d7a35'],
    [T.GRASS2]:   ['#55a044','#4d9840','#469038'],
    [T.GRASS3]:   ['#3d7a35','#357030','#2d6628'],
    [T.DIRT]:     ['#c4a56e','#b89860','#a88b55'],
    [T.STONE_PATH]:['#9e9e9e','#8a8a8a','#b0b0b0'],
    [T.WALL_TOP]: ['#6b5a3e','#5f4f36','#735f44'],
    [T.WALL_FRONT]:['#8b7355','#7d684d','#9a8060'],
    [T.FLOOR]:    ['#d4b896','#c9ad87','#dfbfa0'],
    [T.FLOOR2]:   ['#c9ad87','#bea37d','#d4b490'],
    [T.DOOR]:     ['#a0784c','#8b6840','#b08858'],
    [T.WATER]:    ['#4488cc','#3d7dbe','#4b93d8'],
    [T.WATER2]:   ['#3377bb','#2d6bab','#3982c6'],
    [T.TREE_TRUNK]:['#6b4226','#5a3720','#7a4d2c'],
    [T.TREE_TOP]: ['#2d6b1e','#266018','#348025'],
    [T.TREE_TOP2]:['#3a8a2a','#327e24','#429630'],
    [T.ROOF]:     ['#b44040','#a53838','#c04848'],
    [T.ROOF2]:    ['#a03030','#942a2a','#ac3636'],
    [T.FENCE_H]:  ['#8b6e4e','#7d6344','#9a7a58'],
    [T.FENCE_V]:  ['#8b6e4e','#7d6344','#9a7a58'],
    [T.CROP1]:    ['#7cb342','#6fa538','#88c04c'],
    [T.CROP2]:    ['#8bc34a','#7eb540','#96cf54'],
    [T.CROP3]:    ['#9ccc65','#8fbe5b','#a9d96f'],
    [T.FLOWER1]:  ['#e91e63','#d81b60','#f06292'],
    [T.FLOWER2]:  ['#ffeb3b','#fdd835','#fff176'],
    [T.BUSH]:     ['#2e7d32','#1b5e20','#388e3c'],
    [T.ROCK]:     ['#78909c','#607d8b','#90a4ae'],
    [T.BARREL]:   ['#795548','#6d4c41','#8d6e63'],
    [T.CRATE]:    ['#a1887f','#8d6e63','#bcaaa4'],
    [T.TABLE]:    ['#8d6e63','#795548','#a1887f'],
    [T.CHAIR]:    ['#795548','#6d4c41','#8d6e63'],
    [T.BED]:      ['#e8d5b7','#dcc9ab','#f0dfc3'],
    [T.ANVIL]:    ['#546e7a','#455a64','#607d8b'],
    [T.FURNACE]:  ['#bf360c','#e65100','#ff6e40'],
    [T.COUNTER]:  ['#6d4c41','#5d4037','#795548'],
    [T.BOOKSHELF]:['#5d4037','#4e342e','#6d4c41'],
    [T.WELL]:     ['#78909c','#607d8b','#90a4ae'],
    [T.ALTAR]:    ['#ffe082','#ffd54f','#ffecb3'],
    [T.SAND]:     ['#ffe0b2','#ffd180','#ffcc80'],
    [T.BRIDGE]:   ['#8d6e63','#795548','#a1887f'],
    [T.STALL]:    ['#a1887f','#8d6e63','#bcaaa4'],
    [T.WEAPON_RACK]:['#546e7a','#455a64','#607d8b'],
    [T.WINDOW]:   ['#81d4fa','#4fc3f7','#b3e5fc'],
    [T.DARK_FLOOR]:['#5d4037','#4e342e','#6d4c41'],
    [T.RUG]:      ['#c62828','#b71c1c','#e53935'],
    [T.CAULDRON]: ['#37474f','#263238','#455a64'],
};

// Building templates: [name, width, height, 2D array of tile IDs, doorX, doorY]
// Each building has walls on perimeter, floor inside, and furniture
const BUILDING_TEMPLATES = {
    tavern: {
        w:10, h:8, doorX:5, doorY:7,
        tiles: [
            [5,5,5,5,5,5,5,5,5,5],
            [6,7,7,7,7,7,7,7,7,6],
            [6,7,28,29,7,7,28,29,7,6],
            [6,7,28,29,7,7,28,29,7,6],
            [6,7,7,7,7,7,7,7,7,6],
            [6,33,33,33,33,7,26,26,7,6],
            [6,7,7,7,7,7,7,7,7,6],
            [6,6,6,6,6,9,6,6,6,6],
        ]
    },
    clinic: {
        w:8, h:7, doorX:4, doorY:6,
        tiles: [
            [5,5,5,5,5,5,5,5],
            [6,7,30,7,7,30,7,6],
            [6,7,30,7,7,30,7,6],
            [6,7,7,7,7,7,7,6],
            [6,7,28,7,44,7,7,6],
            [6,7,7,7,7,7,7,6],
            [6,6,6,6,9,6,6,6],
        ]
    },
    workshop: {
        w:8, h:7, doorX:4, doorY:6,
        tiles: [
            [5,5,5,5,5,5,5,5],
            [6,7,31,7,7,32,7,6],
            [6,7,7,7,7,7,27,6],
            [6,7,7,28,7,7,27,6],
            [6,7,7,7,7,7,7,6],
            [6,26,7,7,7,7,26,6],
            [6,6,6,6,9,6,6,6],
        ]
    },
    house: {
        w:6, h:5, doorX:3, doorY:4,
        tiles: [
            [5,5,5,5,5,5],
            [6,7,30,7,7,6],
            [6,7,7,7,28,6],
            [6,7,7,29,7,6],
            [6,6,6,9,6,6],
        ]
    },
    general_store: {
        w:8, h:7, doorX:4, doorY:6,
        tiles: [
            [5,5,5,5,5,5,5,5],
            [6,39,39,7,7,39,39,6],
            [6,7,7,7,7,7,7,6],
            [6,27,27,7,7,27,27,6],
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
            [6,7,28,7,7,6],
            [6,6,6,9,6,6],
        ]
    },
    chapel: {
        w:8, h:7, doorX:4, doorY:6,
        tiles: [
            [5,5,5,5,5,5,5,5],
            [6,7,7,36,36,7,7,6],
            [6,7,7,7,7,7,7,6],
            [6,7,29,7,7,29,7,6],
            [6,7,29,7,7,29,7,6],
            [6,7,7,43,43,7,7,6],
            [6,6,6,6,9,6,6,6],
        ]
    },
    library: {
        w:8, h:6, doorX:4, doorY:5,
        tiles: [
            [5,5,5,5,5,5,5,5],
            [6,34,34,7,7,34,34,6],
            [6,7,7,7,7,7,7,6],
            [6,7,28,29,28,29,7,6],
            [6,7,7,7,7,7,7,6],
            [6,6,6,6,9,6,6,6],
        ]
    },
    town_hall: {
        w:9, h:7, doorX:4, doorY:6,
        tiles: [
            [5,5,5,5,5,5,5,5,5],
            [6,7,7,7,7,7,7,7,6],
            [6,7,34,7,43,7,34,7,6],
            [6,7,7,28,28,28,7,7,6],
            [6,7,7,29,7,29,7,7,6],
            [6,7,7,7,7,7,7,7,6],
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
        const [c1, c2, c3] = colors;
        ctx.fillStyle = c1;
        ctx.fillRect(0, 0, TILE, TILE);

        switch(type) {
            case T.GRASS:
            case T.GRASS2:
            case T.GRASS3:
                // Add grass blade details
                ctx.fillStyle = c3;
                for (let i = 0; i < 4; i++) {
                    const gx = (i * 5 + 2) % TILE;
                    const gy = (i * 7 + 3) % TILE;
                    ctx.fillRect(gx, gy, 1, 2);
                }
                ctx.fillStyle = c2;
                ctx.fillRect(3, 8, 1, 2);
                ctx.fillRect(10, 4, 1, 2);
                break;

            case T.DIRT:
                ctx.fillStyle = c2; ctx.fillRect(2,3,2,1); ctx.fillRect(8,10,3,1);
                ctx.fillStyle = c3; ctx.fillRect(6,6,1,1); ctx.fillRect(12,2,2,1);
                break;

            case T.STONE_PATH:
                ctx.fillStyle = c2; ctx.fillRect(0,0,7,7); ctx.fillRect(8,8,8,8);
                ctx.fillStyle = c3; ctx.fillRect(7,0,1,TILE); ctx.fillRect(0,7,TILE,1);
                ctx.fillStyle = '#aaa'; ctx.fillRect(2,2,2,2); ctx.fillRect(10,10,2,2);
                break;

            case T.WALL_TOP:
                ctx.fillStyle = c2; ctx.fillRect(0,TILE-2,TILE,2);
                ctx.fillStyle = c3; ctx.fillRect(0,0,TILE,2);
                ctx.fillStyle = c1;
                for (let x = 0; x < TILE; x += 4) ctx.fillRect(x, 4, 3, 3);
                for (let x = 2; x < TILE; x += 4) ctx.fillRect(x, 9, 3, 3);
                break;

            case T.WALL_FRONT:
                ctx.fillStyle = c2;
                for (let x = 0; x < TILE; x += 4) { ctx.fillRect(x, 0, 3, 7); }
                for (let x = 2; x < TILE; x += 4) { ctx.fillRect(x, 8, 3, 8); }
                ctx.fillStyle = c3; ctx.fillRect(0, 7, TILE, 1);
                break;

            case T.FLOOR: case T.FLOOR2:
                ctx.fillStyle = c2; ctx.fillRect(0,0,TILE,1); ctx.fillRect(0,0,1,TILE);
                ctx.fillStyle = c3; ctx.fillRect(4,4,1,1); ctx.fillRect(12,10,1,1);
                break;

            case T.DOOR:
                ctx.fillStyle = c1; ctx.fillRect(2,0,12,TILE);
                ctx.fillStyle = c2; ctx.fillRect(4,2,8,12);
                ctx.fillStyle = c3; ctx.fillRect(10,7,2,2); // handle
                break;

            case T.WATER: case T.WATER2:
                ctx.fillStyle = c2; ctx.fillRect(0,4,TILE,4); ctx.fillRect(4,8,TILE,4);
                ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.15;
                ctx.fillRect(2,3,4,1); ctx.fillRect(8,7,5,1);
                ctx.globalAlpha = 1;
                break;

            case T.TREE_TRUNK:
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(5,4,6,12);
                ctx.fillStyle = c2; ctx.fillRect(7,4,2,12);
                break;

            case T.TREE_TOP: case T.TREE_TOP2:
                ctx.fillStyle = c1; ctx.fillRect(1,2,14,12);
                ctx.fillStyle = c2; ctx.fillRect(3,1,10,4);
                ctx.fillStyle = c3; ctx.fillRect(2,6,12,6);
                // Leafy edges
                ctx.fillStyle = c1; ctx.fillRect(0,5,2,6); ctx.fillRect(14,5,2,6);
                break;

            case T.ROOF: case T.ROOF2:
                ctx.fillStyle = c1; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c2;
                for (let x = 0; x < TILE; x += 4) ctx.fillRect(x, 2, 3, 5);
                for (let x = 2; x < TILE; x += 4) ctx.fillRect(x, 9, 3, 5);
                ctx.fillStyle = c3; ctx.fillRect(0,7,TILE,1);
                break;

            case T.FENCE_H:
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(0,5,TILE,2); ctx.fillRect(0,10,TILE,2);
                ctx.fillStyle = c2; ctx.fillRect(2,3,2,12); ctx.fillRect(12,3,2,12);
                break;

            case T.FENCE_V:
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(5,0,2,TILE); ctx.fillRect(10,0,2,TILE);
                ctx.fillStyle = c2; ctx.fillRect(3,2,12,2); ctx.fillRect(3,12,12,2);
                break;

            case T.CROP1: case T.CROP2: case T.CROP3:
                ctx.fillStyle = '#8b6e4e'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1;
                for (let x = 2; x < TILE; x += 4) { ctx.fillRect(x, 3, 2, 6); ctx.fillRect(x, 11, 2, 3); }
                ctx.fillStyle = c2;
                for (let x = 1; x < TILE; x += 4) ctx.fillRect(x, 2, 3, 2);
                break;

            case T.FLOWER1: case T.FLOWER2:
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = '#3d7a35'; ctx.fillRect(4,6,1,6); ctx.fillRect(10,8,1,5);
                ctx.fillStyle = c1; ctx.fillRect(2,3,4,4); ctx.fillRect(9,5,3,4);
                ctx.fillStyle = c3; ctx.fillRect(3,4,2,2); ctx.fillRect(10,6,1,2);
                break;

            case T.BUSH:
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(2,4,12,10);
                ctx.fillStyle = c2; ctx.fillRect(4,2,8,4);
                ctx.fillStyle = c3; ctx.fillRect(3,6,10,6);
                break;

            case T.ROCK:
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(3,5,10,9);
                ctx.fillStyle = c2; ctx.fillRect(5,3,6,4);
                ctx.fillStyle = c3; ctx.fillRect(4,8,8,4);
                break;

            case T.BARREL:
                ctx.fillStyle = c1; ctx.fillRect(3,2,10,12);
                ctx.fillStyle = c2; ctx.fillRect(4,1,8,2); ctx.fillRect(4,13,8,2);
                ctx.fillStyle = '#555'; ctx.fillRect(3,5,10,1); ctx.fillRect(3,10,10,1);
                break;

            case T.CRATE:
                ctx.fillStyle = c1; ctx.fillRect(2,2,12,12);
                ctx.fillStyle = c2; ctx.fillRect(2,2,12,2); ctx.fillRect(2,2,2,12);
                ctx.fillStyle = c3; ctx.fillRect(7,4,2,8); ctx.fillRect(4,7,8,2);
                break;

            case T.TABLE:
                ctx.fillStyle = c1; ctx.fillRect(2,3,12,10);
                ctx.fillStyle = c2; ctx.fillRect(2,3,12,2);
                ctx.fillStyle = c3; ctx.fillRect(3,5,10,1);
                break;

            case T.CHAIR:
                ctx.fillStyle = c1; ctx.fillRect(4,2,8,12);
                ctx.fillStyle = c2; ctx.fillRect(4,2,8,3);
                ctx.fillStyle = c3; ctx.fillRect(5,6,6,6);
                break;

            case T.BED:
                ctx.fillStyle = c1; ctx.fillRect(2,1,12,14);
                ctx.fillStyle = '#7986cb'; ctx.fillRect(3,4,10,10); // blanket
                ctx.fillStyle = '#fff'; ctx.fillRect(4,1,8,4); // pillow
                break;

            case T.ANVIL:
                ctx.fillStyle = c1; ctx.fillRect(3,6,10,8);
                ctx.fillStyle = c2; ctx.fillRect(2,4,12,4);
                ctx.fillStyle = c3; ctx.fillRect(5,2,6,4);
                break;

            case T.FURNACE:
                ctx.fillStyle = '#546e7a'; ctx.fillRect(2,1,12,14);
                ctx.fillStyle = c1; ctx.fillRect(4,8,8,5);
                ctx.fillStyle = c2; ctx.fillRect(5,6,6,3);
                ctx.fillStyle = '#ff9800'; ctx.fillRect(6,9,4,3);
                break;

            case T.COUNTER:
                ctx.fillStyle = c1; ctx.fillRect(0,3,TILE,10);
                ctx.fillStyle = c2; ctx.fillRect(0,3,TILE,2);
                ctx.fillStyle = c3; ctx.fillRect(1,6,14,1);
                break;

            case T.BOOKSHELF:
                ctx.fillStyle = c1; ctx.fillRect(1,0,14,TILE);
                ctx.fillStyle = '#c62828'; ctx.fillRect(3,1,3,6);
                ctx.fillStyle = '#1565c0'; ctx.fillRect(7,1,3,6);
                ctx.fillStyle = '#2e7d32'; ctx.fillRect(11,1,3,6);
                ctx.fillStyle = '#f9a825'; ctx.fillRect(2,8,4,6);
                ctx.fillStyle = '#6a1b9a'; ctx.fillRect(7,8,3,6);
                ctx.fillStyle = '#e65100'; ctx.fillRect(11,8,3,6);
                break;

            case T.WELL:
                ctx.fillStyle = '#4a8c3f'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(3,3,10,10);
                ctx.fillStyle = '#4488cc'; ctx.fillRect(5,5,6,6);
                ctx.fillStyle = c2; ctx.fillRect(3,3,10,2); ctx.fillRect(3,11,10,2);
                ctx.fillStyle = c2; ctx.fillRect(3,3,2,10); ctx.fillRect(11,3,2,10);
                break;

            case T.ALTAR:
                ctx.fillStyle = c1; ctx.fillRect(3,4,10,10);
                ctx.fillStyle = c2; ctx.fillRect(4,2,8,4);
                ctx.fillStyle = '#fff'; ctx.fillRect(6,3,4,2);
                break;

            case T.SAND:
                ctx.fillStyle = c1; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c2; ctx.fillRect(3,5,2,1); ctx.fillRect(10,9,3,1);
                break;

            case T.BRIDGE:
                ctx.fillStyle = c1; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c2; ctx.fillRect(0,0,TILE,2); ctx.fillRect(0,14,TILE,2);
                ctx.fillStyle = c3; ctx.fillRect(3,0,2,TILE); ctx.fillRect(11,0,2,TILE);
                break;

            case T.STALL:
                ctx.fillStyle = c1; ctx.fillRect(1,3,14,11);
                ctx.fillStyle = '#e65100'; ctx.fillRect(1,1,14,4);
                ctx.fillStyle = c2; ctx.fillRect(2,6,12,6);
                break;

            case T.WEAPON_RACK:
                ctx.fillStyle = c1; ctx.fillRect(2,0,12,TILE);
                ctx.fillStyle = '#b0bec5'; ctx.fillRect(4,2,2,12); ctx.fillRect(10,2,2,12);
                ctx.fillStyle = '#ffd54f'; ctx.fillRect(6,4,4,2);
                break;

            case T.WINDOW:
                ctx.fillStyle = '#6b5a3e'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(3,3,10,10);
                ctx.fillStyle = c2; ctx.fillRect(4,4,3,3); ctx.fillRect(9,4,3,3);
                ctx.fillStyle = c2; ctx.fillRect(4,9,3,3); ctx.fillRect(9,9,3,3);
                ctx.fillStyle = '#6b5a3e'; ctx.fillRect(7,3,2,10); ctx.fillRect(3,7,10,2);
                break;

            case T.DARK_FLOOR:
                ctx.fillStyle = c1; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c2; ctx.fillRect(0,0,TILE,1); ctx.fillRect(0,0,1,TILE);
                break;

            case T.RUG:
                ctx.fillStyle = '#d4b896'; ctx.fillRect(0,0,TILE,TILE);
                ctx.fillStyle = c1; ctx.fillRect(2,2,12,12);
                ctx.fillStyle = c2; ctx.fillRect(4,4,8,8);
                ctx.fillStyle = '#ffd54f'; ctx.fillRect(6,6,4,4);
                break;

            case T.CAULDRON:
                ctx.fillStyle = c1; ctx.fillRect(3,4,10,10);
                ctx.fillStyle = c2; ctx.fillRect(4,3,8,3);
                ctx.fillStyle = '#4caf50'; ctx.fillRect(5,6,6,6); // liquid
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
        const tmpl = BUILDING_TEMPLATES[templateKey] || BUILDING_TEMPLATES.house;
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
        const house = BUILDING_TEMPLATES.house;
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
        const barn = BUILDING_TEMPLATES.farm_building;
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

    // Update agent positions (smooth interpolation)
    updateAgents(agents, locations) {
        for (const [aid, agent] of Object.entries(agents)) {
            const locCenter = this.getLocationCenter(agent.current_location);
            const zone = this.buildingZones[agent.current_location] || this.natureZones[agent.current_location];
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
                this.agentPositions[aid] = { x: targetX, y: targetY, targetX, targetY, job: agent.job || 'default' };
            } else {
                this.agentPositions[aid].targetX = targetX;
                this.agentPositions[aid].targetY = targetY;
                this.agentPositions[aid].job = agent.job || 'default';
                // Interpolate
                const speed = 0.08;
                this.agentPositions[aid].x += (targetX - this.agentPositions[aid].x) * speed;
                this.agentPositions[aid].y += (targetY - this.agentPositions[aid].y) * speed;
            }
        }
        // Remove agents that no longer exist
        for (const aid of Object.keys(this.agentPositions)) {
            if (!agents[aid]) delete this.agentPositions[aid];
        }
    }

    // Draw agent sprite
    _drawAgent(ctx, x, y, jobKey, isPlayer, isSelected, name) {
        const colors = JOB_COLORS[jobKey] || JOB_COLORS.default;
        if (isPlayer) {
            colors.body = JOB_COLORS.player.body;
            colors.hair = JOB_COLORS.player.hair;
        }
        const sx = Math.floor(x - 5);
        const sy = Math.floor(y - 12);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(sx, sy + 13, 10, 3);

        // Body
        ctx.fillStyle = colors.body;
        ctx.fillRect(sx + 1, sy + 5, 8, 8);
        // Body highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(sx + 2, sy + 5, 3, 8);

        // Head
        ctx.fillStyle = '#ffd5b4';
        ctx.fillRect(sx + 2, sy, 6, 5);
        // Hair
        ctx.fillStyle = colors.hair;
        ctx.fillRect(sx + 2, sy, 6, 2);
        ctx.fillRect(sx + 1, sy, 1, 3);
        ctx.fillRect(sx + 8, sy, 1, 3);

        // Eyes
        ctx.fillStyle = '#333';
        ctx.fillRect(sx + 3, sy + 2, 1, 1);
        ctx.fillRect(sx + 6, sy + 2, 1, 1);

        // Legs
        ctx.fillStyle = '#555';
        ctx.fillRect(sx + 2, sy + 13, 3, 2);
        ctx.fillRect(sx + 5, sy + 13, 3, 2);

        // Selection indicator
        if (isSelected) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx - 2, sy - 3, 14, 20);
        }
        if (isPlayer) {
            // Arrow above player
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(sx + 3, sy - 5, 4, 2);
            ctx.fillRect(sx + 4, sy - 7, 2, 2);
        }

        // Name label
        if (isSelected || isPlayer) {
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            const nameShort = name.split('(')[0].trim();
            const tw = ctx.measureText(nameShort).width;
            ctx.fillRect(sx + 5 - tw/2 - 2, sy - 14, tw + 4, 10);
            ctx.fillStyle = '#fff';
            ctx.fillText(nameShort, sx + 5, sy - 6);
        }
    }

    // Main render
    render(agents, selectedAgent, playerLoc) {
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
            this._drawAgent(ctx, pos.x, pos.y, pos.job, isPlayer, isSelected, agent.name || 'You');
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
    }
}

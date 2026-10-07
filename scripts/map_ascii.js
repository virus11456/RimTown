#!/usr/bin/env node
// v5.81.0 地圖版面回歸守門:用 Node 跑 tilemap.js(stub 掉 canvas),把五種主題的 80×60 版面印成 ASCII,
// 與 scripts/map_snapshots/<theme>.txt 比對。改到 tilemap 產圖邏輯時必跑:
//   node scripts/map_ascii.js            # 比對全部主題,任一不同就 exit 1 並印 diff 行
//   node scripts/map_ascii.js --update   # 重新產生快照(確定版面改動是故意的才跑)
//   node scripts/map_ascii.js harbor     # 只印某主題的 ASCII
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'chrome-extension/tilemap.js'), 'utf8');
const noop = () => {};
const ctxStub = new Proxy({}, { get: (o, k) => (k === 'measureText' ? () => ({ width: 0 }) : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : noop), set: () => true });
const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctxStub, toDataURL: () => '', addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: { clientWidth: 800, clientHeight: 600 } });
const sandbox = { console, Math, ResizeObserver: function () { this.observe = noop; this.disconnect = noop; }, setTimeout, clearTimeout, document: { createElement: mkCanvas, addEventListener: noop, getElementById: () => null, querySelector: () => null }, window: { devicePixelRatio: 1, addEventListener: noop, innerWidth: 800, innerHeight: 600 }, navigator: {}, t: s => s, I18N: { t: s => s, localizeNames: s => s, getLang: () => 'zh' }, localStorage: { getItem: () => null, setItem: noop }, requestAnimationFrame: noop, Image: function () {}, performance: { now: () => 0 }, FACTORIES: { bakery: 1, textile_mill: 1, brewery: 1, herbal_workshop: 1 } };
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.PixelTileMap = PixelTileMap; this.T = T;', sandbox);
const { PixelTileMap, T } = sandbox;
const ALL = ['town_square','tavern','town_hall','farm','quarry','workshop','general_store','clinic','library','guardpost','chapel','park','well','residential_north','residential_south','residential_east','forest','river','hill','cave','lake','meadow'];
// 每主題用「全部地點」產圖(實際遊戲依地形抽 2–4 個自然地點,快照用全集最嚴格)
const THEMES = { frontier: ALL, harbor: ALL.filter(x => x !== 'forest'), mountain: ALL.filter(x => x !== 'lake'), forest: ALL.filter(x => x !== 'meadow'), market: ALL.filter(x => x !== 'cave') };
const inv = {}; for (const [k, v] of Object.entries(T)) inv[v] = k;
const CH = { GRASS: '.', GRASS2: '.', GRASS3: '.', DIRT: '=', STONE_PATH: ':', WALL_TOP: '#', WALL_FRONT: '#', FLOOR: 'f', FLOOR2: 'f', DOOR: 'D', WATER: '~', WATER2: '≈', TREE_TRUNK: 'T', TREE_TOP: 'T', TREE_TOP2: 'T', ROOF: '^', ROOF2: '^', FENCE_H: '-', FENCE_V: '|', CROP1: 'c', CROP2: 'c', CROP3: 'c', FLOWER1: '*', FLOWER2: '*', BUSH: 'b', ROCK: 'R', BARREL: 'o', CRATE: 'o', TABLE: 'f', CHAIR: 'f', BED: 'f', ANVIL: 'f', FURNACE: 'F', COUNTER: 'f', BOOKSHELF: 'f', WELL: 'W', ALTAR: 'A', SAND: ',', BRIDGE: 'B', STALL: 's', WEAPON_RACK: 'f', WINDOW: '#', DARK_FLOOR: 'X', RUG: 'f', CAULDRON: 'f', PIER: 'P', SALT: 'S', NET: 'N', GRAVEL: '=', CHASM: '▒', RAIL: 'H', SNOW: '^' };
function render(theme, withHousing) {
  const locations = {}; for (const id of THEMES[theme]) locations[id] = { id, name: id };
  const tm = new PixelTileMap(mkCanvas());
  tm.generateLayout(locations, theme);
  if (withHousing) tm.ensureHouseCapacity(withHousing);
  let out = '';
  for (let y = 0; y < tm.rows; y++) out += tm.grid[y].map(v => CH[inv[v]] || '?').join('') + '\n';
  out += `zones=${Object.keys(tm.buildingZones).length} nature=${Object.keys(tm.natureZones).join(',')} coach=${JSON.stringify(tm.coachStation)} houses=${Object.keys(tm._houseSubZones).length}\n`;
  return out;
}
const args = process.argv.slice(2);
const snapDir = path.join(__dirname, 'map_snapshots');
if (args[0] && THEMES[args[0]]) { process.stdout.write(render(args[0], parseInt(args[1] || '0', 10) || 0)); process.exit(0); }
if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir);
let bad = 0;
for (const theme of Object.keys(THEMES)) {
  const cur = render(theme, 0);
  const file = path.join(snapDir, theme + '.txt');
  if (args.includes('--update') || !fs.existsSync(file)) { fs.writeFileSync(file, cur); console.log(`${theme}: snapshot written`); continue; }
  const prev = fs.readFileSync(file, 'utf8');
  if (prev === cur) { console.log(`${theme}: OK`); continue; }
  bad++;
  const a = prev.split('\n'), b = cur.split('\n');
  const diffs = []; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diffs.push(i);
  console.log(`${theme}: CHANGED (${diffs.length} rows: ${diffs.slice(0, 8).join(',')}${diffs.length > 8 ? '…' : ''}) — 若是故意改版面,跑 node scripts/map_ascii.js --update`);
}
process.exit(bad ? 1 : 0);

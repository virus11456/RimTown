import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {context,root,json} from './golden.mjs';
const {ctx}=context();
const source=fs.readFileSync(path.join(root,'chrome-extension/tilemap.js'),'utf8');
const fixed=source.match(/const FIXED_POSITIONS = (\{[\s\S]*?\n        \});/)[1];
vm.runInContext(`var FIXED=${fixed}; var rules={};
function fresh(){const tm=Object.create(PixelTileMap.prototype);Object.assign(tm,{cols:80,rows:60,buildingZones:{},natureZones:{},labelPositions:{},_houseSubZones:{},_agentHouseMap:{},agentPositions:{},playerInput:{x:0,y:0},_viewW:0});return tm;}
var base=fresh();base.generateLayout({});
for(let i=0;i<30;i++){const x=3+(i*17+7)%74,y=4+(i*13+11)%52;if([22,23,24,25].includes(base.grid[y][x])){const n=(x*7+y*13+x*y*3)%10,r=(x*7+y*13+x*y)%17;base.grid[y][x]=r<5?1:r<8?2:n<5?0:n<8?1:2;}}
for(const [id,fp] of Object.entries(FIXED)){
 const tm=fresh(),ops=[];tm.grid=Array.from({length:60},(_,y)=>new Proxy(Array(80).fill(0),{set(row,x,v){ops.push(['set',Number(x),y,v,v===3]);row[x]=v;return true;}}));
 tm._connectToRoad=(x,y)=>ops.push(['road',x,y]);
 const methods={building:'_placeBuilding',house_cluster:'_placeHouseCluster',farm:'_placeFarm',mine:'_placeMine',square:'_placeSquare',well:'_placeWell',forest:'_placeForest',river:'_placeRiver',hill:'_placeHill',cave:'_placeCave',lake:'_placeLake',meadow:'_placeMeadow',nature:'_placeNatureArea'};
 tm[methods[fp.type]](id,Math.min(fp.x,68),Math.min(fp.y,50),id);
 rules[id]={ops,buildings:tm.buildingZones,nature:tm.natureZones,houses:tm._houseSubZones,labels:tm.labelPositions};
}
var output={base:base.grid,rules,house:TILE_BUILDING_TEMPLATES.house,coachStation:base.coachStation};`,ctx);
fs.writeFileSync(path.join(root,'godot/assets/data/layout_rules.json'),json(vm.runInContext('output',ctx)));
const inputs=[];
for(const theme of ['frontier','harbor'])for(const day of [1,7,30])inputs.push({name:`${theme}-${day}`,data:JSON.parse(fs.readFileSync(path.join(root,`godot/tests/golden/${theme}-day-${String(day).padStart(2,'0')}.json`)))});
for(let seed=1;seed<=12;seed++){
 const data=vm.runInContext(`var w=new World();w.townTheme=${JSON.stringify(seed%2?'frontier':'harbor')};w.reset(${seed});w.serialize();`,ctx);
 if(seed%3===0){data.decorations=[{type:'lamp',x:52,y:6}];data.buildings.completed.push({buildingKey:'watchtower',siteX:56,siteY:6});data.buildings.projects.push({buildingKey:'garden',siteX:54,siteY:4});}
 inputs.push({name:`seed-${seed}`,data});
}
for(const {name,data} of inputs){
 ctx.input=data;
 const out=vm.runInContext(`var w=new World();w.loadSave(input);var tm=fresh();tm.generateLayout(w.townMap.locations);tm.decorations=w.decorations;tm.constructionSites=w.buildings.projects.filter(p=>Number.isFinite(p.siteX));tm.sitedCompleted=w.buildings.completed.filter(p=>Number.isFinite(p.siteX));RimTownApp.prototype._syncHousing.call({world:w,tileMap:tm});tm.updateAgents(w.getState().agents,w.townMap.locations,null);({grid:tm.grid,buildings:tm.buildingZones,houses:tm._houseSubZones,factories:tm._getFactoryPlots(),agentHouse:tm._agentHouseMap,agents:Object.fromEntries(Object.entries(tm.agentPositions).map(([id,p])=>[id,{x:p.x,y:p.y}]))});`,ctx);
 fs.writeFileSync(path.join(root,`godot/tests/layout/${name}.json`),json({input:data,expected:out}));
}
console.log('Layout rules',Object.keys(vm.runInContext('rules',ctx)).length,'oracle cases',inputs.length);

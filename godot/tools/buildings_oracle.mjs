import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];const source=context();const keys=vm.runInContext('Object.keys(BUILDING_TEMPLATES)',source.ctx);
for(const key of keys)for(const stage of [1,2,3]){
 const c=context();Object.assign(c.ctx,{raw:JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'))),key,stage});
 vm.runInContext('var w=new World();w.loadSave(raw);w.checkCombos=()=>{};w.conversationEngine.sendEventComment=()=>{};for(const k of Object.keys(w.stockpile.resources))w.stockpile.resources[k]=10000;for(const a of Object.values(w.agents))a.moodModifier=0;for(let level=1;level<stage;level++){if(level===1)w.buildings.startProject(key,w);else w.buildings.startUpgrade(key,w);while(w.buildings.projects.length)w.buildings.dailyConstruction(w)}',c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));const moods=JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries(Object.entries(w.agents).map(([id,a])=>[id,a.moodModifier])))',c.ctx));
 vm.runInContext('if(stage===1)w.buildings.startProject(key,w);else w.buildings.startUpgrade(key,w);for(let i=0;i<20;i++)w.buildings.dailyConstruction(w)',c.ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));cases.push({input,moods,key,stage,buildings:out.buildings,stock:out.stockpile,news:out.dailyNews,logs:out.messageLog,afterMoods:JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries(Object.entries(w.agents).map(([id,a])=>[id,a.moodModifier])))',c.ctx))});
}
fs.mkdirSync(path.join(root,'godot/tests/buildings'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/buildings/oracle.json'),json(cases));console.log(cases.length,'building cases');

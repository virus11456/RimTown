import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root} from './golden.mjs';
const cases=[];
for(const representation of ['decorations','mixed'])for(let index=0;index<8;index++)for(const distance of [0,4,5]){
 const c=context();Object.assign(c.ctx,{raw:JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'))),index,distance,representation});
 vm.runInContext(`var w=new World();w.loadSave(raw);w.conversationEngine.sendEventComment=()=>{};w.decorations=COMBO_DEFS[index].parts.map((type,i)=>({type,x:20+(i?distance:0),y:20+(i===2?-distance:0)}));w.combosFound=[];if(representation==='mixed'){w.buildings.completed=w.decorations.filter(d=>BUILDING_TEMPLATES[d.type]).map(d=>({buildingKey:d.type,siteX:d.x-1,siteY:d.y-1}));w.decorations=w.decorations.filter(d=>!BUILDING_TEMPLATES[d.type]);}`,c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));
 vm.runInContext('var active=w.getActiveCombos();w.checkCombos();w.checkCombos();var parts=w.decorations;w.decorations=[];w.checkCombos();w.decorations=parts;w.checkCombos()',c.ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));cases.push({input,active:JSON.parse(vm.runInContext('JSON.stringify(active)',c.ctx)),found:out.combosFound,logs:out.messageLog,news:out.dailyNews,moods:JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries(Object.entries(w.agents).map(([id,a])=>[id,a.moodModifier||0])))',c.ctx))});
}
fs.mkdirSync(path.join(root,'godot/tests/combos'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/combos/oracle.json'),JSON.stringify(cases));console.log(cases.length,'combo cases');

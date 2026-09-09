import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const bonus of [0,.3])for(const points of [0,200,1000]){
 const {ctx}=context();Object.assign(ctx,{raw:JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'))),bonus,points});
 vm.runInContext('var w=new World();w.loadSave(raw);w.news.activeModifiers.research_bonus=bonus;w.stockpile.resources.research_points=points;for(const a of Object.values(w.agents))a.moodModifier=0;',ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
 vm.runInContext('for(let i=0;i<120;i++){if(i===2)w.research.startResearch("commerce");w.research.dailyUpdate(w)}',ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));cases.push({input,research:out.research,stock:out.stockpile,buildings:out.buildings,logs:out.messageLog,moods:JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries(Object.entries(w.agents).map(([id,a])=>[id,a.moodModifier])))',ctx))});
}
fs.mkdirSync(path.join(root,'godot/tests/research'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/research/oracle.json'),json(cases));console.log(cases.length,'research cases');

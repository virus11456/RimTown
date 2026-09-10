import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root} from './golden.mjs';
const raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));const cases=[];
for(let stage=0;stage<8;stage++){
 const c=context();Object.assign(c.ctx,{raw,stage});vm.runInContext(`var w=new World();w.loadSave(raw);w.prosperity._townAgeDays=stage;w.prosperity._lastUpdateDay=-1;for(const k in w.stockpile.resources)w.stockpile.resources[k]=stage*100;w.questSystem.tradeCount=stage;w.questSystem.electionsHeld=stage;w.questSystem.raidsSurvived=stage;w.decorations=Array.from({length:stage},(_,i)=>({type:'fountain',x:10+i,y:10}));`,c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));c.setRandomState(11456);vm.runInContext('w.prosperity.dailyUpdate(w);w.council._formCouncil(w);w.council._daysSinceCouncilCheck=0',c.ctx);
 cases.push({input,prosperity:JSON.parse(vm.runInContext('JSON.stringify(w.prosperity.serialize())',c.ctx)),members:JSON.parse(vm.runInContext('JSON.stringify(w.council.members)',c.ctx)),rng:c.getRandomState()});
}
fs.writeFileSync(path.join(root,'godot/tests/quests/world-oracle.json'),JSON.stringify(cases));

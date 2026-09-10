import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root} from './golden.mjs';
const raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));const cases=[];
for(const seed of [1,42,11456,123456,987654])for(const player of [false,true]){
 const c=context();Object.assign(c.ctx,{raw,player});vm.runInContext(`var w=new World();w.loadSave(raw);var a=w.agents[player?'player':'chen_wei'];var b=w.agents.lin_mei;for(const n of Object.values(w.agents))n.moodModifier=0;`,c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));c.setRandomState(seed);vm.runInContext('w.lifecycle._birthChild(w,a,b,player)',c.ctx);
 const expected=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));cases.push({seed,player,input,expected,moods:JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries(Object.entries(w.agents).map(([id,a])=>[id,a.moodModifier||0])))',c.ctx)),rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/births'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/births/oracle.json'),JSON.stringify(cases));

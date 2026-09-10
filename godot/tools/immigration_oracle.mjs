import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root} from './golden.mjs';
const raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));const cases=[];
for(const seed of [1,42,11456,123456,987654]){
 const c=context();c.ctx.raw=raw;vm.runInContext('var w=new World();w.loadSave(raw);w.townIdentity.routeAxis=()=>null;w.reputationSystem.getModifier=()=>0;for(let i=IMMIGRANT_POOL.length-1;i>=0;i--)if(Object.values(w.agents).some(a=>a.name===IMMIGRANT_POOL[i].name))IMMIGRANT_POOL.splice(i,1);',c.ctx);const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));c.setRandomState(seed);vm.runInContext('w.events._spawnImmigrant(w)',c.ctx);const expected=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));cases.push({seed,input,expected,rng:c.getRandomState()});
}
fs.writeFileSync(path.join(root,'godot/tests/births/immigration.json'),JSON.stringify(cases));

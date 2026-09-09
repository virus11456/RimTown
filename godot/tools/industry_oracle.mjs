import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const scenario of ['baseline','empty_workers','town_promotion','unavailable_workers'])for(let mask=1;mask<16;mask++)for(const level of [1,2,3,4,5]){
 const c=context();Object.assign(c.ctx,{raw:JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'))),mask,level,scenario});
 vm.runInContext('var w=new World();w.loadSave(raw);w.industry.maxIndustries=4;for(const k in w.stockpile.resources)w.stockpile.resources[k]=10000;var keys=Object.keys(INDUSTRIES).filter((k,i)=>mask&(1<<i));',c.ctx);
 vm.runInContext("if(scenario==='empty_workers')w.agents={};if(scenario==='unavailable_workers')for(const a of Object.values(w.agents))a.status='sick';if(scenario==='town_promotion'){w.buildings.completed=Array.from({length:8},(_,i)=>({id:'fixture'+i}));}",c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));
 if(scenario==='unavailable_workers')for(const a of Object.values(input.agents))a.status='sick';
 vm.runInContext('for(const k of keys){w.industry.chooseIndustry(k,w);for(let i=1;i<level;i++)w.industry.upgradeIndustry(k,w)}w.industry.dailyUpdate(w)',c.ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));cases.push({input,keys:JSON.parse(vm.runInContext('JSON.stringify(keys)',c.ctx)),level,industry:out.industry,stock:out.stockpile,logs:out.messageLog,news:out.dailyNews});
}
fs.mkdirSync(path.join(root,'godot/tests/industry'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/industry/oracle.json'),json(cases));console.log(cases.length,'industry cases');

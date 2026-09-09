import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(let seed=1;seed<=24;seed++)for(const kind of ['empty','friend','family','duplicate','annual','visited','queue','cap']){
 const c=context();const {ctx}=c;ctx.kind=kind;ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext(`var w=new World();w.loadSave(raw);var a=w.agents.chen_wei;w.agents={chen_wei:a};w.messageLog=[];a.memory=new Memory();a.moodModifier=0;a._mourningTargets=[];a._annualMourning=[];a.needs.social=kind==='cap'?99.8:30;
 if(['friend','family','duplicate','queue','cap'].includes(kind))a._mourningTargets=[{name:'故人',isFamily:kind!=='friend',deathTick:12,custom:'保留'}];
 if(kind==='queue')a._mourningTargets.push({name:'舊友',isFamily:false},{name:'親人',isFamily:true});
 if(['annual','duplicate','visited'].includes(kind))a._annualMourning=[{name:'故人',lastVisitYear:kind==='visited'?w.clock.year:0,custom:'保留'},{name:'先人',lastVisitYear:0}];
 `,ctx);
 const full=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
 const input=Object.fromEntries(['clock','tickCount','agents','events','messageLog'].map(k=>[k,full[k]]));
 c.setRandomState(seed*11456);const steps=[];
 for(let phase=0;phase<2;phase++){
  if(phase)vm.runInContext('w.clock.year++',ctx);
  vm.runInContext('for(let i=0;i<32;i++)a._doMourning(w)',ctx);
  const after=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
  steps.push({year:after.clock.year,agents:after.agents,messageLog:after.messageLog,mood:vm.runInContext('a.moodModifier',ctx),rng:c.getRandomState()});
 }
 cases.push({kind,seed:seed*11456,input,steps});
}
fs.mkdirSync(path.join(root,'godot/tests/mourning'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/mourning/oracle.json'),json(cases));console.log(cases.length,'mourning scenarios');

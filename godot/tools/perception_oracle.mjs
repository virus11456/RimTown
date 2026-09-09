import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const kind of ['awake','sleeping','alone','remote','target_sleep','player','dead','plan','no_step','multiple'])for(let seed=1;seed<=8;seed++){
 const c=context();const {ctx}=c;ctx.kind=kind;ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext(`var w=new World();w.loadSave(raw);var a=w.agents.chen_wei,b=w.agents.lin_mei,d=w.agents.zhang_hao;w.agents={chen_wei:a,...(kind==='alone'?{}:{lin_mei:b}),...(kind==='multiple'?{zhang_hao:d}:{})};for(const x of Object.values(w.agents)){x.activity='working';x.currentLocation='town_square';x.memory=new Memory();x.dailyPlan=null;}
 if(kind==='sleeping')a.activity='sleeping';if(kind==='remote')b.currentLocation='park';if(kind==='target_sleep')b.activity='sleeping';if(kind==='player')b.isPlayer=true;if(kind==='dead')b.isDead=true;
 if(kind==='plan'||kind==='no_step')b.dailyPlan={key:"test",goals:[],blocks:[{time:'00:00',text:'工作計畫',steps:kind==='plan'?['整理工具']:[]}]};`,ctx);
 const full=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));const input=Object.fromEntries(['clock','tickCount','agents','events','messageLog'].map(k=>[k,full[k]]));if(kind==='dead')input.agents.lin_mei.isDead=true;
 c.setRandomState(seed*11456);const steps=[];
 for(let phase=0;phase<3;phase++){
  if(phase===2)vm.runInContext('w.clock.day++',ctx);
  vm.runInContext('for(let i=0;i<400;i++){w.tickCount++;a._perceiveSurroundings(w);}',ctx);
  steps.push(JSON.parse(vm.runInContext('JSON.stringify({memory:a.memory.entries,day:a._obsDay||"",count:a._obsCount||0})',ctx)));steps.at(-1).rng=c.getRandomState();
 }
 cases.push({kind,seed:seed*11456,input,steps});
}
fs.mkdirSync(path.join(root,'godot/tests/perception'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/perception/oracle.json'),json(cases));console.log(cases.length,'perception scenarios');

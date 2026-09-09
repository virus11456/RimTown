import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];let severances=0,argumentsCount=0,observations=0;
for(let seed=1;seed<=16;seed++)for(const kind of ['severance','argument','threshold','one_sided','missing_back','dead','player','cooldown4','cooldown5','cooldown_zero','already_feud','year_rollover']){
 const c=context();const {ctx}=c;ctx.kind=kind;ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext(`var w=new World();w.loadSave(raw);var people=Object.values(w.agents).filter(a=>!a.isPlayer).slice(0,5);var p=w.agents.player;w.agents={};people.forEach((a,i)=>{a.agentId=['a','b','c','d','e'][i];w.agents[a.agentId]=a;});w.agents.player=p;var [a,b,c,d,e]=people;
 for(const a of Object.values(w.agents)){a.relationships=new RelationshipManager();a.memory=new Memory();a.moodModifier=0;}w.messageLog=[];w._feudCooldown={};w.dailyNews.collectEvent=()=>{};w.queueDramaScene=()=>{};w.tickCount=1000;w.clock.day=10;w.clock.hour=0;w.clock.minute=0;
 function link(x,y,aff){const r=x.relationships.getOrCreate(y.agentId,y.name);r.affinity=aff;return r;}var ra=link(a,b,kind==='severance'||kind==='already_feud'?-60:-35);var rb=link(b,a,ra.affinity);link(c,a,40);link(d,b,40);link(e,a,10);link(p,a,70);
 if(kind==='threshold')ra.affinity=-34.99;if(kind==='one_sided')rb.affinity=0;if(kind==='missing_back')b.relationships=new RelationshipManager();if(kind==='dead')b.isDead=true;if(kind==='player')b.isPlayer=true;
 if(kind==='cooldown4')w._feudCooldown['a|b']=7;if(kind==='cooldown5')w._feudCooldown['a|b']=6;if(kind==='cooldown_zero')w._feudCooldown['a|b']=0;if(kind==='already_feud'){ra.isFeud=rb.isFeud=true;w._feudCooldown['a|b']=10;}if(kind==='year_rollover'){w.clock.season='冬季';w.clock.day=14;w._feudCooldown['a|b']=14;}
 `,ctx);
 const full=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
 const input=Object.fromEntries(['version','clock','tickCount','agents','messageLog','feudCooldown'].map(k=>[k,full[k]]));
 input.agents=Object.fromEntries(Object.entries(input.agents).map(([id,a])=>[id,Object.fromEntries(['id','name','isPlayer','isDead','relationships','memory'].filter(k=>k in a).map(k=>[k,a[k]]))]));
 if(kind==='dead')input.agents.b.isDead=true; // Runtime-only in upstream World.serialize.
 c.setRandomState(seed*11456);const checkpoints=[];
 for(let day=1;day<=21;day++){
  vm.runInContext('for(let i=0;i<96;i++){w.tickCount++;w.clock.tick();}w._processFeuds();',ctx);
  if(![1,5,6,16,21].includes(day))continue;
  const save=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
  const agents=Object.fromEntries(Object.entries(save.agents).map(([id,a])=>[id,{relationships:a.relationships,memory:a.memory,moodModifier:vm.runInContext(`w.agents[${JSON.stringify(id)}].moodModifier||0`,ctx)}]));
  checkpoints.push({day,agents,clock:save.clock,feudCooldown:save.feudCooldown,messageLog:save.messageLog,rng:c.getRandomState()});
 }
 const end=checkpoints.at(-1);severances+=end.messageLog.filter(e=>e.content.startsWith('💢')).length;argumentsCount+=end.messageLog.filter(e=>e.content.startsWith('🗯️')).length;observations+=Object.values(end.agents).flatMap(a=>a.memory).filter(m=>m.category==='observation').length;
 cases.push({kind,seed:seed*11456,input,checkpoints});
}
fs.mkdirSync(path.join(root,'godot/tests/feuds'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/feuds/oracle.json'),json(cases));
const coverage={scenarios:cases.length,severances,arguments:argumentsCount,observations,scope:'World._processFeuds; excludes daily news and AI scenes; includes seasonal/year rollover with original cooldown formula'};fs.writeFileSync(path.join(root,'godot/docs/FEUDS_ORACLE_COVERAGE.json'),json(coverage));console.log(coverage);

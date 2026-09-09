import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const kind of ['active','null_thoughts','expires','stacked','missing_relation','missing_person','zero','no_target','player','dead','future_start','upper_limit','lower_limit','season','year']){
 const c=context();const {ctx}=c;ctx.kind=kind;ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext(`var w=new World();w.loadSave(raw);var ids=Object.keys(w.agents).filter(k=>k!=='player').slice(0,2);w.agents=Object.fromEntries([...ids,'player'].map(id=>[id,w.agents[id]]));var a=w.agents[ids[0]],b=w.agents[ids[1]];for(const a of Object.values(w.agents)){a.relationships=new RelationshipManager();a.thoughts=[];}
 w.clock.day=kind==='season'||kind==='year'?15:1;w.clock.hour=0;w.clock.minute=0;if(kind==='year')w.clock.season='冬季';
 var rel=a.relationships.getOrCreate(b.agentId,b.name);rel.affinity=kind==='upper_limit'?99:kind==='lower_limit'?-99:10;
 a.thoughts=[{kind:'test',label:'難忘的事',mood:-8,opinion:kind==='upper_limit'?4:-2,targetId:b.agentId,targetName:b.name,start:w.clock.totalDays,days:kind==='expires'?1:4,future:{keep:true}}];
 if(kind==='null_thoughts')a.thoughts=null;
 if(kind==='stacked')a.thoughts.push({...a.thoughts[0],kind:'other',opinion:5,days:2});if(kind==='zero')a.thoughts[0].opinion=0;if(kind==='no_target')a.thoughts[0].targetId=null;if(kind==='missing_relation')a.relationships=new RelationshipManager();if(kind==='missing_person')delete w.agents[b.agentId];if(kind==='player')a.isPlayer=true;if(kind==='dead')a.isDead=true;if(kind==='future_start')a.thoughts[0].start+=2;`,ctx);
 const full=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));const input=Object.fromEntries(['clock','tickCount','agents'].map(k=>[k,full[k]]));
 input.agents=Object.fromEntries(Object.entries(input.agents).map(([id,a])=>[id,Object.fromEntries(['id','isPlayer','thoughts','relationships'].map(k=>[k,a[k]]))]));
 const aid=vm.runInContext('a.agentId',ctx);if(kind==='dead')input.agents[aid].isDead=true;
 const checkpoints=[];
 for(let day=1;day<=7;day++){
  vm.runInContext('for(let i=0;i<96;i++){w.tickCount++;w.clock.tick();}w._processThoughts();',ctx);
  const save=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));checkpoints.push({day,clock:save.clock,agents:Object.fromEntries(Object.entries(save.agents).map(([id,a])=>[id,{thoughts:a.thoughts,relationships:a.relationships}]))});
 }
 cases.push({kind,input,checkpoints});
}
fs.mkdirSync(path.join(root,'godot/tests/thoughts'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/thoughts/oracle.json'),json(cases));console.log(cases.length,'thought lifecycle scenarios');

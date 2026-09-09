import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];const coverage={};
for(let seed=1;seed<=32;seed++)for(const kind of ['daily','events','cleanup']){
 const c=context();const {ctx}=c;ctx.kind=kind;ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext(`var w=new World();w.loadSave(raw);w.messageLog=[];w.events.conversationTopics=[];w.gossipNetwork.activeGossip=[];w.factions=new FactionSystem();for(const a of Object.values(w.agents)){a.memory=new Memory();a.relationships=new RelationshipManager();a.moodModifier=0;}
 var ids=Object.keys(w.agents).filter(id=>id!=='player');
 if(kind!=='daily'){
 for(let i=0;i<3;i++){const f=new Faction('faction_'+(i+1),['work_buddies','scholars','night_owls'][i],'測試');f.members=ids.slice(i*3,i*3+3);w.factions.factions[f.id]=f;}w.factions._counter=3;
 const fs=Object.values(w.factions.factions);fs[0].rivalFactionId=fs[1].id;fs[1].rivalFactionId=fs[0].id;
 if(kind==='cleanup'){fs[2].type=fs[0].type;fs[2].members.push(fs[0].members[0]);fs[1].members=['missing',ids[0]];for(const a of Object.values(w.agents))for(const b of Object.values(w.agents))if(a!==b)a.relationships.getOrCreate(b.agentId,b.name).affinity=-70;}
 }`,ctx);
 const full=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
 const input=Object.fromEntries(['version','clock','tickCount','agents','messageLog','factions','events','gossip'].map(k=>[k,full[k]]));
 input.agents=Object.fromEntries(Object.entries(input.agents).map(([id,a])=>[id,Object.fromEntries(['id','name','age','jobKey','isPlayer','personality','relationships','memory'].map(k=>[k,a[k]]))]));
 c.setRandomState(seed*11456);
 vm.runInContext(`for(let i=0;i<30;i++){w.tickCount+=96;for(let j=0;j<96;j++)w.clock.tick();if(kind==='events')w.factions._tryFactionEvents(w);else w.factions.dailyUpdate(w);}`,ctx);
 const save=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));const agents=Object.fromEntries(Object.entries(save.agents).map(([id,a])=>[id,{relationships:a.relationships,memory:a.memory,moodModifier:vm.runInContext(`w.agents[${JSON.stringify(id)}].moodModifier||0`,ctx)}]));
 for(const log of save.messageLog){const key=log.content.includes('組成了')?'formation':log.content.includes('退出了')?'leave':log.content.includes('解散')?'dissolve':log.content.includes('內')||log.content.includes('聚會')?'internal':log.content.includes('攜手')||log.content.includes('共識')||log.content.includes('活動')?'cooperation':'conflict';coverage[key]=(coverage[key]||0)+1;}
 cases.push({kind,seed:seed*11456,input,expected:{agents,factions:save.factions,events:save.events,gossip:save.gossip,messageLog:save.messageLog},rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/factions'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/factions/oracle.json'),json(cases));fs.writeFileSync(path.join(root,'godot/docs/FACTIONS_ORACLE_COVERAGE.json'),json({scenarios:cases.length,coverage}));console.log(cases.length,coverage);

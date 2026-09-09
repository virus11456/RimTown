import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const out=path.join(root,'godot/tests/gossip');fs.mkdirSync(out,{recursive:true});const cases=[];
for(let seed=1;seed<=8;seed++)for(const kind of ['npc','praise','diss','ship','missing','self','subject_player','blocked_ship','create','rel_crush','rel_jealous','rel_newCouple','rel_rivalry']){
 const c=context();const {ctx}=c;
 ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext(`var w=new World();w.loadSave(raw);var ids=Object.keys(w.agents).filter(k=>k!=='player').slice(0,3);w.agents=Object.fromEntries([...ids,'player'].map(k=>[k,w.agents[k]]));var a=w.agents[ids[0]],b=w.agents[ids[1]],d=w.agents[ids[2]],p=w.agents.player;
 for(const person of [a,b,d,p]){person.relationships=new RelationshipManager();person.memory=new Memory();person.thoughts=[];}a.personality.traits=['gossip'];d.personality.traits=['gossip'];w.messageLog=[];w.gossipNetwork.activeGossip=[];w.townFeed=new TownFeedSystem();w.dailyNews.collectEvent=()=>{};w.tickCount=100;`,ctx);
 ctx.kind=kind;ctx.seed=seed;
 vm.runInContext(`if(seed%2===0)a.personality.traits=['kind'];if(kind==='blocked_ship')b.relationships.getOrCreate(a.agentId,a.name).status='dating';
 if(kind==='create'){const rel=a.relationships.getOrCreate(b.agentId,b.name);rel.affinity=-20;rel.romanticInterest=60;const r=b.relationships.getOrCreate(d.agentId,d.name);r.status='married';r.romanticInterest=50;r.isCheating=true;b.mood=seed%2?80:-50;}
 if(!['praise','diss','ship','blocked_ship','create'].includes(kind)&&!kind.startsWith('rel_'))w.gossipNetwork.activeGossip=[{about:kind==='subject_player'?p.name:b.name,source:kind==='missing'?'不在鎮上的人':kind==='self'?b.name:a.name,content:'最近行為很奇怪。',isTrue:false,spreadCount:0,tickCreated:0,juicy:true,future:{unknown:7}}];`,ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));const ids=vm.runInContext('({a:a.agentId,b:b.agentId,d:d.agentId,p:p.agentId})',ctx);
 c.setRandomState(seed*11456);
 vm.runInContext(`if(['praise','diss','ship','blocked_ship'].includes(kind))w.gossipNetwork.playerSeedGossip(w,p,d,b,kind==='blocked_ship'?'ship':kind,d.name);
 if(kind==='create')w.gossipNetwork.createGossip(a,b,w);
 if(kind.startsWith('rel_'))w.gossipNetwork.createRelGossip(w,kind.slice(4),a,b,'小花');
 // Ineligible listener, then repeated eligible listeners cover one-time mutation/confrontation.
 w.gossipNetwork.spreadGossip(a,b,w);
 for(let i=0;i<16;i++){w.tickCount++;w.gossipNetwork.spreadGossip(i%2?a:d,p,w);}`,ctx);
 const save=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));const agents=Object.fromEntries(Object.entries(save.agents).map(([id,a])=>[id,Object.fromEntries(['relationships','memory','thoughts','chatHistory'].filter(k=>k in a).map(k=>[k,a[k]]))]));
 cases.push({kind,seed:seed*11456,input,ids,expected:{agents,gossip:save.gossip,messageLog:save.messageLog,townFeed:save.townFeed},rng:c.getRandomState()});
}
fs.writeFileSync(path.join(out,'oracle.json'),json(cases));console.log(cases.length,'gossip source scenarios');

import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];const coverage={};
for(let seed=1;seed<=24;seed++)for(const kind of ['attraction','jealous','rivals','friction','dating','marriage','affair','discovery','missing_third','breakup','divorce','decay','player','missing','reverse']){
 const c=context();const {ctx}=c;ctx.kind=kind;
 ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext(`var w=new World();w.loadSave(raw);var ids=Object.keys(w.agents).filter(k=>k!=='player').slice(0,3);var people=ids.map(k=>w.agents[k]);var p=w.agents.player;w.agents={};people.forEach((p,i)=>{p.agentId=['a','b','c'][i];w.agents[p.agentId]=p;});w.agents.player=p;var [a,b,d]=people;
 for(const person of Object.values(w.agents)){person.relationships=new RelationshipManager();person.memory=new Memory();person.thoughts=[];person.moodModifier=0;person.personality.traits=[];}w.messageLog=[];w.gossipNetwork.activeGossip=[];w.dailyNews.collectEvent=()=>{};w.queueDramaScene=()=>{};w.npcEvents.handleCheatingDiscovery=()=>{};w.tickCount=1000;
 function link(x,y,props={}){const r=x.relationships.getOrCreate(y.agentId,y.name);Object.assign(r,{affinity:70,romanticInterest:70,interactionCount:8,lastInteractionTick:1000},props);return r;}
 var ra=link(a,b),rb=link(b,a);
 if(kind==='attraction'){a.personality.traits=['romantic','creative','optimist'];b.personality.traits=['romantic','creative','optimist'];rb.romanticInterest=20;}
 if(kind==='jealous'){link(b,d,{status:'married',statusSince:1000});link(d,b,{status:'married',statusSince:1000});}
 if(kind==='rivals'){link(d,b);ra.romanticInterest=60;rb.romanticInterest=0;link(a,d,{affinity:-20,romanticInterest:0});link(d,a,{affinity:-20,romanticInterest:0});}
 if(kind==='friction'){a.personality.traits=['optimist','hardworking','shy','night_owl','abrasive','jealous'];b.personality.traits=['pessimist','lazy','charismatic','early_bird'];ra.affinity=-39;rb.affinity=-39;ra.romanticInterest=rb.romanticInterest=0;}
 if(['marriage','affair','discovery','missing_third','breakup','divorce'].includes(kind)){ra.status=rb.status=kind==='divorce'||kind==='discovery'||kind==='missing_third'?'married':'dating';ra.statusSince=rb.statusSince=0;}
 if(kind==='affair'){a.personality.traits=['romantic'];link(a,d);link(d,a);}
 if(kind==='discovery'||kind==='missing_third'){link(b,d,{isCheating:true,romanticInterest:0});link(d,b,{isCheating:true,romanticInterest:0});if(kind==='missing_third')delete w.agents.c;}
 if(kind==='breakup'||kind==='divorce')ra.affinity=rb.affinity=-50;
 if(kind==='decay'){ra.affinity=29.9;ra.romanticInterest=10;ra.interactionCount=0;ra.lastInteractionTick=0;}
 if(kind==='player'){a.relationships=new RelationshipManager();b.relationships=new RelationshipManager();link(a,p);link(p,a);}
 if(kind==='missing')delete w.agents.b;
 if(kind==='reverse'){a.relationships=new RelationshipManager();}
 `,ctx);
 const full=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
 const input=Object.fromEntries(['version','clock','tickCount','agents','gossip','messageLog'].map(k=>[k,full[k]]));
 input.agents=Object.fromEntries(Object.entries(input.agents).map(([id,a])=>[id,Object.fromEntries(['id','name','jobKey','isPlayer','personality','attributes','relationships','memory','thoughts'].filter(k=>k in a).map(k=>[k,a[k]]))]));
 c.setRandomState(seed*11456);
 vm.runInContext('for(let i=0;i<12;i++){w.tickCount++;w._processRelationships();}',ctx);
 const save=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
 const runtime=JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries(Object.entries(w.agents).map(([id,a])=>[id,a.moodModifier||0])))',ctx));
 const flags=JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries(Object.entries(w.agents).map(([id,a])=>[id,Object.fromEntries(Object.entries(a.relationships.relationships).filter(([_,r])=>r._rivalGossiped).map(([id])=>[id,true]))])))',ctx));
 for(const [id,rels]of Object.entries(flags))for(const target of Object.keys(rels))save.agents[id].relationships[target]._rivalGossiped=true;
 const agents=Object.fromEntries(Object.entries(save.agents).map(([id,a])=>[id,Object.fromEntries(['relationships','memory','thoughts'].map(k=>[k,a[k]]))]));
 for(const a of Object.values(agents))for(const t of a.thoughts)coverage[t.kind]=(coverage[t.kind]||0)+1;
 coverage.affair=(coverage.affair||0)+save.messageLog.filter(m=>m.content.includes('秘密關係')).length;
 cases.push({kind,seed:seed*11456,input,steps:12,expected:{agents,gossip:save.gossip,messageLog:save.messageLog},runtime,rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/romance'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/romance/oracle.json'),json(cases));fs.writeFileSync(path.join(root,'godot/docs/ROMANCE_ORACLE_COVERAGE.json'),json({scenarios:cases.length,seeds:24,callsPerScenario:12,coverage,source:'chrome-extension/simulation.js World._processRelationships; v5.74.1',excluded:['queueDramaScene','dailyNews.collectEvent','npcEvents.handleCheatingDiscovery']}));console.log(cases.length,'romance source scenarios',coverage);

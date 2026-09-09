import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(let seed=1;seed<=48;seed++)for(const kind of ['solo','pair','threshold','remote','sleeping','traits','caps']){
 const c=context();const {ctx}=c;ctx.kind=kind;ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext(`var w=new World();w.loadSave(raw);var a=w.agents.chen_wei,b=w.agents.lin_mei;w.agents={chen_wei:a,...(kind==='solo'?{}:{lin_mei:b})};w.messageLog=[];w.events.conversationTopics=[];
 for(const x of Object.values(w.agents)){x.activity='stargazing';x.currentLocation='town_square';x.relationships=new RelationshipManager();x.memory=new Memory();x.moodModifier=0;x.personality.traits=[];x.needs.recreation=x.needs.comfort=kind==='caps'?99:30;}
 if(kind==='remote')b.currentLocation='park';if(kind==='sleeping')b.activity='sleeping';
 if(kind==='traits'){a.personality.traits=['kind','introvert'];b.personality.traits=['abrasive','extrovert'];}
 if(kind==='threshold'||kind==='caps'){a.relationships.getOrCreate(b.agentId,b.name).affinity=kind==='caps'?99:20;b.relationships.getOrCreate(a.agentId,a.name).affinity=kind==='caps'?99:19;}
 `,ctx);
 const full=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
 const input=Object.fromEntries(['clock','tickCount','agents','events','messageLog'].map(k=>[k,full[k]]));
 c.setRandomState(seed*11456);
 vm.runInContext('for(let i=0;i<16;i++)a._doStargazing(w)',ctx);
 const after=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
 const expected={agents:after.agents,events:after.events,messageLog:after.messageLog};
 const mood=vm.runInContext('Object.fromEntries(Object.entries(w.agents).map(([id,x])=>[id,x.moodModifier]))',ctx);
 cases.push({kind,seed:seed*11456,input,expected,mood,rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/stargazing'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/stargazing/oracle.json'),json(cases));console.log(cases.length,'stargazing scenarios');

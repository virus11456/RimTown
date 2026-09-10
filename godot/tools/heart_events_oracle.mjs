import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root} from './golden.mjs';
const raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));const thresholds=[];const speech=[];
for(const affinity of [24,25,54,55,79,80])for(const romantic of [49,50])for(const prior of [[],['friend'],['friend','close'],['friend','close','soulmate','crush']]){
 const c=context();Object.assign(c.ctx,{raw,affinity,romantic,prior});
 vm.runInContext(`var w=new World();w.loadSave(raw);w.heartEventsFired={};for(const a of Object.values(w.agents))a.relationships.relationships={};var n=w.agents.chen_wei;var p=Object.values(w.agents).find(a=>a.isPlayer);var r=n.relationships.getOrCreate(p.agentId,p.name);r.affinity=affinity;r.romanticInterest=romantic;w.heartEventsFired[n.agentId]=[...prior];var chosen=null;w.conversationEngine.fireHeartEvent=(_w,n,e)=>{chosen={npc:n.agentId,event:e.id};return new Promise(()=>{});};`,c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));vm.runInContext('w.checkHeartEvents();w.checkHeartEvents()',c.ctx);
 thresholds.push({input,chosen:JSON.parse(vm.runInContext('JSON.stringify(chosen)',c.ctx)),fired:JSON.parse(vm.runInContext('JSON.stringify(w.heartEventsFired)',c.ctx))});
}
for(let event=0;event<4;event++)for(const trait of ['', 'shy','abrasive'])for(let slot=0;slot<6;slot++){
 const c=context();Object.assign(c.ctx,{raw,event,trait,slot});vm.runInContext(`var w=new World();w.loadSave(raw);var n=w.agents.chen_wei;var p=Object.values(w.agents).find(a=>a.isPlayer);n.personality.traits=trait?[trait]:[];w.conversationEngine.llm=null;Math.random=()=>slot/6;`,c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));await vm.runInContext('w.conversationEngine.fireHeartEvent(w,n,HEART_EVENTS[event])',c.ctx);
 const expected=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));speech.push({input,event,slot,expected:{history:expected.agents.player.chatHistory,memory:expected.agents.chen_wei.memory,relationships:expected.agents.chen_wei.relationships,logs:expected.messageLog}});
}
fs.mkdirSync(path.join(root,'godot/tests/heart_events'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/heart_events/oracle.json'),JSON.stringify({thresholds,speech}));console.log(thresholds.length,speech.length);

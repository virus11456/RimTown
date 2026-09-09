import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json,sha} from './golden.mjs';
for(const theme of ['frontier','harbor']){
 const c=context();const {ctx}=c;const input=JSON.parse(fs.readFileSync(path.join(root,`godot/tests/golden/${theme}-day-01.json`)));
 ctx.input=structuredClone(input);
 vm.runInContext(`const savedMessages=JSON.parse(JSON.stringify(input.messageLog||[]));var w=new World();w.loadSave(input);w.reputationSystem.getModifier=()=>0;Object.defineProperty(w.weather,'moodModifier',{get:()=>0});w.messageLog=savedMessages;const originalLog=w.logMessage.bind(w);w.logMessage=(type,...args)=>{if(['social','conversation'].includes(type))originalLog(type,...args);};w.dailyNews.collectEvent=()=>{};w.gossipNetwork.spreadGossip=()=>{};
 for(const name of ['_doNightMischief','_doMourning','_generateThought','_recordTrace','_perceiveSurroundings'])Agent.prototype[name]=function(){};`,ctx);
 c.setRandomState(11456);const checkpoints=[];
 for(let tick=1;tick<=2880;tick++){
  vm.runInContext('w.tickCount++;w.clock.tick();for(const a of Object.values(w.agents))a.update(w);',ctx);
  if(![1,6,96,576,1440,2784,2880].includes(tick))continue;
  const save=vm.runInContext('w.serialize()',ctx);
  const agents={};for(const [id,a]of Object.entries(save.agents))agents[id]={needs:a.needs,activity:a.activity,currentLocation:a.currentLocation,mood:a.mood,skills:a.skills,relationships:a.relationships,lastInteraction:a._lastInteractionTick,memoryCount:a.memory.length,memoryHash:sha(a.memory.map(e=>e.content).join('\n')),memoryTail:a.memory.slice(-5),hangout:vm.runInContext(`w.agents[${JSON.stringify(id)}]._pendingHangout||null`,ctx)};
  checkpoints.push({tick,rng:c.getRandomState(),clock:save.clock,agents,conversationCount:save.npcConversationLog.length,conversationHash:sha(save.npcConversationLog.flatMap(c=>c.dialogue.map(d=>d.speaker+':'+d.text)).join('\n')),conversationTail:save.npcConversationLog.slice(-5),logCount:save.messageLog.length,logTail:save.messageLog.slice(-5)});
 }
 fs.writeFileSync(path.join(root,`godot/tests/social/${theme}-simulation.json`),json({input,checkpoints}));console.log(theme,'7 social simulation checkpoints');
}

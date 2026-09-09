import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json,sha} from './golden.mjs';
const mischief=process.argv.includes('--mischief');const stargazing=mischief||process.argv.includes('--stargazing');const innerVoice=stargazing||process.argv.includes('--inner-voice');const thoughts=innerVoice||process.argv.includes('--thoughts');const factions=thoughts||process.argv.includes('--factions');const feuds=factions||process.argv.includes('--feuds');const romance=feuds||process.argv.includes('--romance');const gossip=romance||process.argv.includes('--gossip');
for(const theme of ['frontier','harbor']){
 const c=context();const {ctx}=c;const input=JSON.parse(fs.readFileSync(path.join(root,`godot/tests/golden/${theme}-day-01.json`)));
 if(stargazing){input.clock.hour=21;input.clock.minute=0;for(const a of Object.values(input.agents).filter(a=>!a.isPlayer).slice(0,4)){a.personality.traits=mischief?["night_owl","gossip"]:["night_owl"];a.needs.rest=100;}}
 ctx.input=structuredClone(input);ctx.enableGossip=gossip;ctx.enableRomance=romance;ctx.enableFeuds=feuds;ctx.enableFactions=factions;ctx.enableThoughts=thoughts;ctx.enableInnerVoice=innerVoice;ctx.enableStargazing=stargazing;ctx.enableMischief=mischief;
 vm.runInContext(`const savedMessages=JSON.parse(JSON.stringify(input.messageLog||[]));var w=new World();w.loadSave(input);w.reputationSystem.getModifier=()=>0;Object.defineProperty(w.weather,'moodModifier',{get:()=>0});w.messageLog=savedMessages;const originalLog=w.logMessage.bind(w);w.logMessage=(type,...args)=>{if(['social','conversation',...(enableMischief?['mischief']:[]),...(enableStargazing?['discovery']:[]),...(enableGossip?['gossip']:[]),...(enableRomance?['relationship']:[]),...(enableFeuds?['event']:[]),...(enableFactions?['faction']:[])].includes(type))originalLog(type,...args);};w.dailyNews.collectEvent=()=>{};w.queueDramaScene=()=>{};w.npcEvents.handleCheatingDiscovery=()=>{};if(!enableGossip)w.gossipNetwork.spreadGossip=()=>{};
 for(const name of [...(!enableMischief?['_doNightMischief']:[]),'_doMourning',...(!enableInnerVoice?['_generateThought']:[]),'_recordTrace','_perceiveSurroundings'])Agent.prototype[name]=function(){};`,ctx);
 c.setRandomState(11456);const checkpoints=[];
 for(let tick=1;tick<=2880;tick++){
  vm.runInContext("w.tickCount++;if(w.clock.tick().includes('new_day')){if(enableRomance)w._processRelationships();if(enableFeuds)w._processFeuds();if(enableFactions)w.factions.dailyUpdate(w);if(enableThoughts)w._processThoughts();}for(const a of Object.values(w.agents))a.update(w);",ctx);
  if(![1,6,96,576,1440,2784,2880].includes(tick))continue;
  const save=vm.runInContext('w.serialize()',ctx);
  const agents={};for(const [id,a]of Object.entries(save.agents))agents[id]={needs:a.needs,activity:a.activity,currentLocation:a.currentLocation,mood:a.mood,skills:a.skills,relationships:a.relationships,lastInteraction:a._lastInteractionTick,memoryCount:a.memory.length,memoryHash:sha(a.memory.map(e=>e.content).join('\n')),memoryTail:a.memory.slice(-5),hangout:structuredClone(vm.runInContext(`w.agents[${JSON.stringify(id)}]._pendingHangout||null`,ctx))};
  if(romance)for(const [id,a] of Object.entries(agents)){
   a.thoughts=structuredClone(save.agents[id].thoughts);
   if(innerVoice)a.currentThought=save.agents[id].currentThought;
   a.moodModifier=vm.runInContext(`w.agents[${JSON.stringify(id)}].moodModifier||0`,ctx);
   a.relationships=structuredClone(a.relationships);
   const flags=vm.runInContext(`Object.entries(w.agents[${JSON.stringify(id)}].relationships.relationships).filter(([_,r])=>r._rivalGossiped).map(([id])=>id)`,ctx);
   for(const target of flags)a.relationships[target]._rivalGossiped=true;
  }
  checkpoints.push({...factions?{factions:structuredClone(save.factions),events:structuredClone(save.events)}:{},...feuds?{feudCooldown:structuredClone(save.feudCooldown)}:{},...gossip?{gossip:structuredClone(save.gossip),townFeed:structuredClone(save.townFeed)}:{},tick,rng:c.getRandomState(),clock:save.clock,agents,conversationCount:save.npcConversationLog.length,conversationHash:sha(save.npcConversationLog.flatMap(c=>c.dialogue.map(d=>d.speaker+':'+d.text)).join('\n')),conversationTail:save.npcConversationLog.slice(-5),logCount:save.messageLog.length,logTail:save.messageLog.slice(-5)});
 }
 fs.writeFileSync(path.join(root,`godot/tests/social/${theme}${mischief?'-mischief':stargazing?'-stargazing':innerVoice?'-inner-voice':thoughts?'-thoughts':factions?'-factions':feuds?'-feuds':romance?'-romance':gossip?'-gossip':''}-simulation.json`),json({input,checkpoints}));console.log(theme,'7 social simulation checkpoints');
}

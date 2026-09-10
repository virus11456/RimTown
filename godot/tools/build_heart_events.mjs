import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const {ctx}=context();const definitions=vm.runInContext('HEART_EVENTS',ctx);
// Extract fallback speech by executing the original method with each random slot.
const fallbacks={friend:[],romance:[]};
for(const romance of [false,true])for(let slot=0;slot<6;slot++){
 Object.assign(ctx,{romance,slot});
 await vm.runInContext(`(async()=>{var p={agentId:'player',name:'旅人',isPlayer:true,chatHistory:[]};var n={agentId:'npc',name:'居民',age:30,job:{title:'{job}'},personality:{traits:[]},relationships:{getOrCreate:()=>({addSharedMemory:()=>{}})},memory:{add:()=>{}}};var fake={agents:{player:p},clock:{timeStr:'春季 1日 06:00'},tickCount:0,logMessage:()=>{}};var old=Math.random;Math.random=()=>slot/6;try{await ConversationEngine.prototype.fireHeartEvent.call({llm:null},fake,n,{romance,name:'測試',icon:'🌱'});return p.chatHistory[0].text;}finally{Math.random=old;}})()`,ctx).then(text=>fallbacks[romance?'romance':'friend'].push(text));
}
fs.writeFileSync(path.join(root,'godot/assets/data/heart_event_rules.json'),json({events:definitions,fallbacks}));

import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const key of ['gossip','flirt','threaten','request'])for(const affinity of [-99,25,26,29,30,100])for(const trust of [9,10])for(const repeat of [1,3]){
 const c=context();const {ctx}=c;Object.assign(ctx,{raw:JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'))),key,affinity,trust,repeat});
 vm.runInContext(`var w=new World();w.loadSave(raw);var a=w.agents.chen_wei,p=w.agents.player;a.moodModifier=0;var r=a.relationships.getOrCreate('player',p.name);r.affinity=affinity;r.trust=trust;r.romanticInterest=99;w.gossipNetwork.activeGossip=repeat===1?[]:Array.from({length:12},(_,i)=>({about:i===11?a.name:i===10?p.name:'林美',content:'消息'+i}));`,ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));c.setRandomState(11456);
 vm.runInContext('for(let i=0;i<repeat;i++)RimTownApp.prototype._applyChatIntent.call({world:w},a,p,key)',ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));cases.push({input,key,repeat,agent:out.agents.chen_wei,player:out.agents.player,actions:out.playerActions,mood:vm.runInContext('a.moodModifier',ctx),rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/player_intents'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/player_intents/oracle.json'),json(cases));console.log(cases.length,'intent scenarios');

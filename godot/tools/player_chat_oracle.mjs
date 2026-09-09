import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const style of ['normal','prefix','no_effects','multiline','thinking','truncated','parentheses','malformed'])for(const affinity of [-3,0,4,5]){
 const c=context();const {ctx}=c;ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext('var w=new World();w.loadSave(raw);w.checkHeartEvents=()=>{};w.conversationEngine.replanRestOfDay=async()=>{};var a=w.agents.chen_wei,p=w.agents.player;',ctx);
 let response='今天在鎮上遇到林美，聊得很開心。\nEFFECTS: '+JSON.stringify({affinity_change:affinity,romantic_change:2,summary:'談起今天的見聞。'});
 if(style==='prefix')response='陳偉：'+response;if(style==='no_effects')response='嗯，我記得這件事。';if(style==='multiline')response=response.replace('{','{\n');if(style==='thinking')response='```analysis\n內部分析\n```\n'+response;if(style==='truncated')response=response.replace('。\nEFFECTS','。還有一些話沒有說完\nEFFECTS');if(style==='parentheses')response='(looks away)\n（微笑）\n'+response;if(style==='malformed')response='今天真開心。\nEFFECTS: { broken';
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));ctx.response=response;c.setRandomState(11456);
 vm.runInContext('var rn=a.relationships.getOrCreate(p.agentId,p.name),rp=p.relationships.getOrCreate(a.agentId,a.name);w.conversationEngine._parsePlayerReply(response,p,a,w,"今天過得如何？",rp,rn);',ctx);
 const after=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));after.agents.player._recentChatTick=vm.runInContext('p._recentChatTick',ctx);cases.push({style,response,input,agents:{chen_wei:after.agents.chen_wei,player:after.agents.player},logs:after.messageLog,rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/player_chat'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/player_chat/oracle.json'),json(cases));console.log(cases.length,'player chat cases');

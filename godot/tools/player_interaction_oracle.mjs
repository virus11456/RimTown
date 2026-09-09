import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const affinity of [-100,0,99,100])for(const social of [0,90,100])for(const repeat of [1,3]){
 const c=context();const {ctx}=c;ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));ctx.affinity=affinity;ctx.social=social;ctx.repeat=repeat;
 vm.runInContext('var w=new World();w.loadSave(raw);var a=w.agents.chen_wei,p=w.agents.player;a.needs.social=social;a.moodModifier=0;a.relationships.getOrCreate("player",p.name).affinity=affinity;',ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
 vm.runInContext('for(let i=0;i<repeat;i++)RimTownApp.prototype._applyChatIntent.call({world:w},a,p,"comfort")',ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));cases.push({input,repeat,agent:out.agents.chen_wei,actions:out.playerActions,mood:vm.runInContext('a.moodModifier',ctx)});
}
fs.mkdirSync(path.join(root,'godot/tests/player_interaction'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/player_interaction/oracle.json'),json(cases));console.log(cases.length,'comfort scenarios');

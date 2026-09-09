import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const text of ['記得好好休息。','林美很可靠。','陳偉和旅人都是朋友。','林美、王麗與趙剛值得認識。','記得'.repeat(40),'😀今天也要加油！'])for(const repeat of [1,3]){
 const c=context();c.ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));Object.assign(c.ctx,{text,repeat});
 vm.runInContext('var w=new World();w.loadSave(raw);w.conversationEngine.llm=null;w.conversationEngine.replanRestOfDay=async()=>{};var app={world:w,activeTab:"none",bgm:null};',c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));
 await vm.runInContext('(async()=>{for(let i=0;i<repeat;i++)await RimTownApp.prototype.playerWhisper.call(app,"chen_wei",text)})()',c.ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));cases.push({input,text,repeat,agent:out.agents.chen_wei,player:out.agents.player,actions:out.playerActions,logs:out.messageLog});
}
fs.mkdirSync(path.join(root,'godot/tests/player_whisper'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/player_whisper/oracle.json'),json(cases));console.log(cases.length,'offline whisper cases');

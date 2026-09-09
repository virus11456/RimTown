import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const key of ['food','herbs','cloth','tools','silver'])for(const job of ['farmer','doctor','cook','tailor','merchant','mayor','trader'])for(const aff of [0,99]){
 const c=context();Object.assign(c.ctx,{raw:JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'))),key,job,aff});
 vm.runInContext('var w=new World();w.loadSave(raw);w.checkHeartEvents=()=>{};var a=w.agents.chen_wei;a.job.key=job;a.relationships.getOrCreate("player",w.agents.player.name).affinity=aff;var app={world:w,chatTarget:"chen_wei",activeTab:"none",_giftDefs:RimTownApp.prototype._giftDefs,_giftPref:RimTownApp.prototype._giftPref};',c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));c.setRandomState(11456);
 vm.runInContext('RimTownApp.prototype._giveGift.call(app,key)',c.ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));cases.push({input,key,agents:out.agents,stock:out.stockpile,actions:out.playerActions,logs:out.messageLog,rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/player_gift'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/player_gift/oracle.json'),json(cases));console.log(cases.length,'gift cases');

import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const tone of ['praise','diss','ship'])for(const traits of [[],['kind'],['gossip'],['kind','gossip']])for(const seed of [1,11456,987654]){
 const c=context();Object.assign(c.ctx,{raw:JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'))),traits,tone});
 vm.runInContext('var w=new World();w.loadSave(raw);w.agents.chen_wei.personality.traits=traits;var app={world:w,chatTarget:"chen_wei",_rumorAbout:"lin_mei",activeTab:"none",renderSidebar(){}};',c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));c.setRandomState(seed);
 vm.runInContext('RimTownApp.prototype._sendRumor.call(app,tone)',c.ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));cases.push({input,tone,seed,agents:out.agents,gossip:out.gossip,logs:out.messageLog,day:vm.runInContext('w._lastRumorDay',c.ctx),rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/player_rumor'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/player_rumor/oracle.json'),json(cases));console.log(cases.length,'rumor cases');

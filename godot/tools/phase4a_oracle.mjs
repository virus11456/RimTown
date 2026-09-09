import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const out=path.join(root,'godot/tests/phase4a');fs.mkdirSync(out,{recursive:true});
const {ctx}=context();
fs.writeFileSync(path.join(root,'godot/assets/data/sim_rules.json'),json(vm.runInContext('({jobs:JOB_DEFINITIONS,traits:TRAIT_POOL,jobSkills:JOB_SKILL_MAP,activitySkills:ACTIVITY_SKILL_MAP,passions:PASSION_XP_MULT})',ctx)));
const fields=['needs','activity','currentLocation','mood','skills','currentThought','_locationStayRemaining'];
for(const theme of ['frontier','harbor']){
 const c=context();const input=JSON.parse(fs.readFileSync(path.join(root,`godot/tests/golden/${theme}-day-01.json`)));
 c.ctx.input=input;
 vm.runInContext(`var w=new World();w.loadSave(input);w.reputationSystem.getModifier=()=>0;Object.defineProperty(w.weather,"moodModifier",{get:()=>0});
 // Scope boundary: preserve full original Agent.update order, disable only phase 4b–f effects.
 for(const name of ['_trySocialInteraction','_doNightMischief','_doMourning','_generateThought','_recordTrace','_perceiveSurroundings'])Agent.prototype[name]=function(){};
 w.logMessage=function(){};`,c.ctx);
 c.setRandomState(11456);
 const checkpoints=[];
 for(let tick=1;tick<=2880;tick++){
  vm.runInContext('w.tickCount++;w.clock.tick();for(const a of Object.values(w.agents))a.update(w);',c.ctx);
  if([1,4,72,96,576,2784,2880].includes(tick)){
   const agents=vm.runInContext('w.serialize().agents',c.ctx);
   checkpoints.push({tick,clock:vm.runInContext('w.serialize().clock',c.ctx),rng:c.getRandomState(),agents:Object.fromEntries(Object.entries(agents).map(([id,a])=>[id,Object.fromEntries(fields.map(f=>[f,a[f]]))]))});
  }
 }
 fs.writeFileSync(path.join(out,theme+'.json'),json({seed:11456,input,checkpoints}));
}
console.log('Phase4a scoped oracle: 2 towns × 2880 ticks, 7 checkpoints each; original World.tick cross-system effects excluded.');
for(const theme of ['frontier','harbor']){
 const c=context();const input=JSON.parse(fs.readFileSync(path.join(root,`godot/tests/golden/${theme}-day-01.json`)));
 c.ctx.input=input;
 vm.runInContext(`var w=new World();w.loadSave(input);var tm=Object.create(PixelTileMap.prototype);Object.assign(tm,{cols:80,rows:60,buildingZones:{},natureZones:{},labelPositions:{},_houseSubZones:{},_agentHouseMap:{},agentPositions:{},playerInput:{x:0,y:0},_viewW:0});tm.generateLayout(w.townMap.locations);RimTownApp.prototype._syncHousing.call({world:w,tileMap:tm});`,c.ctx);
 const paths=[];
 for(const [start,end] of [[[0,0],[1200,900]],[[640,480],[640,480]],[[256,256],[400,400]],[[24,24],[760,616]],[[680,600],[664,320]],[[100,100],[-100,-100]]]){
  c.ctx.start=start;c.ctx.end=end;
  paths.push({start,end,expected:vm.runInContext('tm._findPath(...start,...end)||[]',c.ctx)});
 }
 const checkpoints=[];const changes=[];
 const keys=['x','y','targetX','targetY','walking','walkStep','doorPhase','_slpOut','_inStuck'];
 for(let frame=1;frame<=720;frame++){
  if(frame===100) {vm.runInContext(`for(const a of Object.values(w.agents)){a.currentLocation='tavern';a.activity='eating';}`,c.ctx);changes.push({frame,location:'tavern',activity:'eating'});}
  if(frame===300) {vm.runInContext(`for(const a of Object.values(w.agents)){a.currentLocation=a.homeLocation;a.activity='sleeping';}`,c.ctx);changes.push({frame,location:'home',activity:'sleeping'});}
  if(frame===400) {vm.runInContext(`for(const p of Object.values(tm.agentPositions)){p._slpOut=600;p.walking=true;}`,c.ctx);changes.push({frame,sleepFuse:true});}
  if(frame===500) {vm.runInContext(`for(const a of Object.values(w.agents)){a.currentLocation='town_hall';a.activity='working';}for(const p of Object.values(tm.agentPositions))p._inStuck=360;`,c.ctx);changes.push({frame,location:'town_hall',activity:'working',awakeFuse:true});}
  vm.runInContext('tm.updateAgents(w.getState().agents,w.townMap.locations,null)',c.ctx);
  if([1,2,60,100,300,400,401,500,501,600,720].includes(frame)){
   const positions=vm.runInContext('JSON.parse(JSON.stringify(tm.agentPositions))',c.ctx);
   checkpoints.push({frame,positions:Object.fromEntries(Object.entries(positions).map(([id,p])=>[id,Object.fromEntries(keys.filter(k=>p[k]!==undefined).map(k=>[k,p[k]]))]))});
  }
 }
 fs.writeFileSync(path.join(out,theme+'-motion.json'),json({input,paths,changes,checkpoints}));
}
console.log('Motion oracle: 12 paths + 22 frame checkpoints including both stuck recovery thresholds.');

import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const season of ['春季','夏季','秋季','冬季'])for(const mode of ['normal','off','extra','empty','surplus','modifiers','crisis'])for(const seed of [1,11456]){
 const c=context();Object.assign(c.ctx,{raw:JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'))),season,mode});
 vm.runInContext(`var w=new World();w.loadSave(raw);w.clock.season=season;for(const a of Object.values(w.agents))a.moodModifier=0;
 if(['off','extra','empty'].includes(mode))w.workPolicy={meals:mode==='off'?'off':'extra',tools:mode==='off'?'off':'extra',clothing:mode==='off'?'off':'extra',medicine:mode==='off'?'off':'extra',furniture:mode==='off'?'off':'extra'};
 if(mode==='empty'){for(const k of Object.keys(w.stockpile.resources))w.stockpile.resources[k]=0;for(const a of Object.values(w.agents))a.mood=10;}
 if(mode==='surplus'){w.stockpile.resources.food=1000;w.stockpile.resources.meals=500;}
 if(mode==='crisis'){for(let i=0;i<150;i++){const a=new Agent('extra_'+i,'居民'+i,30,new Personality(['kind'],'測試',[]),null,'residential_north','male');w.agents[a.agentId]=a;}for(const a of Object.values(w.agents)){a.job=null;a.moodModifier=0;}for(const k of Object.keys(w.stockpile.resources))w.stockpile.resources[k]=0;}
 if(mode==='modifiers'){w.stockpile.resources.food=1000;w.news.activeModifiers={farm_bonus:.3,mining_bonus:.2};w.weather.current='storm';w.weather.activeDisaster={effects:{farm:-.4}};w.buildings.activeEffects={food_capacity:800,food_decay:-.5};w.industry.industries={farming:{level:1}};}
 `,c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));c.setRandomState(seed);vm.runInContext('processDailyProduction(w)',c.ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));cases.push({input,mode,seed,stock:out.stockpile,agents:out.agents,logs:out.messageLog,moods:JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries(Object.entries(w.agents).map(([id,a])=>[id,a.moodModifier])))',c.ctx)),rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/economy'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/economy/oracle.json'),json(cases));console.log(cases.length,'economy cases');

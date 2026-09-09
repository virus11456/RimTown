import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const seed of [1,11456,987654])for(const rep of [0,40,150]){
 const c=context();Object.assign(c.ctx,{raw:JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'))),rep});
 vm.runInContext('var w=new World();w.loadSave(raw);w.reputationSystem.reputation=rep;w.news.activeModifiers={buy_bonus:.05,sell_bonus:.1,merchant_chance:.2};w.buildings.activeEffects={trade_bonus:.15,merchant_frequency:1.5};for(const key in w.stockpile.resources)w.stockpile.resources[key]=1000;',c.ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));c.setRandomState(seed);
 vm.runInContext('for(let day=0;day<30;day++){w.trade.dailyUpdate(w);if(w.trade.merchant){w.trade.executeTrade(0,3,w);w.trade.executeTrade(w.trade.merchant.offers.length-1,100,w);}}',c.ctx);
 const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',c.ctx));cases.push({input,seed,trade:out.trade,stock:out.stockpile,logs:out.messageLog,rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/trade'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/trade/oracle.json'),json(cases));console.log(cases.length,'trade cases');

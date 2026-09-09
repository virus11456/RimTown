import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const mode of ['normal','care','rotation','neglect','season','penalty'])for(const crop of Object.keys(context().ctx.CROPS||vm.runInContext('CROPS',context().ctx))){
 const {ctx}=context();ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));Object.assign(ctx,{mode,crop});
 vm.runInContext(`var w=new World();w.loadSave(raw);w.industry.chooseIndustry('farming',w);w.industry.industries.farming.level=CROPS[crop].reqLevel;w.clock.season=CROPS[crop].seasons[0];w.stockpile.resources.silver=10000;w.stockpile.resources.herbs=100;w.farm.dailyUpdate(w);if(mode==='rotation')w.farm.plots[0].lastCrop='other';if(mode==='penalty')w.farm.moodPenalty={days:5,penalty:-.5};`,ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));
 const steps=[];
 function action(fn,args=[]){ctx.args=args;const result=vm.runInContext(`w.farm.${fn}(...args${['plantCrop','fertilizePlot','harvestPlot'].includes(fn)?',w':''})`,ctx);steps.push({fn,args,result:typeof result==='boolean'?result:result.ok});}
 action('tillPlot',[1]);action('plantCrop',[1,crop]);if(['care','rotation'].includes(mode))action('fertilizePlot',[1]);
 for(let day=0;day<25;day++){
  if(mode==='season'&&day===2){vm.runInContext(`w.clock.season=CROPS[crop].seasons.includes('冬季')?'夏季':'冬季'`,ctx);steps.push({fn:'season',value:vm.runInContext('w.clock.season',ctx)});}
  if(['care','rotation'].includes(mode))action('waterPlot',[1]);
  vm.runInContext('w.farm.dailyUpdate(w)',ctx);steps.push({fn:'daily'});
  if(mode!=='neglect'&&vm.runInContext("w.farm.plots[0].state==='ready'",ctx)){action('harvestPlot',[1]);break;}
 }
 action('clearWithered',[1]);const out=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));cases.push({input,steps,farm:out.farm,stock:out.stockpile,logs:out.messageLog,news:out.dailyNews});
}
fs.mkdirSync(path.join(root,'godot/tests/farm'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/farm/oracle.json'),JSON.stringify(cases));console.log(cases.length,'farm cases');

import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(const kind of ['same','location','activity','midnight','season','year','plan','override','cap','invalid','ties','before']){
 const c=context();const {ctx}=c;ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext('var w=new World();w.loadSave(raw);var a=w.agents.chen_wei;a.todayTrace=[];a._traceDay="";a.dailyPlan=null;',ctx);
 const input=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));const actions=[];const expected=[];
 for(let i=0;i<180;i++){
  const action={hour:Math.floor(i/8)%24,minute:(i%4)*15,day:kind==='midnight'&&i>90?2:1,season:kind==='season'&&i>90?'夏季':'春季',year:kind==='year'&&i>90?2:1,activity:kind==='activity'?(i%2?'working':'wandering'):'working',loc:kind==='location'||kind==='cap'?'place_'+i:'town_square',plan:null};
  if(['plan','override','invalid','ties','before'].includes(kind))action.plan={blocks:[{time:'08:00',text:'鍛造',steps:['準備',null,'','加工','收尾']},{time:'12:00',text:'休息',steps:[]}]};
  if(kind==='override')action.activity=i%2?'sleeping':'eating';
  if(kind==='invalid')action.plan.blocks.unshift({time:'invalid',text:'不適用'});
  if(kind==='ties')action.plan.blocks.push({time:'08:00',text:'後項優先',steps:['一步']});
  if(kind==='before')action.hour=1;
  ctx.action=action;vm.runInContext('Object.assign(w.clock,{hour:action.hour,minute:action.minute,day:action.day,season:action.season,year:action.year});a.activity=action.activity;a.currentLocation=action.loc;a.dailyPlan=action.plan;a._recordTrace(w);',ctx);
  actions.push(action);
  if([0,90,179].includes(i))expected.push({index:i,trace:JSON.parse(vm.runInContext('JSON.stringify(a.todayTrace)',ctx)),day:vm.runInContext('a._traceDay',ctx)});
 }
 cases.push({kind,input,actions,expected});
}
fs.mkdirSync(path.join(root,'godot/tests/trace'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/trace/oracle.json'),json(cases));console.log(cases.length,'trace scenarios');

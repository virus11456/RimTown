import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const cases=[];
for(let seed=1;seed<=16;seed++)for(const kind of ['happy','skill','skill_tie','sad','hungry','stargazing','stroll','mourning','mischief','night_owl','sleeping','tie','bad_names','romantic','economy','project','merchant','danger','good','empty']){
 const c=context();const {ctx}=c;ctx.kind=kind;ctx.raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json')));
 vm.runInContext(`var w=new World();w.loadSave(raw);var a=w.agents[kind==='tie'?'lin_mei':'chen_wei'];a.currentThought='保留舊心聲';a.mood=50;a.needs.hunger=a.needs.rest=a.needs.social=100;a.activity='wandering';a.personality.traits=[];a.relationships=new RelationshipManager();a.skills=new SkillSet();w.clock.hour=12;w.clock.season='冬季';w.stockpile.resources={food:50,silver:100,meals:50};w.buildings.projects=[];w.trade.merchant=null;w.news.bulletins=[];
 if(kind==='skill'||kind==='skill_tie'){a.skills.get('射擊').xp=240;if(kind==='skill_tie')a.skills.get('藝術').xp=240;}if(kind==='happy')a.mood=70;if(kind==='sad')a.mood=10;if(kind==='hungry')a.needs.hunger=a.needs.rest=a.needs.social=20;
 if(kind==='stargazing')a.activity='stargazing';if(kind==='stroll'){a.activity='night_stroll';a.mood=25;}if(kind==='mourning'){a.activity='mourning';a._annualMourning=[{name:'故人'}];}if(kind==='mischief')a.activity='night_mischief';if(kind==='night_owl'){w.clock.hour=23;a.personality.traits=['night_owl'];}if(kind==='sleeping'){w.clock.hour=23;a.activity='sleeping';}
 if(kind==='bad_names'||kind==='romantic'){const r=a.relationships.getOrCreate('target',kind==='bad_names'?'123':'林美');r.affinity=50;r.romanticInterest=60;const x=a.relationships.getOrCreate('other','好友');x.affinity=50;}
 if(kind==='economy')w.stockpile.resources={food:10,silver:400,meals:0};if(kind==='project')w.buildings.projects=[{name:'新倉庫',workDone:2,workRequired:3}];if(kind==='merchant')w.trade.merchant={name:'行腳商人',offers:[]};if(kind==='danger'||kind==='good')w.news.bulletins=[{severity:kind,headline:'山路的消息'}];
 `,ctx);
 const full=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));const id=vm.runInContext('a.agentId',ctx);
 const input=Object.fromEntries(['clock','agents','townName','stockpile','buildings','trade','news'].map(k=>[k,full[k]]));input.agents={[id]:full.agents[id]};
 c.setRandomState(seed*11456);const sequence=[];for(let i=0;i<12;i++){vm.runInContext('a._generateThought(w)',ctx);sequence.push(vm.runInContext('a.currentThought',ctx));}
 cases.push({kind,id,seed:seed*11456,input,sequence,rng:c.getRandomState()});
}
fs.mkdirSync(path.join(root,'godot/tests/inner_voice'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/inner_voice/oracle.json'),json(cases));console.log(cases.length,'inner voice scenarios');

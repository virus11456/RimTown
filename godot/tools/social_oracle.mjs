import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const {ctx}=context();const memory=[];const relationships=[];
function memoryCase(entries,query,agents,n,now){ctx.input={entries,query,agents,n,now};const expected=vm.runInContext(`(()=>{const m=new Memory();m.entries=input.entries.map(e=>new MemoryEntry(e.tick,e.timeStr,e.category,e.content,e.importance,e.relatedAgents));return {recent:m.getRecent(input.n),about:m.getAboutAgent(input.agents[0]||'',input.n),important:m.getImportant(7,input.n),thoughts:m.getThoughts(input.n),retrieved:m.retrieve(input.query,input.agents,input.n,input.now)};})()`,ctx);memory.push({input:structuredClone(ctx.input),expected:JSON.parse(JSON.stringify(expected,(k,v)=>k==='_bi'?undefined:v))});}
for(const theme of ['frontier','harbor'])for(const day of [1,7,30]){
 const save=JSON.parse(fs.readFileSync(path.join(root,`godot/tests/golden/${theme}-day-${String(day).padStart(2,'0')}.json`)));
 for(const a of Object.values(save.agents).slice(0,3))for(const n of [0,1,5,20])memoryCase(a.memory.slice(-35),'工作 友情',[Object.values(save.agents)[1].name],n,save.tickCount);
}
const entries=Array.from({length:12},(_,i)=>({tick:i%3===0?96:0,timeStr:'第1天',category:i%2?'whisper':'reflection',content:['阿明！😀一起工作','阿明和小花去市場','😀😃🙂','', '同樣的記憶'][i%5],importance:i%3===0?0:i,relatedAgents:i%2?['阿明']:[]}));
for(const n of [0,1,3,30])for(const query of ['阿明','😀😃','', '市場，工作！'])memoryCase(entries,query,['阿明'],n,192);
for(const affinity of [-100,-60,-59.9,-20,-19.9,0,20,20.1,60,60.1,100])for(const status of [null,'married','dating','ex']){
 ctx.input={affinity,status,romanticInterest:affinity===0?51:0,interactionCount:affinity===20?1:0};
 const expected=vm.runInContext(`(()=>{const r=Object.assign(new Relationship('other','阿明'),input);return r.type;})()`,ctx);relationships.push({input:structuredClone(ctx.input),expected});
}
const mutations=vm.runInContext(`(()=>{const r=new Relationship('other','阿明');r.modifyAffinity(150);r.modifyTrust(-150);r.modifyRomantic(-5);for(let i=0;i<160;i++)r.recordInteraction(i,'記憶'+i);r.addSharedMemory('額外');return r;})()`,ctx);
const manager=vm.runInContext(`(()=>{const m=new RelationshipManager();for(const id of ['a','b','c']){const r=m.getOrCreate(id,id);r.affinity=id==='c'?20:30;r.romanticInterest=id==='c'?40:41;}m.relationships.b.status='dating';m.relationships.c.status='married';return {input:m.relationships,friends:m.getFriends(),romantic:m.getRomanticInterests(),best:m.getBestFriend(),partner:m.getPartner(),spouse:m.getSpouse()};})()`,ctx);
const out=path.join(root,'godot/tests/social');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'oracle.json'),json({memory,relationships,mutations,manager}));console.log(`${memory.length} memory scenarios, ${relationships.length} relationship boundaries, mutation and manager oracle`);

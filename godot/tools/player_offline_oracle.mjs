import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const raw=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'))), cases=[];let input;
const messages=['你好','你叫什麼名字？','工作如何？','心情怎樣？','感情如何？','你好漂亮','最近消息','想吃飯','好厲害','你很笨','再見','拜託幫忙','說說過去','天氣如何','誰在唱歌？','你覺得怎樣？','你知道真相嗎？','可以嗎？','今天也努力了','HELLO','你好嗎','你好漂亮但很笨','x'.repeat(35)+'😀😀'];
const profiles=[[],['shy'],['kind'],['abrasive'],['charismatic'],['gossip'],['romantic'],['pessimist'],['optimist'],['lazy'],['night_owl'],['shy','romantic'],['abrasive','shy','kind']];
const c=context();c.ctx.raw=raw;vm.runInContext('var w,a,p,rn,rp,result;',c.ctx);
function scenario(message,config,seed){
 Object.assign(c.ctx,{message,config});vm.runInContext(`w=new World();w.loadSave(JSON.parse(JSON.stringify(raw)));w.checkHeartEvents=()=>{};a=w.agents.chen_wei;p=w.agents.player;rn=a.relationships.getOrCreate('player',p.name);rp=p.relationships.getOrCreate(a.agentId,a.name);a.personality.traits=config.traits;rn.affinity=config.aff;rn.romanticInterest=config.rom;rn.status=config.status;a.mood=config.mood;a.needs.hunger=config.hunger;a.needs.rest=config.rest;a.activity=config.activity;a.job=config.serializedJob?new Job(config.job):{key:config.job,title:config.job};w.clock.hour=config.hour;w.clock.season=config.season;w.events.conversationTopics=config.topics;w.gossipNetwork.activeGossip=config.gossip;`,c.ctx);
 if(!input) input=JSON.parse(vm.runInContext("JSON.stringify(w.serialize())",c.ctx));
 c.setRandomState(seed);vm.runInContext('result=w.conversationEngine._fallbackPlayerReply(p,a,w,message,rp,rn)',c.ctx);
 const value=JSON.parse(vm.runInContext('JSON.stringify({result,npc:{relationships:w.serialize().agents.chen_wei.relationships,memory:w.serialize().agents.chen_wei.memory},player:{relationships:w.serialize().agents.player.relationships,memory:w.serialize().agents.player.memory,chatHistory:p.chatHistory,_recentChatTick:p._recentChatTick},logs:w.serialize().messageLog})',c.ctx));
 cases.push({message,config,seed,expected:value,rng:c.getRandomState()});
}
for(const [i,traits] of profiles.entries())for(const [j,message] of messages.entries())for(const seed of [1,11456,987654]){
 const k=i+j;scenario(message,{traits,aff:[-100,-10,0,10,11,20,30,50,51,100][k%10],rom:k%2?51:0,status:[null,'dating','married'][k%3],mood:[30,31,60,61][k%4],hunger:k%2?10:100,rest:k%3?100:10,activity:k%2?'stargazing':'idle',job:['farmer','cook','researcher'][k%3],hour:[4,5,16,17,21][k%5],season:['春季','夏季','秋季','冬季'][k%4],topics:k%3?[]:['小鎮慶典'],gossip:k%2?[]:[{about:'林美',content:'有人看到流星',source:'鎮民',spreadCount:0,isTrue:true,tickCreated:0}]},seed);
}
for(const job of ['miner','blacksmith','doctor','trader','guard','carpenter','tailor','priest','mayor','unknown'])for(const traits of profiles)scenario('你做什麼工作？',{traits,aff:0,rom:0,status:null,mood:50,hunger:100,rest:100,activity:'idle',job,hour:12,season:'春季',topics:[],gossip:[]},11456);
for(const job of ['farmer','cook','researcher','miner','blacksmith','doctor','trader','guard','carpenter','tailor','priest','mayor'])for(const message of ['你叫什麼名字？','工作如何？','吃什麼？'])scenario(message,{traits:['charismatic','kind'],aff:10,rom:0,status:null,mood:50,hunger:100,rest:100,activity:'idle',job,serializedJob:true,hour:12,season:'春季',topics:[],gossip:[]},11456);
fs.mkdirSync(path.join(root,'godot/tests/player_offline'),{recursive:true});fs.writeFileSync(path.join(root,'godot/tests/player_offline/oracle.json'),json({input,cases}));console.log(cases.length,'offline cases');

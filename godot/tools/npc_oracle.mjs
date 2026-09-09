import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const c=context();const {ctx}=c;const dialogue=[];
const combinations=[['kind','shy'],['abrasive','neurotic'],['charismatic','romantic'],['gossip','stoic'],['creative','creative'],['lazy','hardworking'],['optimist','pessimist'],['romantic','jealous']];
for(let seed=1;seed<=32;seed++)for(let branch=0;branch<10;branch++){
 const a={agentId:'a',name:'阿明',personality:{traits:[combinations[seed%8][0]],values:['自由']},job:{title:'農夫'},mood:[10,50,90][seed%3],currentLocation:'town_square'};
 const b={agentId:'b',name:'小花',personality:{traits:[combinations[seed%8][1]],values:[seed%2?'自然':'自由']},job:null,mood:50,currentLocation:'town_square'};
 const ra={affinity:[0,30,55,80,-40,25,0,55,35,35][branch],romanticInterest:branch===5?65:0,interactionCount:branch<2?0:10,status:branch===6?'dating':branch===7?'married':null};
 const rb={...ra,romanticInterest:branch===5&&seed%2?0:ra.romanticInterest};
 const w={clock:{season:['春季','夏季','秋季','冬季'][seed%4],timeOfDay:'上午'}};
 ctx.input={a,b,ra,rb,w};c.setRandomState(seed*11456);
 const expected=vm.runInContext('new ConversationEngine()._generatePersonalityDialogue(input.a,input.b,input.w,input.ra,input.rb)',ctx);
 dialogue.push({seed:seed*11456,input:ctx.input,expected,rng:c.getRandomState()});
}
fs.writeFileSync(path.join(root,'godot/tests/social/dialogue.json'),json(dialogue));console.log(dialogue.length,'full template/RNG cases');

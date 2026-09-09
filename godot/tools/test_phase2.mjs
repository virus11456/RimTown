import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';import {root} from './golden.mjs';
const data=fs.readFileSync(path.join(root,'godot/tests/golden/frontier-day-01.json'),'utf8');let requests=0;let errors=[];
const server=http.createServer(async(req,res)=>{try{
 requests++;const route=req.url.replace('/api/','');let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):{};
 if(!['login','register'].includes(route))assert.equal(req.headers.authorization,'Bearer fixture.session.only');
 if(route==='invalid-json'){res.end('not json');return;}
 if(route==='denied'){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'expired fixture'}));return;}
 let result;
 switch(route){
 case 'register':assert.equal(body.invite,'fixture-invite');assert.equal(body.email,'fixture@example.invalid');
 case 'login':assert.equal(req.method,'POST');assert.equal(body.username,'fixture-user');result={nonce:'fixture.session.only',user:{username:'fixture-user',id:1}};break;
 case 'me':result={logged_in:true,user:{username:'fixture-user'}};break;
 case 'saves':result=[{town_id:'fixture-town',town_name:'測試鎮'}];break;
 case 'save/fixture-town':result={save_data:data};break;
 case 'save':assert.equal(req.method,'POST');assert.equal(body.force,undefined);assert.equal(JSON.parse(body.save_data).tickCount,0);result={success:true,stale:true};break;
 case 'settings':if(req.method==='POST')assert.equal(body.npc_llm_budget,20);if(body.dialogue_lang!==undefined)assert.ok(['auto','zh','en'].includes(body.dialogue_lang));result={npc_llm_budget:20,dialogue_lang:body.dialogue_lang};break;
 case 'chat':assert.ok(['chat','background'].includes(body.lane));assert.ok(['zh','en'].includes(body.lang));result={reply:'fixture reply',remaining:99,lane:body.lane,lang:body.lang};break;
 default:throw Error('Unexpected route '+route);
 }
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
 }catch(e){errors.push(String(e));res.writeHead(500);res.end('{}');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const child=spawn(process.env.GODOT||'godot',['--headless','--log-file',process.env.GODOT_TEST_LOG||'/private/tmp/rimtown-api-test.log','--path',path.join(root,'godot'),'--script','res://tests/test_phase2.gd','--',`http://127.0.0.1:${server.address().port}/api/`],{stdio:'inherit'});
const timer=setTimeout(()=>child.kill(),60000);const code=await new Promise(r=>child.on('exit',r));clearTimeout(timer);server.close();assert.equal(errors.length,0,errors.join('\n'));assert.equal(code,0);console.log('HTTP contract requests verified:',requests);

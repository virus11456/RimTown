import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const files=['i18n','quest-system','industry','farm','processing','daily-news','npc-events','npc-quests','custom-npc','prosperity','simulation','tilemap','app'];
export function context(seed=11456) {
  let state=seed, tick=0;
  const epoch=Date.UTC(2026,0,1);
  const warnings=[];
  class FixedDate extends Date { constructor(...args){ super(...(args.length?args:[epoch+tick*2000])); } static now(){return epoch+tick*2000;} }
  const math=Object.create(Math); math.random=()=>{state=state*16807%2147483647;return (state-1)/2147483646;};
  const storage=new Map();
  const ctx=vm.createContext({Math:math,Date:FixedDate,console:{log(){},warn(...a){warnings.push(a.map(String).join(' '));},error(...a){warnings.push(a.map(String).join(' '));}},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    document:{readyState:'loading',addEventListener(){},getElementById(){return null;},querySelectorAll(){return [];}},
    setTimeout(){throw Error('Unexpected timer in offline golden');},setInterval(){throw Error('Unexpected interval in offline golden');},
    fetch(){throw Error('Network forbidden in golden');},__setTick:n=>tick=n});
  ctx.window=ctx;
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,'chrome-extension',file+'.js'),'utf8'),ctx,{filename:file+'.js'});
  return {ctx,warnings};
}
export const json=x=>JSON.stringify(x,null,2)+'\n';
export const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
export async function snapshots(theme='frontier',seed=11456){
  const {ctx,warnings}=context(seed);
  vm.runInContext(`var world=new World();world.townTheme=${JSON.stringify(theme)};world.reset(${seed});world.questSystem.init();`,ctx);
  const results={};
  // Day 1 / 7 / 30 at 06:00. totalDays is zero-based and seasons have 15 days.
  for(let n=0;n<=29*96;n++){
    if(n){vm.runInContext(`__setTick(${n});world.tick();`,ctx);await new Promise(resolve=>setImmediate(resolve));}
    if([0,6*96,29*96].includes(n))results[n/96+1]=vm.runInContext('world.serialize()',ctx);
  }
  assert.equal(warnings.length,0,warnings.join('\n'));
  return results;
}
async function main(){
  const out=path.join(root,'godot/tests/golden');fs.mkdirSync(out,{recursive:true});
  const manifest={seed:11456,epoch:'2026-01-01T00:00:00.000Z',tickMilliseconds:2000,scenario:'offline, no LLM, no player actions; day N at 06:00',sources:Object.fromEntries(files.map(f=>[f+'.js',sha(fs.readFileSync(path.join(root,'chrome-extension',f+'.js')))])),snapshots:{}};
  for(const theme of ['frontier','harbor']){
    const a=await snapshots(theme),b=await snapshots(theme);
    for(const day of [1,7,30]){
      const bytes=json(a[day]);assert.equal(bytes,json(b[day]),`${theme} day ${day} determinism`);
      const name=`${theme}-day-${String(day).padStart(2,'0')}.json`;
      fs.writeFileSync(path.join(out,name),bytes);
      manifest.snapshots[name]={sha256:sha(bytes),tickCount:a[day].tickCount,population:Object.keys(a[day].agents).length,topLevelKeys:Object.keys(a[day]).length};
    }
  }
  fs.writeFileSync(path.join(out,'manifest.json'),json(manifest));console.log(json(manifest.snapshots));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();

import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {context,root,json} from './golden.mjs';
const {ctx}=context();const expected=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/research/compatibility-save.json.tmp')));ctx.input=structuredClone(expected);


assert.equal(vm.runInContext('var w=new World();w.loadSave(input)',ctx),true);
const actual=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));let checks=0;
// Original Relationship reconstruction omits private one-shot gossip markers.
for(const a of Object.values(expected.agents))for(const rel of Object.values(a.relationships||{}))delete rel._rivalGossiped;

for(const key of ['clock','factions','events','gossip','stockpile','playerActions','workPolicy','buildings','trade','research']){assert.deepEqual(actual[key],expected[key]);checks++;}
for(const [id,a]of Object.entries(expected.agents))for(const key of ['memory','relationships','thoughts','currentThought','chatHistory','_mourningTargets','_annualMourning','todayTrace','_traceDay'])if(key in a){assert.deepEqual(actual.agents[id][key],a[key]);checks++;}
assert.deepEqual(actual.messageLog.slice(0,expected.messageLog.length),expected.messageLog);checks++;
const report={checks,passed:true,scope:'Original JS loads building/trade/research state and stock, memories, relationships and currentThought. Original reload drops _rivalGossiped; Godot resume retains it. No production API.'};
fs.writeFileSync(path.join(root,'godot/docs/RESEARCH_RELOAD_TESTS.json'),json(report));console.log(json(report));

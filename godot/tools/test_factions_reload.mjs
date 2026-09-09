import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {context,root,json} from './golden.mjs';
const {ctx}=context();const expected=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/factions/compatibility-save.json.tmp')));ctx.input=structuredClone(expected);
assert.ok(Object.keys(expected.factions.factions).length>0);
assert.equal(vm.runInContext('var w=new World();w.loadSave(input)',ctx),true);
const actual=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));let checks=0;
for(const key of ['clock','factions','events','gossip']){assert.deepEqual(actual[key],expected[key]);checks++;}
for(const [id,a]of Object.entries(expected.agents))for(const key of ['memory','relationships','thoughts'])if(key in a){assert.deepEqual(actual.agents[id][key],a[key]);checks++;}
assert.deepEqual(actual.messageLog.slice(0,expected.messageLog.length),expected.messageLog);checks++;
const report={checks,passed:true,scope:'Original JS loads formed factions, members, cohesion, three-day counter, memories and relationships. No production API.'};
fs.writeFileSync(path.join(root,'godot/docs/FACTIONS_RELOAD_TESTS.json'),json(report));console.log(json(report));

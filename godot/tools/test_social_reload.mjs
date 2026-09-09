import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {context,root,json} from './golden.mjs';
const {ctx}=context();const expected=JSON.parse(fs.readFileSync(path.join(root,'godot/tests/social/compatibility-save.json.tmp')));ctx.input=structuredClone(expected);
assert.ok(expected.npcConversationLog.length>0);
assert.equal(vm.runInContext('var w=new World();w.loadSave(input)',ctx),true);
const actual=JSON.parse(vm.runInContext('JSON.stringify(w.serialize())',ctx));let checks=0;
for(const key of ['clock','npcConversationLog']){assert.deepEqual(actual[key],expected[key]);checks++;}
for(const [id,a]of Object.entries(expected.agents))for(const key of ['memory','relationships','needs','skills','_lastInteractionTick']){assert.deepEqual(actual.agents[id][key],a[key]);checks++;}
// Original loadSave appends its own load-success message.
assert.deepEqual(actual.messageLog.slice(0,expected.messageLog.length),expected.messageLog);checks++;
const report={checks,passed:true,conversations:actual.npcConversationLog.length,scope:'Original JS loadSave preserves social data; Godot-only mode/RNG/pending-hangout extension is not executed by the web engine. No production server used.'};
fs.writeFileSync(path.join(root,'godot/docs/SOCIAL_RELOAD_TESTS.json'),json(report));console.log(json(report));

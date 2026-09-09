import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {context,root,json} from './golden.mjs';
// Run tests/test_playtest.gd first. This reads a local generated fixture only.
const file=path.join(root,'godot/tests/phase4a/compatibility-save.json.tmp');
const {ctx}=context();ctx.input=JSON.parse(fs.readFileSync(file,'utf8'));
const expected=structuredClone(ctx.input); // loadSave sanitizes its input in v5.67.4+; compare against the untouched export.
vm.runInContext('var w=new World();w.loadSave(input);',ctx);
const output=vm.runInContext('w.serialize()',ctx);
assert.deepEqual(JSON.parse(JSON.stringify(output.clock)),expected.clock);
assert.equal(Object.keys(output.agents).length,Object.keys(expected.agents).length);
for(const[id,a]of Object.entries(expected.agents))for(const key of ['currentLocation','activity','needs','skills'])assert.deepEqual(JSON.parse(JSON.stringify(output.agents[id][key])),a[key]);
const report={passed:true,population:Object.keys(output.agents).length,fields:['clock','population','currentLocation','activity','needs','skills'],scope:'original JS loadSave only; no live-server or complete economy simulation'};
fs.writeFileSync(path.join(root,'godot/docs/JS_RELOAD_TESTS.json'),json(report));console.log(json(report));

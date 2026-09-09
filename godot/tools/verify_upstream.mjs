import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {root,files,sha,json} from './golden.mjs';
// Preserve historical golden fixtures; verify new source against the existing scoped oracle.
const tracked=execFileSync('git',['ls-files','godot/tests/phase4a','godot/tests/layout','godot/assets/data'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
const before=Object.fromEntries(tracked.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
for(const script of ['phase4a_oracle.mjs','layout_oracle.mjs'])execFileSync(process.execPath,[path.join(root,'godot/tools',script)],{stdio:'inherit'});
for(const [file,hash]of Object.entries(before))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,`Upstream changed scoped oracle: ${file}; inspect before accepting new expectations`);
const upstream=execFileSync('git',['log','-1','--format=%H','--','chrome-extension'],{cwd:root,encoding:'utf8'}).trim();
const version=fs.readFileSync(path.join(root,'chrome-extension/app.js'),'utf8').match(/RIMTOWN_APP_VERSION = '([^']+)'/)[1];
const report={upstream,version,historicalGoldenBase:'47c44406ffe4ef705b5f8988a47e187e42a73602',scopedOracleUnchanged:true,comparedFiles:tracked.length,sources:Object.fromEntries(files.map(f=>[f+'.js',sha(fs.readFileSync(path.join(root,'chrome-extension',f+'.js')))])),scope:'Phase 4a and layout against frozen golden inputs; full World.tick golden remains historical; run test_js_reload.mjs after test_playtest.gd for current JS loadSave compatibility'};
fs.writeFileSync(path.join(root,'godot/docs/UPSTREAM_SYNC.json'),json(report));
console.log(json(report));

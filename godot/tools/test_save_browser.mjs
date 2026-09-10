import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync('godot/scripts/view/main.gd','utf8');
const match=src.match(/JavaScriptBridge\.eval\(("const input=.*?"),true\)/);
if(!match)throw new Error('Browser import adapter not found');
const code=JSON.parse(match[1]);let checks=0;const failures=[];
function check(ok,msg){checks++;if(!ok)failures.push(msg);}
function run(file){let input,reads=0;const received=[];
 const context={document:{createElement(){input={files:file?[file]:[],click(){this.onchange();}};return input;}},window:{rimtownImport(value){received.push(value);}},FileReader:class{readAsDataURL(f){reads++;this.result='data:application/octet-stream;base64,'+Buffer.from(f.bytes).toString('base64');this.onload();}}};
 vm.runInNewContext(code,context);return {input,reads,received};}
for(const bytes of [Buffer.from('{"中文":"保留"}'),Buffer.from('RIMTOWN1\0binary\xff','latin1')]){
 const r=run({bytes,size:bytes.length});check(Buffer.from(r.received[0],'base64').equals(bytes),'browser adapter preserves file bytes');
 check(r.input.accept.includes('.rimtown')&&r.input.accept.includes('.json'),'both extensions offered');}
let r=run({size:67108865,bytes:Buffer.from('x')});check(r.reads===0&&r.received[0]==='too_large','oversize rejected before reading');
r=run(null);check(r.reads===0&&r.received.length===0,'cancel does not import');
const report={checks,failures,scope:'actual shipped browser import JavaScript under mocked DOM/FileReader; UTF-8/binary transport, extensions, limit and cancel; not full Web build validation'};
fs.writeFileSync('godot/docs/SAVE_BROWSER_ADAPTER_TESTS.json',JSON.stringify(report,null,2)+'\n');console.log(report);process.exit(failures.length?1:0);

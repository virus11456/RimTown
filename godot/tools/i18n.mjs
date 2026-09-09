import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {context,root} from './golden.mjs';
const {ctx}=context();const dict=vm.runInContext('I18N.translations',ctx);
const out=path.join(root,'godot/scripts/i18n');fs.mkdirSync(out,{recursive:true});
for(const lang of ['zh_TW','en']){
 let po='msgid ""\nmsgstr ""\n"Language: '+lang+'\\n"\n"Content-Type: text/plain; charset=UTF-8\\n"\n\n';
 for(const [key,value] of Object.entries(dict)){if(key)po+='msgid '+JSON.stringify(key)+'\nmsgstr '+JSON.stringify(lang==='en'?value:key)+'\n\n';}
 fs.writeFileSync(path.join(out,lang+'.po'),po);
}
console.log('Imported original i18n keys:',Object.keys(dict).length);

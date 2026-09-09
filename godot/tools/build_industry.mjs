import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const {ctx}=context();fs.writeFileSync(path.join(root,'godot/assets/data/industry_rules.json'),json(vm.runInContext('({industries:INDUSTRIES,levels:TOWN_LEVELS,synergies:INDUSTRY_SYNERGIES})',ctx)));

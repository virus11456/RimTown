import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const {ctx}=context();const ties=JSON.parse(vm.runInContext('JSON.stringify(CROSS_TOWN_TIES)',ctx));fs.writeFileSync(path.join(root,'godot/assets/data/cross_town_ties.json'),json(ties));console.log(Object.keys(ties).length,'cross-town thought sources');

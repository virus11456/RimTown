import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const {ctx}=context();fs.writeFileSync(path.join(root,'godot/assets/data/building_rules.json'),json(vm.runInContext('({templates:BUILDING_TEMPLATES,upgrades:BUILDING_UPGRADES})',ctx)));

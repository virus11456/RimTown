import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const {ctx}=context();fs.writeFileSync(path.join(root,'godot/assets/data/election_rules.json'),json(vm.runInContext('ELECTION_POLICIES',ctx)));

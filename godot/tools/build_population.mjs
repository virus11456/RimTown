import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const {ctx}=context();fs.writeFileSync(path.join(root,'godot/assets/data/population_rules.json'),json(vm.runInContext('({male:BABY_NAMES_MALE,female:BABY_NAMES_FEMALE,immigrants:IMMIGRANT_POOL,skills:SKILL_CATEGORIES,jobSkills:JOB_SKILL_MAP})',ctx)));

import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {context,root,json} from './golden.mjs';
const {ctx}=context();const data=vm.runInContext('({recipes:JOB_PRODUCTION,seasons:SEASON_FARM_MOD,nature:NATURE_GATHERING,craft:CRAFT_JOB_GOOD,raw:RAW_MATERIALS,industryJobs:Object.fromEntries(Object.entries(INDUSTRIES).map(([k,v])=>[k,v.npcJob])),weather:Object.fromEntries(Object.entries(WEATHER_TYPES).map(([k,v])=>[k,v.farm]))})',ctx);
fs.writeFileSync(path.join(root,'godot/assets/data/economy_rules.json'),json(data));

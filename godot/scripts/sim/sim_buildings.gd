class_name SimBuildings
extends RefCounted
static func rules() -> Dictionary:
	return JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/building_rules.json"))
static func affordable(w: SimWorld,costs: Dictionary) -> bool:
	for key in costs:
		if SimEconomy.amount(w,key)<float(costs[key]): return false
	return true
static func start(w: SimWorld,key: String,upgrade: bool=false,site: Vector2i=Vector2i(-1,-1)) -> Dictionary:
	if site!=Vector2i(-1,-1) and (upgrade or not BuildingSites.allowed(w.data,site)): return {}
	var definitions:=rules();var manager: Dictionary=w.data.buildings
	var template: Dictionary={};var level:=1
	if upgrade:
		var existing: Array=manager.completed.filter(func(p): return p.get("buildingKey")==key)
		if existing.is_empty() or manager.projects.any(func(p): return p.get("upgradeKey")==key): return {}
		level=int(existing[0].get("level",1))+1
		template=definitions.upgrades.get(key,{}).get(str(level),{})
	else:
		template=definitions.templates.get(key,{})
		if template.is_empty(): return {}
		# Also reject a base building after its name has changed through upgrades.
		for p in manager.projects+manager.completed:
			if p.get("buildingKey")==key or p.name==template.name: return {}
	if template.is_empty() or not affordable(w,template.costs): return {}
	for resource in template.costs: SimEconomy.consume(w,resource,float(template.costs[resource]),("升級：" if upgrade else "Building: ")+str(template.name))
	manager._counter=int(manager.get("_counter",0))+1
	var project:={"id":"build_"+str(manager._counter),"name":template.name,"description":template.description,"costs":template.costs.duplicate(true),"workRequired":template.work,"workDone":0,"effects":template.get("effects",{}).duplicate(true),"status":"building"}
	if upgrade:
		project.upgradeKey=key;project.targetLevel=level
		for existing in manager.completed:
			if existing.get("buildingKey")==key and existing.get("siteX")!=null: project.siteX=existing.siteX;project.siteY=existing.siteY;break
	else: project.buildingKey=key
	if site!=Vector2i(-1,-1): project.siteX=site.x;project.siteY=site.y
	manager.projects.append(project)
	SimSocial.log_message(w.data,"building",("開始升級：" if upgrade else "開始建造：")+str(template.name)+"！","","")
	return project
static func daily(w: SimWorld) -> void:
	var manager: Dictionary=w.data.buildings;var done: Array=[]
	for p in manager.projects:
		if p.status!="building": continue
		for a in w.data.agents.values():
			if a.get("isPlayer",false) or a.get("jobKey") not in ["carpenter","miner","blacksmith"]: continue
			var level:=SimWorld.skill_level(float(a.skills.get("建造",{}).get("xp",0))) if a.skills.has("建造") else 0
			p.workDone+=1+floori(float(level)/5)
		if p.workDone>=p.workRequired: p.status="complete";done.append(p)
	for p in done:
		manager.projects.erase(p)
		var upgrade: bool=not str(p.get("upgradeKey","")).is_empty()
		if upgrade:
			for existing in manager.completed:
				if existing.get("buildingKey")==p.upgradeKey:
					existing.level=p.targetLevel;existing.name=p.name;existing.description=p.description;break
		else:
			p.buildingKey=p.get("buildingKey",null);p.level=1;manager.completed.append(p)
		for key in p.effects:
			var value: Variant=p.effects[key]
			manager.activeEffects[key]=manager.activeEffects.get(key,0)+value if value is int or value is float else value
		SimSocial.log_message(w.data,"building",("升級完成：" if upgrade else "建造完成：")+str(p.name)+"！","","")
		if w.data.get("dailyNews") is Dictionary:
			var news: Array=w.data.dailyNews.get("todayEvents",[])
			news.append({"category":"building","content":str(p.name)+("升級完成了！" if upgrade else "建造完成了！"),"importance":7 if upgrade else 6,"agents":[],"time":""});w.data.dailyNews.todayEvents=news
		for a in w.data.agents.values(): SimFeuds._mood(a,w,8 if upgrade else 5)
		if not upgrade and w.combos_enabled: SimCombos.check_new(w)

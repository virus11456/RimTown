class_name SimIndustry
extends RefCounted
static func rules() -> Dictionary:
	return JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/industry_rules.json"))
static func news(w: SimWorld,category: String,text: String,importance: int) -> void:
	if not w.data.get("dailyNews") is Dictionary: return
	var events: Array=w.data.dailyNews.get("todayEvents",[])
	events.append({"category":category,"content":text,"importance":importance,"agents":[],"time":""});w.data.dailyNews.todayEvents=events
static func choose(w: SimWorld,key: String) -> bool:
	var manager: Dictionary=w.data.industry;var defs:=rules()
	if manager.industries.has(key) or manager.industries.size()>=int(manager.maxIndustries) or not defs.industries.has(key): return false
	if manager.get("firstChoice")==null or str(manager.firstChoice).is_empty(): manager.firstChoice=key
	manager.industries[key]={"key":key,"level":1,"workers":[],"dailyOutput":{}}
	manager.needsIndustryChoice=false;manager._pendingUnlock=false
	var def: Dictionary=defs.industries[key]
	SimSocial.log_message(w.data,"industry",str(def.icon)+" 開啟了"+str(def.name)+"！","","")
	news(w,"industry","城鎮開啟了新產業："+str(def.name)+"！",7);return true
static func next_level(w: SimWorld,key: String) -> Dictionary:
	if not w.data.industry.industries.has(key): return {}
	var defs:=rules()
	for level in defs.industries.get(key,{}).get("levels",[]):
		if int(level.lv)==int(w.data.industry.industries[key].level)+1: return level
	return {}
static func upgrade(w: SimWorld,key: String) -> bool:
	var level:=next_level(w,key)
	if level.is_empty() or not SimBuildings.affordable(w,level.cost): return false
	var def: Dictionary=rules().industries[key]
	for resource in level.cost: SimEconomy.consume(w,resource,float(level.cost[resource]),str(def.name)+"升級到 Lv"+str(int(level.lv)))
	w.data.industry.industries[key].level=level.lv
	SimSocial.log_message(w.data,"industry",str(def.icon)+" "+str(def.name)+"升級到 Lv"+str(int(level.lv))+"「"+str(level.name)+"」！","","")
	news(w,"industry",str(def.name)+"升級到了「"+str(level.name)+"」！",6);return true
static func daily(w: SimWorld) -> void:
	var defs:=rules();var manager: Dictionary=w.data.industry
	for level in defs.levels:
		if int(level.lv)>int(manager.townLevel) and w.data.agents.size()>=int(level.population) and w.data.buildings.completed.size()>=int(level.buildings):
			manager.townLevel=level.lv;manager.townLevelName=level.name;manager.maxIndustries=level.unlockSlots
			SimSocial.log_message(w.data,"town","🎉 城鎮升級為「"+str(level.name)+"」！(Lv"+str(int(level.lv))+")","","")
			if manager.industries.size()<int(manager.maxIndustries):
				manager._pendingUnlock=true;SimSocial.log_message(w.data,"town","💡 可以開啟新產業了！("+str(manager.industries.size())+"/"+str(int(manager.maxIndustries))+")","","")
			news(w,"town","城鎮升級為「"+str(level.name)+"」！",8)
	for key in manager.industries:
		var def: Dictionary=defs.industries.get(key,{})
		if def.is_empty(): continue
		var ind: Dictionary=manager.industries[key];var level_def: Dictionary={}
		for level in def.levels:
			if int(level.lv)==int(ind.level): level_def=level;break
		if level_def.is_empty(): continue
		var workers: Array=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false) and a.get("jobKey")==def.npcJob and (a.get("status")==null or a.get("status")=="" or a.get("status")=="normal"))
		var count:=mini(workers.size(),int(level_def.workers));var efficiency:=float(count)/float(level_def.workers) if count>0 else .3
		var multiplier:=1.0
		for synergy in defs.synergies:
			if not synergy.keys.all(func(k): return manager.industries.has(k)): continue
			multiplier+=float(synergy.effects.get("all_bonus",0))
			if key=="farming": multiplier+=float(synergy.effects.get("farm_bonus",0))
			if key=="mining": multiplier+=float(synergy.effects.get("gather_bonus",0))
		ind.dailyOutput={}
		for resource in level_def.output:
			var produced:=floorf(float(level_def.output[resource])*efficiency*multiplier*10+.5)/10
			ind.dailyOutput[resource]=SimSupply.produce(w,resource,produced,str(def.name)+" Lv"+str(int(ind.level)),str(def.name))

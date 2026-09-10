class_name SimNPCQuests
extends RefCounted
static func init(w: SimWorld) -> void:
	SimQuests.init(w)
	if not w.data.get("npcQuests") is Dictionary: w.data.npcQuests={}
	w.data.npcQuests.merge(SimQuests.rules().npcInitial.duplicate(true),false)
static func definition(id: String) -> Dictionary:
	for npc in SimQuests.rules().personal.values():
		for def in npc.quests:
			if def.id==id: return def
	return {}
static func daily(w: SimWorld) -> void:
	if not w.quests_enabled: return
	init(w);var q: Dictionary=w.data.npcQuests
	if q._lastCheckDay==w.data.clock.day and q._lastCheckYear==w.data.clock.year: return
	q._lastCheckDay=w.data.clock.day;q._lastCheckYear=w.data.clock.year
	check_progress(w)
static func check_progress(w: SimWorld) -> void:
	if not w.quests_enabled or not w.data.agents.has("player"): return
	init(w);var q: Dictionary=w.data.npcQuests;var rules:=SimQuests.rules()
	for npc_id in rules.personal:
		var npc_data: Dictionary=rules.personal[npc_id]
		if not w.data.agents.has(npc_id): continue
		for def in npc_data.quests:
			if q.quests.has(def.id): continue
			var gate: Dictionary=def.trigger
			if SimQuests.evaluate(w,{"type":"npc_affinity","npcId":npc_id})<float(gate.get("affinity",0)) or SimQuests.chapter(w)<int(gate.get("chapter",1)): continue
			if gate.has("requireFlag") and not q.storyFlags.get(gate.requireFlag,false): continue
			var routes: Array=[]
			for route in def.routes:
				var entry:={"id":route.id,"label":route.label,"icon":route.get("icon","📋"),"description":route.get("description",""),"conditions":route.conditions.duplicate(true)}
				for c in entry.conditions: c.progress=0;c.completed=false
				routes.append(entry)
			q.quests[def.id]={"status":"active","npcId":npc_id,"title":def.title,"description":def.description,"icon":def.get("icon","📋"),"routes":routes,"rewards":def.get("rewards",{}).duplicate(true),"completedRoute":null,"triggeredDay":w.data.clock.day,"triggeredYear":w.data.clock.year}
			SimQuests.log_event(w,"💫 "+str(npc_data.name)+"的個人任務「"+str(def.title)+"」已觸發！")
			news(w,str(npc_data.name)+"似乎有事情想找人幫忙...",6,str(npc_data.name))
	for id in q.quests:
		var state: Dictionary=q.quests[id]
		if state.status!="active": continue
		var def:=definition(id)
		if def.is_empty(): continue
		for route in state.routes:
			var done:=true
			for c in route.conditions:
				if c.completed: continue
				c.progress=SimQuests.evaluate(w,c,true);c.completed=c.progress>=float(c.get("target",1))
				if not c.completed: done=false
			if done: complete(w,id,def,route);break
	for id in rules.bindings:
		var binding: Dictionary=rules.bindings[id]
		for tier in binding.tiers:
			var flag:="_tier_"+str(id)+"_"+str(int(tier.affinity))
			if SimQuests.evaluate(w,{"type":"npc_affinity","npcId":id})>=float(tier.affinity) and float(tier.get("bonus",0))!=0 and not q.storyFlags.get(flag,false):
				q.storyFlags[flag]=true;q.industryBonuses[binding.industry]=float(q.industryBonuses.get(binding.industry,0))+float(tier.bonus)
				SimQuests.log_event(w,"📈 "+str(rules.personal.get(id,{}).get("name",id))+"的好感度效果："+str(tier.desc),"industry")
static func news(w: SimWorld,text: String,importance: int,name: String) -> void:
	SimIndustry.news(w,"quest",text,importance)
	if w.data.get("dailyNews") is Dictionary: w.data.dailyNews.todayEvents.back().agents=[name]
static func complete(w: SimWorld,id: String,def: Dictionary,route: Dictionary) -> void:
	var q: Dictionary=w.data.npcQuests;var state: Dictionary=q.quests[id]
	if state.status!="active": return
	state.status="completed";state.completedRoute=route.id
	var outcome: Dictionary=def.get("outcomes",{}).get(route.id,{})
	if outcome.has("flag"): q.storyFlags[outcome.flag]=true
	for npc_id in outcome.get("mood",{}):
		if w.data.agents.has(npc_id): SimFeuds._mood(w.data.agents[npc_id],w,float(outcome.mood[npc_id]))
	w.data.questSystem.reputation+=float(outcome.get("reputation",0))
	for key in outcome.get("industryBonus",{}): q.industryBonuses[key]=float(q.industryBonuses.get(key,0))+float(outcome.industryBonus[key])
	if outcome.has("townMoodBonus"):
		for a in w.data.agents.values():
			if not a.get("isPlayer",false): SimFeuds._mood(a,w,float(outcome.townMoodBonus))
	SimQuests.reward(w,def.get("rewards",{}),"任務獎勵："+str(def.title))
	q.chainUnlocks.append_array(def.get("unlocks",[]))
	var name: String=SimQuests.rules().personal.get(state.npcId,{}).get("name",state.npcId)
	SimQuests.log_event(w,"🎉 完成了"+name+"的個人任務「"+str(def.title)+"」！（"+str(route.get("icon",""))+" "+str(route.label)+"）")
	if def.get("onComplete","")!="": SimQuests.log_event(w,"📖 "+str(def.onComplete))
	news(w,name+"的心願「"+str(def.title)+"」達成了！",8,name)

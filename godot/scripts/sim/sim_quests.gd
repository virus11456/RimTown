class_name SimQuests
extends RefCounted
static var cached: Dictionary={}
static func rules() -> Dictionary:
	if cached.is_empty(): cached=JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/quest_rules.json"))
	return cached
static func init(w: SimWorld) -> void:
	if not w.data.get("questSystem") is Dictionary: w.data.questSystem={}
	var q: Dictionary=w.data.questSystem
	q.merge(rules().initial.duplicate(true),false)
	for pair in [["main","quests"],["side","sideQuests"]]:
		for def in rules()[pair[0]]:
			if not q[pair[1]].has(def.id): q[pair[1]][def.id]={"status":"active" if def.id=="ch1_settle" else "locked"}
			var state: Dictionary=q[pair[1]][def.id]
			if pair[0]=="main" and not state.has("completedRoute"): state.completedRoute=null
			if def.has("objectives") and not state.has("objectives"):
				state.objectives={}
				for obj in def.objectives: state.objectives[obj.id]={"progress":0,"completed":false}
			if def.has("routes") and not state.has("routes"):
				state.routes={}
				for route in def.routes:
					state.routes[route.id]={}
					for cond in route.conditions: state.routes[route.id][cond.label]={"progress":0,"completed":false}
	var migrations:={"ch1_food":"ch1_survive","ch2_build":"ch2_economy","ch2_pop":"ch2_community","ch3_trade":"ch3_crisis","ch3_factory":"ch3_rebuild","ch3_townlv":"ch3_rebuild","ch4_friendship":"ch4_bonds","ch4_defense":"ch4_bonds","ch5_prosper":"ch5_legacy"}
	for old in migrations:
		if q.quests.get(old,{}).get("status")=="completed" and q.quests[migrations[old]].status=="locked": q.quests[migrations[old]].status="active"
	if q.quests.ch1_settle.status=="locked": q.quests.ch1_settle.status="active"
	for pair in [["ch1_settle","ch1_survive"],["ch1_industry","ch2_economy"]]:
		if q.quests[pair[0]].status=="completed" and q.quests[pair[1]].status=="locked": q.quests[pair[1]].status="active"
static func chat_context(w: SimWorld,id: String) -> String:
	if not w.quests_enabled: return ""
	init(w);var hints: Array=[]
	var affinity:=evaluate(w,{"type":"npc_affinity","npcId":id})
	for def in rules().main:
		if w.data.questSystem.quests[def.id].status!="active": continue
		hints.append({"activeQuest":def.title,"description":def.description})
		var hint: Dictionary=def.get("npcHints",{}).get(id,{})
		if affinity>=float(hint.get("minAffinity",999)) and hint.has("hint"): hints.append({"hint":hint.hint})
	for q in w.data.get("npcQuests",{}).get("quests",{}).values():
		if q.npcId==id and q.status=="active": hints.append({"personalQuest":q.title,"description":q.description})
	return JSON.stringify(hints).left(1200)
static func chapter(w: SimWorld) -> int:
	init(w)
	for def in rules().main:
		if w.data.questSystem.quests[def.id].status=="active": return int(def.chapter)
	var result:=1
	for id in w.data.questSystem.completedOrder:
		for def in rules().main:
			if def.id==id: result=int(def.chapter)
	return result
static func count(w: SimWorld,key: String) -> void:
	if not w.quests_enabled: return
	init(w);w.data.questSystem[key]=int(w.data.questSystem.get(key,0))+1
static func evaluate(w: SimWorld,c: Dictionary,personal:=false) -> float:
	var q: Dictionary=w.data.questSystem
	if personal and c.type not in ["resource","npc_affinity","chat_with","chat_count","talk_to","report_back","population","avg_affinity","friends_count","building_count","industry_count","relationship"]: return 0
	var rels: Dictionary=w.data.agents.get("player",{}).get("relationships",{})
	var history: Array=w.data.agents.get("player",{}).get("chatHistory",[])
	var npc_name: String=str(w.data.agents.get(c.get("npcId",""),{}).get("name","__missing__"))
	match c.type:
		"chat_count": return history.size() if personal else q.chatCount
		"resource", "resource_reach": return SimEconomy.amount(w,c.resource)
		"industry_count": return w.data.industry.industries.size()
		"industry_specific": return 1 if w.data.industry.industries.has(c.industry) else 0
		"building_count": return w.data.buildings.completed.size()
		"population": return w.data.agents.size()
		"harvest_count": return q.harvestCount
		"trade_count": return q.tradeCount
		"factory_count": return w.data.processing.get("builtFactories",{}).values().filter(func(f): return f.status=="active").size()
		"town_level": return w.data.industry.townLevel
		"election_count": return q.electionsHeld
		"raid_survived": return q.raidsSurvived
		"reputation": return q.reputation
		"npc_affinity", "relationship": return float(rels.get(c.npcId,{}).get("affinity",0))
		"friends_count": return rels.values().filter(func(r): return float(r.get("affinity",0))>=30 if personal else float(r.get("affinity",0))>20).size()
		"max_affinity":
			var value:=0.0
			for r in rels.values(): value=maxf(value,float(r.get("affinity",0)))
			return value
		"avg_affinity":
			var total:=0.0
			for r in rels.values(): total+=float(r.get("affinity",0))
			return floorf(total/rels.size()+.5) if not rels.is_empty() else 0
		"chat_with": return floorf(history.filter(func(m): return m.get("target")==npc_name or m.get("speaker")==npc_name).size()/2.0)
		"talk_to", "report_back":
			if c.type=="report_back": history=history.slice(-20)
			return 1 if history.any(func(m): return m.get("target")==npc_name or m.get("speaker")==npc_name) else 0
	return 0
static func log_event(w: SimWorld,text: String,kind: String="quest") -> void:
	SimSocial.log_message(w.data,kind,text,"","")
static func reward(w: SimWorld,rewards: Dictionary,reason: String) -> void:
	for key in rewards:
		if key=="reputation": w.data.questSystem.reputation+=rewards[key]
		else: SimEconomy.change(w,key,float(rewards[key]),reason)
static func conditions(w: SimWorld,defs: Array,states: Dictionary,key: String) -> bool:
	var done:=true
	for c in defs:
		if not states.has(c[key]): done=false;continue
		var state: Dictionary=states[c[key]]
		if state.completed: continue
		state.progress=minf(evaluate(w,c),float(c.get("target",1)));state.completed=state.progress>=float(c.get("target",1))
		if not state.completed: done=false
	return done
static func complete(w: SimWorld,def: Dictionary,route: Dictionary={}) -> void:
	var q: Dictionary=w.data.questSystem;var state: Dictionary=q.quests[def.id]
	if state.status!="active": return
	state.status="completed";q.completedOrder.append(def.id)
	if not route.is_empty(): state.completedRoute=route.id
	reward(w,def.get("rewards",{}),"任務獎勵："+str(def.title))
	q.storyFlags[def.id]={"completedRoute":route.get("id","default"),"day":w.data.clock.day,"year":w.data.clock.year}
	var suffix: String="（"+str(route.label)+"）" if not route.is_empty() else ""
	log_event(w,"⚔️ 主線任務完成：「"+str(def.title)+"」"+suffix+"！"+str(def.get("onComplete","")))
	SimIndustry.news(w,"quest","主線任務「"+str(def.title)+"」"+suffix+"完成！"+str(def.get("onComplete","")),8)
	if def.get("isFinale",false): SimEndings.trigger(w,str(route.get("id","prosper")))
	var unlocks: Variant=def.get("unlocks",[])
	if unlocks is String: unlocks=[unlocks]
	for id in unlocks:
		if not q.quests.has(id) or q.quests[id].status!="locked": continue
		q.quests[id].status="active"
		for next in rules().main:
			if next.id!=id: continue
			log_event(w,"📜 新任務解鎖：「"+str(next.title)+"」")
			if next.get("isCrisis",false) and q.activeCrisis==null:
				q.activeCrisis=w.rng.pick(next.get("crisisTypes",["locust","bandit","plague"]))
				var name: String={"locust":"蝗災","bandit":"盜匪圍城","plague":"瘟疫"}.get(q.activeCrisis,q.activeCrisis)
				log_event(w,"⚠️ 危機降臨："+name+"！");SimIndustry.news(w,"crisis","重大危機！"+name+"威脅著小鎮的生存！",10)
static func check_progress(w: SimWorld) -> void:
	if not w.quests_enabled or w.data.get("townTheme","")=="harbor": return
	init(w);var q: Dictionary=w.data.questSystem
	for def in rules().main:
		var state: Dictionary=q.quests[def.id]
		if state.status!="active": continue
		if def.has("routes"):
			for route in def.routes:
				if conditions(w,route.conditions,state.routes[route.id],"label"): complete(w,def,route);break
		elif conditions(w,def.get("objectives",[]),state.get("objectives",{}),"id"): complete(w,def)
	for def in rules().side:
		var state: Dictionary=q.sideQuests[def.id]
		if state.status=="locked":
			var gate: Dictionary=def.get("trigger",{});var ready:=not gate.is_empty()
			if gate.has("mainQuest") and q.quests.get(gate.mainQuest,{}).get("status","") not in ["active","completed"]: ready=false
			for id in gate.get("npcAffinity",{}):
				if evaluate(w,{"type":"npc_affinity","npcId":id})<float(gate.npcAffinity[id]): ready=false
			if ready:
				state.status="active";log_event(w,"📜 支線任務解鎖：「"+str(def.title)+"」")
				if def.get("story","")!="": log_event(w,"📖 "+str(def.story))
		elif state.status=="active" and conditions(w,def.get("objectives",[]),state.objectives,"id"):
			state.status="completed";q.sideCompletedOrder.append(def.id);reward(w,def.get("rewards",{}),"支線獎勵："+str(def.title))
			log_event(w,"✨ 支線任務完成：「"+str(def.title)+"」！")
			if def.get("onComplete","")!="": log_event(w,"📖 "+str(def.onComplete))
			SimIndustry.news(w,"quest","支線任務「"+str(def.title)+"」完成！",6)
	daily(w)
	for def in rules().stories:
		if def.id in q.triggeredStoryEvents: continue
		var gate: Dictionary=def.trigger
		var ready: bool=(gate.has("tickCount") and w.data.tickCount>=gate.tickCount) or (gate.has("population") and w.data.agents.size()>=gate.population) or (gate.has("max_affinity") and evaluate(w,{"type":"max_affinity"})>=gate.max_affinity) or (gate.has("harvestCount") and q.harvestCount>=gate.harvestCount) or (gate.has("storyFlag") and q.storyFlags.has(gate.storyFlag))
		if ready: q.triggeredStoryEvents.append(def.id);log_event(w,str(def.icon)+" 【"+str(def.title)+"】"+str(def.text),"event");break
static func daily(w: SimWorld) -> void:
	var q: Dictionary=w.data.questSystem;var day:=SimClock.total_days(w.data.clock)
	# At most one repeatable reward per calendar day in the balanced game.
	if w.supply_enabled and int(w.quest_balance.get("daily_claim_day",-1))==day: return
	if q.dailyObjective==null or q.dailyObjective.get("completed",false):
		var candidates: Array=rules().daily.filter(func(d): return int(d.chapter)<=chapter(w) and d.id not in q.dailyCompletedIds)
		if candidates.is_empty(): q.dailyCompletedIds=[];return
		var def: Dictionary=w.rng.pick(candidates)
		q.dailyObjective={"id":def.id,"startValue":evaluate(w,def.condition),"completed":false};return
	for def in rules().daily:
		if def.id!=q.dailyObjective.id: continue
		if evaluate(w,def.condition)-float(q.dailyObjective.get("startValue",0))>=float(def.condition.target):
			q.dailyObjective.completed=true;q.dailyCompletedIds.append(def.id);w.quest_balance.daily_claim_day=day
			reward(w,def.get("reward",{}),"每日目標獎勵");log_event(w,"⭐ 每日目標完成："+str(def.icon)+" "+str(def.text)+"！")

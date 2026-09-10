class_name SimLifeGoals
extends RefCounted
static func pick(w: SimWorld,a: Dictionary) -> String:
	var scores:={"truelove":0,"entrepreneur":0,"master":0,"adventurer":0,"family":0,"legacy":0}
	var weights:={"財富":{"entrepreneur":3},"知識":{"master":2},"藝術":{"master":3},"家庭":{"family":3,"truelove":1},"冒險":{"adventurer":3},"自由":{"adventurer":2},"權力":{"legacy":3},"榮譽":{"legacy":2},"社群":{"legacy":1},"和平":{"legacy":1}}
	for value in a.personality.get("values",[]):
		for key in weights.get(value,{}): scores[key]+=weights[value][key]
	for entry in [["romantic","truelove",3],["creative","master",2],["hardworking","entrepreneur",1],["charismatic","legacy",1]]:
		if entry[0] in a.personality.get("traits",[]): scores[entry[1]]+=entry[2]
	var job: String=SimPlayerChat.job(w,a).get("key","")
	var jobs:={"blacksmith":"master","tailor":"master","carpenter":"master","cook":"master","doctor":"master","researcher":"master","trader":"entrepreneur","guard":"legacy","priest":"legacy"}
	if jobs.has(job): scores[jobs[job]]+=2
	if a.get("relationships",{}).values().any(func(r): return r.get("status") in ["dating","married"]): scores.family+=2
	elif a.age<35: scores.truelove+=1
	var best:="truelove"
	for key in scores:
		if scores[key]>scores[best]: best=key
	return best if scores[best]>0 else str(w.rng.pick(["truelove","adventurer","master"]))
static func assign(w: SimWorld) -> void:
	if not w.data.get("lifeGoals") is Dictionary: w.data.lifeGoals={"goals":{}}
	if not w.data.lifeGoals.get("goals") is Dictionary: w.data.lifeGoals.goals={}
	for a in w.data.agents.values():
		if not a.get("isPlayer",false) and not a.get("isDead",false) and not w.data.lifeGoals.goals.has(a.id): w.data.lifeGoals.goals[a.id]={"key":pick(w,a),"stage":0,"stageStartDay":SimClock.total_days(w.data.clock),"done":false}
	for g in w.data.lifeGoals.goals.values():
		var def: Dictionary=SimQuests.rules().goals.get(g.get("key",""),{})
		if not def.is_empty() and int(g.get("stage",0))>=def.stages.size()-1: g.done=true
static func ready(w: SimWorld,a: Dictionary,g: Dictionary) -> bool:
	var stage:=int(g.stage);var rels: Array=a.get("relationships",{}).values();var score:=float(w.data.get("prosperity",{}).get("score",w.data.get("prosperity",{}).get("prosperity",0)))
	match g.key:
		"adventurer": return true
		"truelove":
			rels=rels.filter(func(r): return w.data.agents.has(r.targetId) and not w.data.agents[r.targetId].get("isPlayer",false))
			return rels.any(func(r): return float(r.get("romanticInterest",0))>40 if stage==0 else (r.get("status") in ["dating","married"] if stage==1 else r.get("status")=="married")) if stage<3 else false
		"entrepreneur": return (score>15 or SimEconomy.amount(w,"silver")>120) if stage==0 else ((score>30 or SimEconomy.amount(w,"silver")>250) if stage==1 else (score>45 or w.data.buildings.completed.any(func(b): return b.get("buildingKey")=="marketplace"))) if stage<3 else false
		"master":
			var level:=0
			for key in ["工藝","藝術","烹飪","醫療","智識","建造","種植"]: level=maxi(level,SimWorld.skill_level(float(a.skills.get(key,{}).get("xp",0))))
			return level>=[6,10,15,99][mini(stage,3)]
		"family":
			if stage==0: return rels.any(func(r): return r.get("status") in ["dating","married"])
			if stage==1: return rels.any(func(r): return r.get("status")=="married")
			return w.data.get("lifecycle",{}).get("births",[]).any(func(b): return a.name in b.get("parentNames",[])) if stage==2 else false
		"legacy":
			var council: bool=a.id in w.data.get("council",{}).get("members",[])
			return score>20 if stage==0 else ((score>40 or council) if stage==1 else (score>60 and council)) if stage<3 else false
	return false
static func daily(w: SimWorld) -> void:
	if not w.quests_enabled: return
	assign(w)
	for a in w.data.agents.values():
		if a.get("isPlayer",false) or a.get("isDead",false): continue
		var g: Dictionary=w.data.lifeGoals.goals[a.id];var def: Dictionary=SimQuests.rules().goals.get(g.key,{})
		if g.done or def.is_empty() or SimClock.total_days(w.data.clock)-int(g.stageStartDay)<6 or not ready(w,a,g): continue
		if w.rng.next_float()>=(.18 if g.key=="adventurer" else .5): continue
		g.stage+=1;g._nudged=false;g.stageStartDay=SimClock.total_days(w.data.clock)
		# The final named stage is completion; original checked one stage beyond it.
		g.done=int(g.stage)>=def.stages.size()-1
		if g.done: g.doneDay=g.stageStartDay
		var name: String=def.stages[mini(int(g.stage),def.stages.size()-1)]
		var text: String=w.rng.pick([str(def.icon)+" 我做到了!「"+str(def.name)+"」——這一路走來,值得了。",str(def.icon)+" 夢想成真的這一刻,我會記得一輩子。"+name+"!"] if g.done else [str(def.icon)+" 離夢想又近了一步:"+name+"。繼續加油!","今天達成了「"+name+"」,朝著"+str(def.name)+"前進中 💪"])
		var thought_kind:="dream_achieved" if g.done else "dream_progress"
		a.thoughts=a.get("thoughts",[]).filter(func(t): return t.kind!=thought_kind)
		a.thoughts.append({"kind":thought_kind,"label":"實現了畢生夢想" if g.done else "離夢想更近了","mood":20 if g.done else 8,"opinion":0,"days":10 if g.done else 3,"start":SimClock.total_days(w.data.clock)})
		if w.data.get("townFeed") is Dictionary: SimGossip._post(w.data,a,text)
		SimFeuds._memory(a,w,"milestone","人生里程碑:"+name+"("+str(def.name)+")",10 if g.done else 7,[])
		SimSocial.log_message(w.data,"milestone",str(def.icon)+" "+str(a.name)+"的夢想「"+str(def.name)+"」邁入:"+name+("(達成!)" if g.done else ""),a.name,"")
		SimIndustry.news(w,"milestone",str(a.name)+("實現了畢生夢想「"+str(def.name) if g.done else "朝夢想邁進:「"+name)+"」",8 if g.done else 5)
		if g.done:
			for resident in w.data.agents.values(): SimFeuds._mood(resident,w,4)
static func nudge(w: SimWorld,id: String) -> bool:
	assign(w)
	var g: Dictionary=w.data.lifeGoals.goals.get(id,{})
	if g.is_empty() or g.done or g.get("_nudged",false): return false
	g.stageStartDay=mini(int(g.stageStartDay),SimClock.total_days(w.data.clock)-6);g._nudged=true
	var npc: Dictionary=w.data.agents[id]
	if w.data.agents.has("player"): SimRelationships.modify(SimSocial.relationship(npc,w.data.agents.player),"affinity",4)
	SimFeuds._memory(npc,w,"social","旅人支持我的夢想,好感動!",6,["player"])
	SimSocial.log_message(w.data,"milestone","✨ 旅人為"+str(npc.name)+"的夢想「"+str(SimQuests.rules().goals[g.key].name)+"」加了一把勁!",npc.name,"")
	return true

class_name SimEndings
extends RefCounted
static func trigger(w: SimWorld,route: String) -> void:
	if not w.data.get("multiEnding") is Dictionary: w.data.multiEnding={"endingTriggered":null,"endingData":null,"townHistory":[]}
	var manager: Dictionary=w.data.multiEnding
	if manager.get("endingTriggered")!=null or not SimQuests.rules().endings.has(route): return
	var rels: Array=w.data.agents.get("player",{}).get("relationships",{}).values()
	if route!="legend" and rels.any(func(r): return r.get("status")=="married"): route="personal"
	manager.endingTriggered=route
	var history: Array=[]
	for def in SimQuests.rules().main:
		if w.data.questSystem.quests.get(def.id,{}).get("status")=="completed": history.append({"type":"quest","time":"","content":"完成任務："+str(def.title)})
	for q in w.data.get("npcQuests",{}).get("quests",{}).values():
		if q.status=="completed": history.append({"type":"personal","time":"","content":q.title})
	for paper in w.data.get("dailyNews",{}).get("newspapers",[]).slice(-30):
		if paper.get("headline","")!="": history.append({"type":"news","time":paper.get("dateStr",""),"content":paper.headline})
	for mem in w.data.agents.get("player",{}).get("memory",[]).filter(func(m): return float(m.get("importance",0))>=7).slice(-20): history.append({"type":"memory","time":mem.get("timeStr",""),"content":mem.content})
	manager.endingData={"type":SimQuests.rules().endings[route].duplicate(true),"triggeredDay":w.data.clock.day,"triggeredYear":w.data.clock.year,"triggeredSeason":w.data.clock.season,"stats":stats(w),"history":history.slice(0,50)}
	SimQuests.log_event(w,"🎊 恭喜！達成「"+str(manager.endingData.type.title)+"」！","system")
static func stats(w: SimWorld) -> Dictionary:
	var player: Dictionary=w.data.agents.get("player",{});var rels: Array=player.get("relationships",{}).values()
	var sorted: Array=rels.duplicate();sorted.sort_custom(func(a,b): return float(a.affinity)>float(b.affinity))
	var spouse: Array=rels.filter(func(r): return r.get("status")=="married")
	var children: Array=w.data.agents.values().filter(func(a): return a.get("_isPlayerChild",false))
	var graveyard: Array=w.data.get("lifecycle",{}).get("graveyard",[])
	var skills: Array=[];var total:=0;var memories: Dictionary={}
	for key in player.get("skills",{}):
		var s: Dictionary=player.skills[key];var level:=SimWorld.skill_level(float(s.get("xp",0)))
		skills.append({"key":key,"level":level,"xp":s.get("xp",0),"passion":s.get("passion",0)});total+=level
	skills.sort_custom(func(a,b): return a.level>b.level)
	for m in player.get("memory",[]): memories[m.category]=int(memories.get(m.category,0))+1
	return {"totalDays":SimClock.total_days(w.data.clock)+1,"year":w.data.clock.year,"season":w.data.clock.season,"population":w.data.agents.size(),"friendsCount":rels.filter(func(r): return r.affinity>=30).size(),"enemiesCount":rels.filter(func(r): return r.affinity<=-30).size(),"bestFriend":null if sorted.is_empty() else {"name":sorted[0].targetName,"affinity":sorted[0].affinity},"worstEnemy":null if sorted.is_empty() or sorted.back().affinity>=-10 else {"name":sorted.back().targetName,"affinity":sorted.back().affinity},"spouse":null if spouse.is_empty() else {"name":spouse[0].targetName},"exCount":rels.filter(func(r): return r.get("status")=="ex").size(),"datingCount":rels.filter(func(r): return r.get("status")=="dating").size(),"cheatingCount":rels.filter(func(r): return r.get("isCheating",false)).size(),"childrenCount":children.size(),"childrenNames":children.map(func(a): return a.name),"romanceCount":rels.filter(func(r): return r.romanticInterest>30).size(),"totalRelationships":rels.size(),"topRelationships":sorted.slice(0,5).map(func(r): return {"name":r.targetName,"affinity":r.affinity,"status":r.get("status"),"romantic":r.romanticInterest}),"prosperity":w.data.get("prosperity",{}).get("prosperity",0),"prosperityLevel":w.data.get("prosperity",{}).get("level","未知"),"silver":SimEconomy.amount(w,"silver"),"food":SimEconomy.amount(w,"food"),"townLevel":w.data.industry.townLevel,"industries":w.data.industry.industries.size(),"buildings":w.data.buildings.completed.size(),"questsCompleted":w.data.questSystem.completedOrder.size(),"npcQuestsCompleted":w.data.get("npcQuests",{}).get("quests",{}).values().filter(func(q): return q.status=="completed").size(),"reputation":w.data.questSystem.reputation,"customNPCs":w.data.get("customNPC",{}).get("customNPCs",[]).size(),"deathCount":graveyard.size(),"graveyardNames":graveyard.slice(-10).map(func(g): return g.name),"playerSkills":skills,"totalSkillLevel":total,"playerJob":SimPlayerChat.job(w,player).get("title","無業"),"playerAge":player.get("age",0),"playerName":player.get("name","旅人"),"playerTraits":player.get("personality",{}).get("traits",[]),"memoryCounts":memories}

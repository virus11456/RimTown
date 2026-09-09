class_name SimResearch
extends RefCounted
static func start(w: SimWorld,key: String) -> bool:
	var research: Dictionary=w.data.research
	if not research.projects.has(key) or research.projects[key].status!="available": return false
	var current: Variant=research.get("current")
	if current!=null and research.projects.has(current) and research.projects[current].status=="researching": research.projects[current].status="available"
	research.projects[key].status="researching";research.current=key;return true
static func daily(w: SimWorld) -> void:
	var research: Dictionary=w.data.research
	if research.get("current")==null or str(research.current).is_empty():
		for p in research.projects.values():
			if p.status=="available": start(w,p.key);break
		return
	var points:=0.0
	for a in w.data.agents.values():
		if not a.get("isPlayer",false) and SimPlayerChat.job(w,a).get("title")=="研究員":
			var level:=SimWorld.skill_level(float(a.skills.get("智識",{}).get("xp",0))) if a.skills.has("智識") else 0
			points+=3+level*.5
	points*=1+float(w.data.get("news",{}).get("activeModifiers",{}).get("research_bonus",0))
	var bonus:=minf(SimEconomy.amount(w,"research_points"),5)
	if bonus>0: SimEconomy.consume(w,"research_points",bonus,"research")
	if points+bonus<=0: return
	var project: Dictionary=research.projects.get(research.current,{})
	if project.is_empty() or project.status!="researching": return
	project.progress+=points+bonus
	if project.progress<project.cost: return
	project.status="complete";research.current=null
	for key in project.effects:
		var value: Variant=project.effects[key]
		w.data.buildings.activeEffects[key]=w.data.buildings.activeEffects.get(key,0)+(value if value is int or value is float else 0)
	for p in research.projects.values():
		if p.status=="locked" and p.prerequisites.all(func(pre): return research.projects.has(pre) and research.projects[pre].status=="complete"): p.status="available"
	SimSocial.log_message(w.data,"research","研究完成："+str(project.name)+"！","","")
	for a in w.data.agents.values(): SimFeuds._mood(a,w,3)

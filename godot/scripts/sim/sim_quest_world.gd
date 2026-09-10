class_name SimQuestWorld
extends RefCounted
## World inputs used by quests. Council proposals and mortality remain separate systems.
static func daily(w: SimWorld) -> void:
	if not w.quests_enabled: return
	prosperity(w);council(w)
static func prosperity(w: SimWorld) -> void:
	var p: Dictionary=w.data.get("prosperity",{})
	if not p.get("dimensions") is Dictionary: return
	if p.get("_lastUpdateDay",-1)==w.data.clock.day and p.get("_lastUpdateYear",-1)==w.data.clock.year: return
	p._lastUpdateDay=w.data.clock.day;p._lastUpdateYear=w.data.clock.year;p._townAgeDays=int(p.get("_townAgeDays",0))+1
	var industries: Array=w.data.industry.industries.values();var level_total:=0.0
	for ind in industries: level_total+=float(ind.get("level",1))
	var economy:=minf(15,SimEconomy.amount(w,"food")/10)+minf(10,SimEconomy.amount(w,"silver")/30)+minf(5,SimEconomy.amount(w,"wood")/20)+industries.size()*5
	economy+=minf(20,level_total/industries.size()*4) if not industries.is_empty() else 0
	economy+=minf(15,w.data.processing.get("builtFactories",{}).values().filter(func(f): return f.status=="active").size()*5)+minf(15,float(w.data.questSystem.tradeCount)*1.5)
	p.dimensions.economy.value=minf(100,economy)
	p.dimensions.buildings.value=minf(100,minf(40,w.data.buildings.completed.size()*3)+minf(60,float(w.data.industry.townLevel)*8.5))
	var npcs: Array=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false))
	var partnered:=0;var mood:=0.0;var guards:=0;var priest:=false;var researcher:=false
	for a in npcs:
		if a.get("relationships",{}).values().any(func(r): return r.get("status") in ["dating","married"]): partnered+=1
		mood+=float(a.get("mood",0))
	for a in w.data.agents.values():
		var job: String=SimPlayerChat.job(w,a).get("key","")
		if job=="guard": guards+=1
		if job=="priest": priest=true
		if job=="researcher": researcher=true
	p.dimensions.population.value=minf(100,minf(70,w.data.agents.size()*3)+(minf(15,float(partnered)/npcs.size()*30) if not npcs.is_empty() else 0)+minf(15,float(w.data.get("lifecycle",{}).get("totalBirths",0))*5))
	var rels: Array=w.data.agents.get("player",{}).get("relationships",{}).values();var affinity:=0.0
	for r in rels: affinity+=float(r.get("affinity",0))
	p.dimensions.happiness.value=0 if npcs.is_empty() else minf(100,clampf(mood/npcs.size()+50,0,100)+(minf(20,maxf(0,affinity/rels.size()*.5)) if not rels.is_empty() else 0))
	p.dimensions.culture.value=minf(100,minf(30,float(w.data.questSystem.electionsHeld)*15)+minf(30,w.data.get("festivals",{}).get("completedFestivals",[]).size()*10)+(20 if priest else 0)+(20 if researcher else 0))
	var defenses: int=w.data.buildings.completed.filter(func(b): return b.get("key") in ["wall","watchtower","barracks"]).size()
	p.dimensions.defense.value=minf(100,minf(30,guards*15)+minf(30,float(w.data.questSystem.raidsSurvived)*10)+minf(40,defenses*13))
	var flowers: int=w.data.farm.plots.filter(func(f): return f.state in ["growing","ready"] and f.get("crop")=="flowers").size()
	var gardens: int=w.data.buildings.completed.filter(func(b): return b.get("key") in ["garden","fountain","statue","park"]).size()
	var decor:=0.0
	for d in w.data.get("decorations",[]): decor+=float({"flowerbed":2,"bench":2,"lamp":3,"statue":6,"fountain":8}.get(d.type,2))
	p.dimensions.beauty.value=minf(100,minf(40,flowers*10)+minf(30,gardens*10)+minf(35,decor)+minf(20,SimCombos.active(w.data).size()*4)+minf(30,float(w.data.industry.townLevel)*4))
	var total:=0.0
	for d in p.dimensions.values(): total+=float(d.value)*float(d.weight)
	p.prosperity=floorf(clampf(total,0,100)+.5)
	if p._townAgeDays<=5: p.prosperity=minf(p.prosperity,float(p._townAgeDays)*8)
	p.level="傳奇" if p.prosperity>=80 else ("繁榮" if p.prosperity>=60 else ("發展中" if p.prosperity>=40 else ("起步" if p.prosperity>=20 else "荒涼")))
	w.data.prosperity=p
	w.quest_balance.target_population=30 if p.prosperity>=80 else (22 if p.prosperity>=60 else (17 if p.prosperity>=40 else (14 if p.prosperity>=20 else 10)))
static func council(w: SimWorld) -> void:
	var c: Dictionary=w.data.get("council",{})
	if c.is_empty(): return
	c.members=c.get("members",[]).filter(func(id): return w.data.agents.has(id) and not w.data.agents[id].get("isDead",false))
	if c.get("_formed",false) and c.members.size()>=2: return
	c._formed=false;c._daysSinceCouncilCheck=int(c.get("_daysSinceCouncilCheck",0))+1
	var npcs: Array=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false) and not a.get("isDead",false))
	if npcs.size()<6 or c._daysSinceCouncilCheck<5: return
	var candidates: Array=[]
	for a in npcs:
		var score: float=(3 if a.age>=35 else 0)+(2 if a.age>=45 else 0)+SimWorld.skill_level(float(a.skills.get("社交",{}).get("xp",0)))*2+(float(a.mood)+50)/25
		for pair in [["hardworking",2],["kind",2],["lazy",-3],["abrasive",-2]]:
			if pair[0] in a.personality.traits: score+=pair[1]
		if SimPlayerChat.job(w,a).get("key","")=="mayor": score+=5
		score+=w.rng.next_float()*4;candidates.append({"id":a.id,"score":score})
	candidates.sort_custom(func(a,b): return a.score>b.score)
	c.members=candidates.slice(0,mini(5,maxi(3,npcs.size()/3))).map(func(a): return a.id);c._formed=true;c._daysSinceCouncilCheck=0
	var names: String="、".join(c.members.map(func(id): return w.data.agents[id].name))
	SimQuests.log_event(w,"🏛️ 議會成立！成員："+names,"council");SimIndustry.news(w,"politics","小鎮議會正式成立，成員有"+names,8)

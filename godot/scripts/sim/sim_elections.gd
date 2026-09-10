class_name SimElections
extends RefCounted
static func policies() -> Array:
	return JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/election_rules.json"))
static func state(w: SimWorld) -> Dictionary:
	if not w.data.get("election") is Dictionary: w.data.election={}
	w.data.election.merge({"active":false,"phase":"none","candidates":[],"votes":{},"campaignDaysLeft":0,"votingDaysLeft":0,"resultsDaysLeft":0,"lastElectionDay":0,"electionHistory":[],"playerCanvassed":{}},false)
	return w.data.election
static func policy(key: String) -> Dictionary:
	for p in policies():
		if p.id==key: return p
	return {}
static func residents(w: SimWorld) -> Array:
	var away: Array=w.data.events.get("_travellingAgents",[]).map(func(t): return t.get("agentData",{}).get("id",t.get("agentData",{}).get("agentId",t.get("agentId",""))))
	return w.data.agents.values().filter(func(a): return not a.get("isPlayer",false) and not a.get("isDead",false) and a.id not in away)
static func eligible(w: SimWorld) -> Dictionary:
	if not w.data.agents.has("player"): return {"ok":false,"msg":"沒有旅人。"}
	if float(w.data.prosperity.get("prosperity",0))<20: return {"ok":false,"msg":"小鎮繁榮需達 20 才能參選。"}
	var backers: Array=residents(w).filter(func(a): return float(a.get("relationships",{}).get("player",{}).get("affinity",0))>=40)
	return {"ok":backers.size()>=3,"msg":"需要三位對你好感達 40 的居民聯署，目前 %d/3。"%backers.size()}
static func register(w: SimWorld,key: String) -> Dictionary:
	var e:=state(w);var p:=policy(key)
	if not w.elections_enabled or e.phase!="campaign" or p.is_empty(): return {"ok":false,"msg":"目前無法登記。"}
	if e.candidates.any(func(c): return c.agentId=="player"): return {"ok":false,"msg":"你已登記。"}
	var gate:=eligible(w)
	if not gate.ok: return gate
	var a: Dictionary=w.data.agents.player;e.candidates.append(candidate(a,p,true));e.playerCanvassed={}
	for resident in w.data.agents.values(): SimFeuds._memory(resident,w,"election",a.name+"登記參選鎮長，主張"+str(p.label),9 if resident.isPlayer else 6,[a.name])
	SimSocial.log_message(w.data,"event","📢 "+a.name+"宣布參選鎮長！",a.name,"")
	return {"ok":true,"msg":"已登記參選。"}
static func candidate(a: Dictionary,p: Dictionary,player: bool=false) -> Dictionary:
	var c:={"agentId":a.id,"name":a.name,"policy":p.id,"policyLabel":p.label,"policyIcon":p.icon,"votes":0,"speech":"我主張"+str(p.label)+"，請支持我。"}
	if player: c.isPlayer=true
	return c
static func pick_policy(w: SimWorld,a: Dictionary) -> Dictionary:
	var best: Dictionary={};var score:=-INF
	for p in policies():
		var value: float=a.personality.values.filter(func(v): return v in p.values).size()*3+a.personality.traits.filter(func(t): return t in p.traits).size()*2+w.rng.next_float()*1.5
		if value>score: score=value;best=p
	return best
static func start(w: SimWorld) -> bool:
	var e:=state(w);var pool:=residents(w)
	if e.active or pool.size()<2: return false
	var scored: Array=[]
	for a in pool:
		var score: float=SimWorld.skill_level(float(a.skills.get("社交",{}).get("xp",0)))*2+w._trait_sum(a,"social")*3+(float(a.mood)+50)/20
		if "charismatic" in a.personality.traits: score+=8
		if "shy" in a.personality.traits: score-=5
		if a.get("jobKey")=="mayor": score+=5
		score+=w.rng.next_float()*6;scored.append({"agent":a,"score":score})
	scored.sort_custom(func(a,b): return a.score>b.score)
	e.merge({"active":true,"phase":"campaign","campaignDaysLeft":3,"votingDaysLeft":0,"votes":{},"candidates":[],"playerCanvassed":{}},true)
	for row in scored.slice(0,mini(pool.size(),2+(1 if pool.size()>=8 else 0)+(1 if pool.size()>=12 else 0))):
		var p:=pick_policy(w,row.agent);e.candidates.append(candidate(row.agent,p));w.rng.next_float() # source speech draw
		SimFeuds._memory(row.agent,w,"election","我宣布參選鎮長，主張"+str(p.label),8,[])
	SimSocial.log_message(w.data,"event","📢 秋季鎮長選舉開始，競選登記為期三天。","","")
	return true
static func choose_vote(w: SimWorld,voter: Dictionary) -> Dictionary:
	var best: Dictionary={};var best_score:=-INF
	for c in state(w).candidates:
		var a: Dictionary=w.data.agents.get(c.agentId,{})
		if a.is_empty() or a.get("isDead",false): continue
		var rel: Dictionary=voter.get("relationships",{}).get(c.agentId,{})
		var score:=float(rel.get("affinity",0))*.4+float(rel.get("trust",0))*.1
		var p:=policy(c.policy)
		score+=voter.personality.values.filter(func(v): return v in p.get("values",[])).size()*10
		for pair in [["charismatic",8],["kind",4],["abrasive",-6],["lazy",-4]]:
			if pair[0] in a.personality.traits: score+=pair[1]
		score+=SimWorld.skill_level(float(a.skills.get("社交",{}).get("xp",0)))+(w.rng.next_float()-.3)*10
		for pair in [["pessimist","defense"],["optimist","welfare"],["creative","culture"],["hardworking","economy"],["ascetic","nature"]]:
			if pair[0] in voter.personality.traits and c.policy==pair[1]: score+=3
		if c.agentId=="player": score+=-6+clampf(float(w.data.reputationSystem.get("reputation",0))/15,-10,15)+(8 if state(w).get("playerCanvassed",{}).get(voter.id,false) else 0)
		if score>best_score: best_score=score;best=c
	return best
static func vote(w: SimWorld,id: String) -> bool:
	var e:=state(w)
	if not w.elections_enabled or e.phase!="voting" or e.votes.has("player"): return false
	for c in e.candidates:
		if c.agentId==id and w.data.agents.has(id) and not w.data.agents[id].get("isDead",false):
			e.votes.player=id;c.votes+=1;return true
	return false
static func npc_votes(w: SimWorld,force: bool=false) -> void:
	var e:=state(w)
	for a in residents(w):
		if e.votes.has(a.id): continue
		if not force and w.rng.next_float()>.6: continue
		var c:=choose_vote(w,a)
		if not c.is_empty(): e.votes[a.id]=c.agentId;c.votes+=1
static func daily(w: SimWorld) -> void:
	if not w.elections_enabled: return
	var day:=SimClock.total_days(w.data.clock)
	if int(w.quest_balance.get("election_day",-1))==day: return
	w.quest_balance.election_day=day
	var e:=state(w)
	for past in e.electionHistory: w.quest_balance.election_year=maxi(int(w.quest_balance.get("election_year",0)),int(past.get("year",0)))
	match e.phase:
		"campaign":
			e.campaignDaysLeft-=1
			if e.campaignDaysLeft<=0: e.phase="voting";e.votingDaysLeft=2;e.votes={};SimSocial.log_message(w.data,"event","🗳️ 投票開始！","","")
		"voting":
			e.votingDaysLeft-=1;npc_votes(w)
			if e.votingDaysLeft<=0: finish(w)
		"results":
			e.resultsDaysLeft-=1
			if e.resultsDaysLeft<=0: e.phase="none";e.active=false
		_:
			if w.data.clock.season=="秋季" and int(w.data.clock.day)==1 and int(w.quest_balance.get("election_year",0))<int(w.data.clock.year):
				if start(w): w.quest_balance.election_year=w.data.clock.year
static func finish(w: SimWorld) -> void:
	var e:=state(w)
	if e.phase!="voting": return
	npc_votes(w,true)
	e.candidates=e.candidates.filter(func(c): return w.data.agents.has(c.agentId) and not w.data.agents[c.agentId].get("isDead",false))
	e.candidates.sort_custom(func(a,b): return a.votes>b.votes)
	if e.candidates.is_empty(): e.phase="none";e.active=false;return
	var winner: Dictionary=e.candidates[0];var total:=0
	for c in e.candidates: total+=int(c.votes)
	for a in w.data.agents.values():
		if a.get("jobKey")=="mayor" and a.id!=winner.agentId:
			a.jobKey=w.rng.pick(["farmer","guard","trader","researcher"]);SimFeuds._memory(a,w,"election","我在選舉中落敗，不再擔任鎮長",9,[winner.name])
	var elected: Dictionary=w.data.agents[winner.agentId];elected.jobKey="mayor";SimFeuds._mood(elected,w,20)
	SimFeuds._memory(elected,w,"election","我贏得了鎮長選舉！得到 %d 票"%winner.votes,10,[])
	for a in residents(w):
		if e.votes.has(a.id): SimFeuds._mood(a,w,8 if e.votes[a.id]==winner.agentId else -3)
	e.lastElectionDay=SimClock.total_days(w.data.clock)+1
	e.electionHistory.append({"day":e.lastElectionDay,"year":w.data.clock.year,"season":w.data.clock.season,"winner":{"agentId":winner.agentId,"name":winner.name,"policy":winner.policy,"votes":winner.votes},"candidates":e.candidates.map(func(c): return {"agentId":c.agentId,"name":c.name,"policy":c.policy,"votes":c.votes}),"totalVotes":total})
	e.electionHistory=e.electionHistory.slice(-10);e.playerCanvassed={};e.phase="results";e.resultsDaysLeft=3
	apply_policy(w,str(winner.policy),str(winner.name))
	SimQuests.count(w,"electionsHeld")
	SimSocial.log_message(w.data,"event","🏆 "+str(winner.name)+"當選鎮長，主張"+str(winner.policyLabel)+"。","","")
	SimIndustry.news(w,"politics",str(winner.name)+"以 %d/%d 票當選鎮長"%[winner.votes,total],9)

static func apply_policy(w: SimWorld,key: String,name: String) -> void:
	clear_policy(w)
	var effects: Dictionary={"economy":{"farm_bonus":.15,"trade_bonus":.1},"welfare":{"mood_modifier":5,"immigration_chance":.1},"defense":{"raid_chance":-.05,"guard_bonus":.2},"culture":{"research_bonus":.2,"skill_bonus":.1},"nature":{"gathering_bonus":.2,"mood_modifier":3},"freedom":{"mood_modifier":3,"immigration_chance":.15}}
	var mods: Dictionary=effects.get(key,{})
	var day:=SimClock.total_days(w.data.clock)
	var id:="election_policy_godot_"+str(int(w.data.tickCount))
	w.quest_balance.election_policy={"id":id,"expires":day+30,"modifiers":mods.duplicate(true)}
	for modifier in mods: w.data.news.activeModifiers[modifier]=float(w.data.news.activeModifiers.get(modifier,0))+float(mods[modifier])
	w.data.news.bulletins.append({"id":id,"headline":name+"推動"+str(policy(key).label),"headline_en":"","category":"政治","severity":"info","flavor":"任期政策生效三十天；未移植的系統效果暫不執行。","modifiers":mods.duplicate(true),"publishedDay":day,"expiresDay":day+30,"daysRemaining":30})
static func clear_policy(w: SimWorld) -> void:
	var previous: Dictionary=w.quest_balance.get("election_policy",{})
	if previous.is_empty(): return
	for key in previous.modifiers:
		var amount:=float(w.data.news.activeModifiers.get(key,0))-float(previous.modifiers[key])
		if absf(amount)<.0000001: w.data.news.activeModifiers.erase(key)
		else: w.data.news.activeModifiers[key]=amount
	w.data.news.bulletins=w.data.news.bulletins.filter(func(b): return b.get("id")!=previous.id)
	w.quest_balance.erase("election_policy")
static func expire_policy(w: SimWorld) -> void:
	var p: Dictionary=w.quest_balance.get("election_policy",{})
	if p.is_empty(): return
	var remaining:=int(p.expires)-SimClock.total_days(w.data.clock)
	if remaining<=0: clear_policy(w)
	else:
		for b in w.data.news.bulletins:
			if b.get("id")==p.id: b.daysRemaining=remaining

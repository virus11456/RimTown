class_name SimCareers
extends RefCounted
const JOBS: Dictionary={"farmer":{"name":"農務員","skill":"種植"},"guard":{"name":"守衛","skill":"近戰"},"doctor":{"name":"醫護員","skill":"醫療"}}
const PATROL: Array=["town_square","quarry","residential_east"]
static func book(w: SimWorld) -> Dictionary:
	if not w.quest_balance.has("careers"): w.quest_balance.careers={"day":-1,"used":0,"visits":[],"treated":[],"active":{},"completed":0,"history":[]}
	var b: Dictionary=w.quest_balance.careers
	var day:=SimClock.total_days(w.data.clock)
	if int(b.day)!=day: b.day=day;b.used=0;b.visits=[];b.treated=[];b.active={}
	return b
static func enroll(w: SimWorld,key: String) -> Dictionary:
	if not JOBS.has(key) or not w.data.agents.has("player"): return {"ok":false,"message":"職業尚未開放。"}
	if SimGovernance.mayor(w)=="player": return {"ok":false,"message":"你目前是鎮長，可直接處理鎮務；不能以轉職卸除民選職務。"}
	var b:=book(w)
	if not b.active.is_empty(): return {"ok":false,"message":"請先完成或取消目前工作。"}
	w.data.agents.player.jobKey=key
	return {"ok":true,"message":"已登記為"+str(JOBS[key].name)+"。這是公共服務值勤，不授予鎮務支出權。"}
static func available(w: SimWorld) -> Array:
	var b:=book(w);var tasks: Array=[]
	match str(w.data.agents.get("player",{}).get("jobKey","")):
		"farmer":
			for p in w.data.farm.plots:
				if p.state=="growing" and float(p.waterLevel)<=70: tasks.append({"id":"water:"+str(p.id),"target":str(p.id),"location":"meadow","label":"照料農田 #"+str(p.id),"job":"farmer"})
		"guard":
			for loc in PATROL:
				if not loc in b.visits: tasks.append({"id":"patrol:"+loc,"target":loc,"location":loc,"label":"巡查"+str(w.data.townMap.locations[loc].name),"job":"guard"})
		"doctor":
			for a in w.data.agents.values():
				if not a.get("isPlayer",false) and not a.get("isDead",false) and float(a.needs.rest)<=40 and not a.id in b.treated and w.data.townMap.locations.has(a.currentLocation): tasks.append({"id":"care:"+str(a.id),"target":a.id,"location":a.currentLocation,"label":"照護疲憊的"+str(a.name),"job":"doctor"})
	return tasks
static func start(w: SimWorld,id: String) -> Dictionary:
	var b:=book(w)
	if not b.active.is_empty() or int(b.used)>=3: return {"ok":false,"message":"已有進行中的工作，或今日三次值勤已用完。"}
	for t in available(w):
		if t.id!=id: continue
		if w.data.agents.player.currentLocation!=t.location: return {"ok":false,"message":"請先親自前往"+str(w.data.townMap.locations[t.location].name)+"。"}
		b.active=t.duplicate(true);b.active.finish=int(w.data.tickCount)+4
		return {"ok":true,"message":"開始值勤，需停留一個遊戲小時；離開會取消。"}
	return {"ok":false,"message":"需求已改變，請重新查看工作。"}
static func cancel(w: SimWorld) -> void:
	book(w).active={}
static func tick(w: SimWorld) -> void:
	if not w.quest_balance.has("careers"): return
	var b:=book(w);var t: Dictionary=b.active
	if t.is_empty(): return
	var player: Dictionary=w.data.agents.player
	if player.currentLocation!=t.location or player.jobKey!=t.job: cancel(w);return
	var valid:=false
	for candidate in available(w):
		if candidate.id==t.id and candidate.location==t.location: valid=true
	if not valid: cancel(w);return
	if int(w.data.tickCount)<int(t.finish): return
	match str(t.job):
		"farmer": SimFarm.water(w,int(t.target))
		"guard": b.visits.append(t.target)
		"doctor":
			var a: Dictionary=w.data.agents[t.target];a.needs.rest=minf(100,float(a.needs.rest)+15);b.treated.append(t.target)
			SimFeuds._memory(a,w,"care","接受了"+str(player.name)+"的照護，恢復一些體力。",5,["player"])
	var skill: String=JOBS[t.job].skill
	if not player.skills.has(skill): player.skills[skill]={"xp":0,"passion":"無"}
	player.skills[skill].xp+=3;b.used+=1;b.completed+=1
	b.history.append(str(t.label)+"完成");b.history=b.history.slice(-10)
	SimSocial.log_message(w.data,"career",str(t.label)+"完成。",str(player.name),"")
	b.active={}
static func defense_bonus(w: SimWorld) -> float:
	if not w.quest_balance.has("careers"): return 0
	var b:=book(w)
	return 2.0 if b.visits.size()==PATROL.size() else 0.0

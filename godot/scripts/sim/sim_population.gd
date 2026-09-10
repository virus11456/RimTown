class_name SimPopulation
extends RefCounted
const HOUSING: Dictionary={"name":"住宅擴建","description":"新增一棟住宅，增加 3 位居民容量；最多 8 棟，不提供生產加成。","costs":{"wood":100,"stone":60,"silver":40},"work":80,"effects":{}}
static func homes(w: SimWorld,include_projects: bool=false) -> int:
	var buildings: Array=w.data.buildings.completed.duplicate()
	if include_projects: buildings.append_array(w.data.buildings.projects)
	return buildings.filter(func(b): return b.get("buildingKey")=="housing").size()
static func capacity(w: SimWorld) -> int:
	return mini(40,20+3*homes(w))
static func target(w: SimWorld) -> int:
	return mini(capacity(w),int(w.quest_balance.get("target_population",20))+3*homes(w))
static func daily(w: SimWorld) -> void:
	if not w.population_enabled: return
	var day:=SimClock.total_days(w.data.clock)
	if int(w.quest_balance.get("immigration_day",-1))==day: return
	w.quest_balance.immigration_day=day
	var count: int=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false) and not a.get("isDead",false)).size()+w.data.events.get("_travellingAgents",[]).size()
	# Keep arrivals gradual so the kitchen and reserve targets can adapt.
	if count>=target(w): return
	spawn(w)
static func spawn(w: SimWorld) -> Dictionary:
	var events: Dictionary=w.data.events
	var used: Array=events.get("_usedImmigrantNames",[])
	var active_names: Array=w.data.agents.values().map(func(a): return a.name)
	var pool: Array=SimNewAgent.rules().immigrants.filter(func(p): return p.name not in used and p.name not in active_names)
	if pool.is_empty():
		used=[];pool=SimNewAgent.rules().immigrants.filter(func(p): return p.name not in active_names)
	var exhausted:=pool.is_empty()
	if exhausted: pool=SimNewAgent.rules().immigrants
	var def: Dictionary=w.rng.pick(pool).duplicate(true)
	if exhausted:
		# Reuse a profession/personality template, but never duplicate a living resident's name.
		var names: Array=SimNewAgent.rules()[str(def.gender)].filter(func(n): return n not in active_names)
		if not names.is_empty(): def.name=w.rng.pick(names)
		else:
			var base: String=def.name;var n:=2
			while def.name in active_names: def.name=base+str(n);n+=1
	used.append(def.name);events._usedImmigrantNames=used
	var shuffled_values:=SimNewAgent.shuffle(["家庭","自由","知識","財富","權力","藝術","自然","社群","冒險","和平"],w)
	var values:=shuffled_values.slice(0,1+w.rng.next_int(0,2))
	var home: String=w.rng.pick(["residential_north","residential_south","residential_east"])
	var id:="imm_"+str(def.name)+"_"+str(int(w.data.tickCount));var suffix:=2
	while w.data.agents.has(id): id+="_"+str(suffix);suffix+=1
	var a:=SimNewAgent.create(w,id,str(def.name),int(def.age),str(def.gender),def.traits,values,str(def.background),home,str(def.job))
	var job: String=SimPlayerChat.job(w,a).get("title",def.job)
	SimSocial.log_message(w.data,"immigration","新居民到來："+str(a.name)+"，"+job+"！",a.name,"")
	var event:={"name":"新居民","description":str(a.name)+"以"+job+"身分到來！","severity":"minor","effects":{"mood_all":5,"conversation_topic":"新居民"+str(a.name)},"event_type":"arrival"}
	events.eventLog.append([SimSocial.time_string(w.data.clock),event]);events.conversationTopics.append("新居民"+str(a.name))
	for other in w.data.agents.values():
		if other.id!=id: SimFeuds._memory(other,w,"immigration","新居民"+str(a.name)+"到來了！",5,[a.name])
	SimIndustry.news(w,"lifecycle","新居民"+str(a.name)+"以"+job+"身分來到鎮上！",6)
	if w.data.get("dailyNews") is Dictionary: w.data.dailyNews.todayEvents.back().agents=[a.name]
	return a

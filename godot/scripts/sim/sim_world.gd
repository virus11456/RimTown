class_name SimWorld
extends RefCounted
# Pure local simulation; socializing can be enabled independently of the Phase 4a baseline.
var data: Dictionary = {}
var rules: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/sim_rules.json"))
var rng := SimRandom.new()
var runtime: Dictionary = {}
var social_enabled := false
var gossip_enabled := false
var romance_enabled := false
var feuds_enabled := false
var factions_enabled := false
var thoughts_enabled := false
var inner_voice_enabled := false
var stargazing_enabled := false
var mischief_enabled := false
var mourning_enabled := false
var trace_enabled := false
var event_comments_enabled := false
var event_comments_online := false
var event_comments: Array=[]
var combos_enabled := false
var combo_notifications: Array=[]
var relief_enabled := true
var kitchen_crops_enabled := true
var supply_enabled := false
var supply_state: Dictionary = {}
var processing_enabled := false
var farm_enabled := false
var industry_enabled := false
var research_enabled := false
var trade_enabled := false
var buildings_enabled := false
var economy_enabled := false
var perception_enabled := false
var presentation_events: Array=[]
var social := SimSocial.new()
func load_snapshot(snapshot: Dictionary) -> void:
	presentation_events.clear()
	combo_notifications.clear()
	data = snapshot.duplicate(true)
	var saved: Dictionary = data.get("_godot4a",{}) if data.get("_godot4a",{}) is Dictionary else {}
	social_enabled=bool(saved.get("social_enabled",false))
	gossip_enabled=bool(saved.get("gossip_enabled",false))
	romance_enabled=bool(saved.get("romance_enabled",false))
	feuds_enabled=bool(saved.get("feuds_enabled",false))
	factions_enabled=bool(saved.get("factions_enabled",false))
	thoughts_enabled=bool(saved.get("thoughts_enabled",false))
	inner_voice_enabled=bool(saved.get("inner_voice_enabled",false))
	stargazing_enabled=bool(saved.get("stargazing_enabled",false))
	mischief_enabled=bool(saved.get("mischief_enabled",false))
	mourning_enabled=bool(saved.get("mourning_enabled",false))
	trace_enabled=bool(saved.get("trace_enabled",false))
	perception_enabled=bool(saved.get("perception_enabled",false))
	economy_enabled=bool(saved.get("economy_enabled",false))
	buildings_enabled=bool(saved.get("buildings_enabled",false))
	trade_enabled=bool(saved.get("trade_enabled",false))
	research_enabled=bool(saved.get("research_enabled",false))
	event_comments_enabled=bool(saved.get("event_comments_enabled",false))
	event_comments_online=bool(saved.get("event_comments_online",false))
	event_comments=saved.get("event_comments",[]).duplicate(true)
	combos_enabled=bool(saved.get("combos_enabled",false))
	relief_enabled=bool(saved.get("relief_enabled",true))
	kitchen_crops_enabled=bool(saved.get("kitchen_crops_enabled",true))
	supply_enabled=bool(saved.get("supply_enabled",false))
	supply_state=saved.get("supply_state",{}).duplicate(true)
	processing_enabled=bool(saved.get("processing_enabled",false))
	farm_enabled=bool(saved.get("farm_enabled",false))
	industry_enabled=bool(saved.get("industry_enabled",false))
	_restore_relationship_precision(saved.get("relationship_precision",[]))
	rng.state = int(saved.get("random_state",11456))
	runtime = saved.get("agents",{}).duplicate(true)
	for id in data.agents:
		if not runtime.has(id): runtime[id]={"targetLocation":null,"moodModifier":0.0}
func snapshot() -> Dictionary:
	var result := data.duplicate(true)
	var extension: Dictionary = result.get("_godot4a",{}).duplicate(true)
	extension.merge({"version":1,"random_state":rng.state,"agents":runtime.duplicate(true),"social_enabled":social_enabled,"gossip_enabled":gossip_enabled,"romance_enabled":romance_enabled,"feuds_enabled":feuds_enabled,"factions_enabled":factions_enabled,"thoughts_enabled":thoughts_enabled,"inner_voice_enabled":inner_voice_enabled,"stargazing_enabled":stargazing_enabled,"mischief_enabled":mischief_enabled,"mourning_enabled":mourning_enabled,"trace_enabled":trace_enabled,"perception_enabled":perception_enabled,"economy_enabled":economy_enabled,"buildings_enabled":buildings_enabled,"trade_enabled":trade_enabled,"research_enabled":research_enabled,"industry_enabled":industry_enabled,"farm_enabled":farm_enabled,"processing_enabled":processing_enabled,"supply_enabled":supply_enabled,"relief_enabled":relief_enabled,"combos_enabled":combos_enabled,"event_comments_enabled":event_comments_enabled,"event_comments_online":event_comments_online,"event_comments":event_comments.duplicate(true),"kitchen_crops_enabled":kitchen_crops_enabled,"supply_state":supply_state.duplicate(true),"relationship_precision":_relationship_precision()},true)
	result._godot4a = extension
	if gossip_enabled and result.get("townFeed") is Dictionary and result.townFeed.get("posts") is Array:
		result.townFeed.posts=result.townFeed.posts.slice(maxi(0,result.townFeed.posts.size()-80))
	return result
func tick() -> Array[String]:
	presentation_events.clear()
	data.tickCount = int(data.get("tickCount",0))+1
	var events := SimClock.tick(data.clock)
	if romance_enabled and "new_day" in events: SimRomance.process(self)
	if feuds_enabled and "new_day" in events: SimFeuds.process(self)
	if economy_enabled and "new_day" in events: SimEconomy.daily(self)
	if buildings_enabled and "new_day" in events: SimBuildings.daily(self)
	if trade_enabled and "new_day" in events: SimTrade.daily(self)
	if research_enabled and "new_day" in events: SimResearch.daily(self)
	if factions_enabled and "new_day" in events: SimFactions.daily(self)
	if thoughts_enabled and "new_day" in events: SimThoughts.daily(self)
	if industry_enabled and "new_day" in events: SimIndustry.daily(self)
	if farm_enabled and "new_day" in events: SimFarm.daily(self)
	if processing_enabled and "new_day" in events: SimProcessing.daily(self)
	for id in data.agents:
		if not data.agents[id].get("isDead",false): _update(id)
	return events
func _trait_sum(a: Dictionary, field: String) -> float:
	var value := 0.0
	for trait_key in a.personality.traits: value += float(rules.traits.get(trait_key,{}).get(field,0))
	return value
func _job(a: Dictionary) -> Dictionary:
	return rules.jobs.get(str(a.get("jobKey","")),{})
func _work(job: Dictionary,hour: int) -> bool:
	return not job.is_empty() and hour>=job.work_hours[0] and hour<job.work_hours[1]
func _update(id: String) -> void:
	var a: Dictionary=data.agents[id]
	var run: Dictionary=runtime[id]
	var hour := int(data.clock.hour)
	var previous: String=a.activity
	if a.get("isPlayer",false): _player_activity(a,hour)
	else: _activity(a,hour)
	SimNeeds.decay(a.needs,a.activity,hour)
	if a.get("isPlayer",false):
		if a.currentLocation=="tavern": a.needs.hunger=minf(100,a.needs.hunger+.5)
		if a.currentLocation in ["residential_north","residential_south","residential_east"]: a.needs.rest=minf(100,a.needs.rest+.3)
		if a.currentLocation in ["town_square","tavern","park","chapel"]: a.needs.social=minf(100,a.needs.social+.2)
		if a.currentLocation in ["park","chapel","library"]: a.needs.recreation=minf(100,a.needs.recreation+.2)
		var recent: int=int(a.get("_recentChatTick",0))
		if recent!=0 and data.tickCount-recent<8: a.needs.social=minf(100,a.needs.social+1.5)
	run.moodModifier=move_toward(float(run.moodModifier),0,.5)
	var bonus := 0.0
	if not a.get("isPlayer",false):
		var thoughts := 0.0
		for thought in a.get("thoughts",[]):
			var fraction: float=1.0-(SimClock.total_days(data.clock)-float(thought.start))/float(thought.days)
			if fraction>0: thoughts+=thought.mood*fraction
		bonus=floor(thoughts+.5)+floor((float(a.get("attributes",{}).get("grit",5))-5)*.8+.5)
	a.mood=clampf(50+_trait_sum(a,"mood_base")+SimNeeds.mood(a.needs)+run.moodModifier+bonus,-100,100)
	if a.get("isPlayer",false): return
	_gain_xp(a)
	if a.activity!=previous: a._locationStayRemaining=0
	if a.get("_locationStayRemaining",0)>0: a._locationStayRemaining-=1
	else:
		_location(a,run,hour)
		if run.targetLocation!=null and run.targetLocation!=a.currentLocation:
			a.currentLocation=run.targetLocation; run.targetLocation=null
		a._locationStayRemaining=_stay(a.activity)
	if social_enabled and a.activity=="socializing": social.try_interaction(a,data,rng,rules.jobs,gossip_enabled)
	if a.activity=="stargazing" and stargazing_enabled: SimStargazing.process(a,self)
	elif a.activity=="stargazing":
		a.needs.recreation=minf(100,a.needs.recreation+2)
		a.needs.comfort=minf(100,a.needs.comfort+1)
	if a.activity=="night_mischief" and mischief_enabled: SimMischief.process(a,self)
	if a.activity=="mourning" and mourning_enabled: SimMourning.process(a,self)
	if a.activity=="night_stroll":
		a.needs.recreation=minf(100,a.needs.recreation+1)
		a.needs.comfort=minf(100,a.needs.comfort+.5)
	# Keep the original 10% draw even when the feature is disabled.
	if rng.next_float()<.1 and inner_voice_enabled: SimInnerVoice.generate(a,self)
	if trace_enabled: SimTrace.record(a,self)
	if perception_enabled: SimPerception.process(a,self)
func _player_activity(a: Dictionary,hour: int) -> void:
	var n: Dictionary=a.needs
	if (hour>=22 or hour<6) and n.rest<95:
		a.activity="eating" if n.hunger<10 else "sleeping"; return
	for entry in [["hunger",20,"eating"],["rest",15,"sleeping"],["social",20,"socializing"],["recreation",15,"recreation"]]:
		if n[entry[0]]<entry[1]: a.activity=entry[2]; return
	var job:=_job(a)
	if _work(job,hour):
		a.activity="eating" if n.hunger<30 and rng.next_float()<.3 else "working"; return
	if a.activity=="sleeping" and hour>=6 and hour<22: a.activity="wandering"
func _activity(a: Dictionary,hour: int) -> void:
	var traits: Array=a.personality.traits
	var owl := "night_owl" in traits
	var early := "early_bird" in traits
	var night := hour>=21 or hour<5
	var start := 2 if owl else 20 if early else 22
	var end := 9 if owl else 5 if early else 6
	var n: Dictionary=a.needs
	var job:=_job(a)
	if n.hunger<15: a.activity="eating"; return
	if n.rest<10: a.activity="sleeping"; return
	if hour==posmod(start-1,24) and n.rest<90 and a.currentLocation!=a.homeLocation:
		a.activity="heading_home"; return
	if not job.is_empty() and hour==posmod(int(job.work_hours[0])-1,24) and a.activity!="sleeping" and a.currentLocation!=job.workplace:
		a.activity="commuting"; return
	var sleeping := (hour>=start or hour<end) if start>end else (hour>=start and hour<end)
	if sleeping: a.activity="sleeping"; return
	if hour>=7 and hour<20:
		if (not a.get("_mourningTargets",[]).is_empty() and rng.next_float()<.3) or (not a.get("_annualMourning",[]).is_empty() and rng.next_float()<.15):
			a.activity="mourning"; return
	if night and owl and n.rest>=30:
		var choices := ["stargazing","socializing","night_stroll","recreation"]
		var weights := [4,3,2,2]
		if "abrasive" in traits or "gossip" in traits: choices.append("night_mischief"); weights.append(3)
		if "creative" in traits: choices.append("recreation"); weights.append(3)
		if "romantic" in traits:
			var partnered:=false
			for relationship in a.get("relationships",{}).values():
				if relationship.get("status") in ["dating","married"]: partnered=true
			choices.append("socializing" if partnered else "night_stroll"); weights.append(4 if partnered else 2)
		a.activity=rng.weighted(choices,weights); return
	if night and n.rest>=80:
		a.activity=rng.weighted(["stargazing","night_stroll","socializing","recreation"],[2,5 if a.mood<30 else 2,4 if n.social<40 else 1,2]); return
	if _work(job,hour):
		a.activity="eating" if n.hunger<30 and rng.next_float()<.3 else "working"; return
	var urgent:=SimNeeds.urgent(n)
	if urgent in ["hunger","social","recreation"]:
		a.activity={"hunger":"eating","social":"socializing","recreation":"recreation"}[urgent]; return
	a.activity=rng.weighted(["socializing","wandering","recreation"],[5 if _trait_sum(a,"social")>0 else 3,2,2])
func _location(a: Dictionary,run: Dictionary,hour: int) -> void:
	var night:=hour>=21 or hour<5
	var job:=_job(a)
	var working:=_work(job,hour)
	var home: String=a.homeLocation
	match a.activity:
		"heading_home","sleeping": run.targetLocation=home
		"commuting","working":
			if not job.is_empty(): run.targetLocation=job.workplace
		"eating": run.targetLocation=rng.pick([job.workplace,"tavern","tavern"]) if working else rng.pick(["tavern","tavern","home"]) if night else "tavern"
		"socializing": run.targetLocation=job.workplace if working else rng.pick(["tavern","tavern","town_square","park"]) if night else rng.pick(["tavern","town_square","park","well","chapel",home])
		"recreation": run.targetLocation=rng.pick(["tavern","library"] if night else ["park","library","tavern"])
		"stargazing": run.targetLocation=rng.pick(["park","hill","meadow"])
		"night_stroll": run.targetLocation=rng.pick(["park","town_square","hill","meadow"])
		"mourning": run.targetLocation="chapel"
		"night_mischief": run.targetLocation=rng.pick(["town_square","general_store","tavern"])
		"wandering": run.targetLocation=job.workplace if working else rng.pick(["town_square","park","well",home,home])
	if a.get("_pendingHangout")!=null:
		if a.activity=="sleeping": a._pendingHangout=null
		elif a._pendingHangout.tick<=0:
			run.targetLocation=a._pendingHangout.location
			a.activity=a._pendingHangout.get("activity","socializing")
			a._pendingHangout=null
		else: a._pendingHangout.tick-=1
	if a.activity=="eating" and run.targetLocation=="home": run.targetLocation=home
func _stay(activity: String) -> int:
	var limits := {"sleeping":[8,4],"working":[12,8],"eating":[4,3],"socializing":[6,4],"recreation":[5,4],"stargazing":[6,4],"mourning":[6,4],"night_stroll":[3,3],"wandering":[5,3]}
	if activity in ["heading_home","commuting"]: return 20
	if not limits.has(activity): return 4
	return int(limits[activity][0])+rng.next_int(0,int(limits[activity][1]))
static func skill_level(xp: float) -> int:
	var level:=0
	while level<20 and xp>=floor(100*(level+1)*(1+(level+1)*.2)): level+=1
	return level
func _gain_xp(a: Dictionary) -> void:
	var xp:=floori(rng.next_int(3,8)*(1+(float(a.get("attributes",{}).get("wit",5))-5)*.06)+.5)
	var job:=_job(a)
	if a.activity=="working" and not job.is_empty():
		var mapping: Dictionary=rules.jobSkills.get(a.jobKey,{})
		for skill in mapping.get("primary",[]): _add_xp(a,skill,xp*2,true)
		for skill in mapping.get("secondary",[]): _add_xp(a,skill,xp,false)
	else:
		for skill in rules.activitySkills.get(a.activity,[]): _add_xp(a,skill,xp,false)
func _add_xp(a: Dictionary,name: String,amount: int,thought: bool) -> void:
	if not a.skills.has(name): return
	var skill: Dictionary=a.skills[name]
	if skill.passion=="無能": return
	var previous:=skill_level(skill.xp)
	skill.xp+=floor(amount*float(rules.passions.get(skill.passion,1)))
	if thought and skill_level(skill.xp)>previous: a.currentThought=name+"技能進步了！"

func validation_error() -> String:
	var error:="這份存檔缺少試玩所需資料，仍可保留原始副本。"
	for key in ["day","hour","minute","year"]:
		if not data.get("clock",{}).get(key) is float and not data.get("clock",{}).get(key) is int: return error
	if data.clock.get("season") not in SimClock.SEASONS: return error
	if data.clock.day<1 or data.clock.day>15 or data.clock.year<1 or data.clock.hour<0 or data.clock.hour>=24 or data.clock.minute<0 or data.clock.minute>=60: return error
	for a in data.get("agents",{}).values():
		if not a is Dictionary: return error
		for key in ["activity","currentLocation","homeLocation"]:
			if not a.get(key) is String: return error
		if not a.get("personality") is Dictionary or not a.get("needs") is Dictionary or not a.get("skills") is Dictionary: return error
		if not a.personality.get("traits") is Array: return error
		for key in ["hunger","rest","social","comfort","recreation","beauty"]:
			if not a.get("needs",{}).get(key) is float and not a.get("needs",{}).get(key) is int: return error
	return ""

# Godot JSON parsing can round a decimal by one ULP. Preserve only affected
# relationship values so flooring affinity at 20-point thresholds survives saves.
# The decimal guard makes ordinary fields authoritative after external edits.
func _relationship_precision() -> Array:
	var patches: Array=[]
	for id in data.agents:
		for target in data.agents[id].get("relationships",{}):
			var relation: Dictionary=data.agents[id].relationships[target]
			for field in ["affinity","trust","romanticInterest"]:
				var value: Variant=relation.get(field)
				if not value is float: continue
				var decimal:=JSON.stringify(value,"",false,true)
				if float(JSON.parse_string(decimal))==value: continue
				var bits:=PackedByteArray();bits.resize(8);bits.encode_double(0,value)
				patches.append([id,target,field,decimal,bits.hex_encode()])
	return patches
func _restore_relationship_precision(patches: Variant) -> void:
	if not patches is Array: return
	for patch in patches:
		if not patch is Array or patch.size()!=5: continue
		if not patch[0] is String or not patch[1] is String or not patch[2] in ["affinity","trust","romanticInterest"]: continue
		if not patch[3] is String or not patch[4] is String or patch[4].length()!=16 or not patch[4].is_valid_hex_number(): continue
		var relation: Dictionary=data.agents.get(patch[0],{}).get("relationships",{}).get(patch[1],{})
		var current: Variant=relation.get(patch[2])
		var visible: Variant=JSON.parse_string(patch[3])
		if not (current is float or current is int) or not (visible is float or visible is int): continue
		var exact: float=patch[4].hex_decode().decode_double(0)
		if is_finite(exact) and float(current)==float(visible): relation[patch[2]]=exact

func present_dispute(first: Array,second: Array) -> void:
	# Visual-only cues never consume simulation RNG or enter the save document.
	for a in first:
		for b in second:
			if a!=b and data.agents.has(a) and data.agents.has(b):
				presentation_events.append({"a":a,"b":b});return

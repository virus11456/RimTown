class_name SimResidentCare
extends RefCounted
# A bounded visit, not a medical outcome or a source of production/rewards.
static func eligible(w: SimWorld,id: String) -> bool:
	var a: Dictionary=w.data.agents.get(id,{})
	if id=="player" or a.is_empty() or not SimServiceStay.priority(w,id).is_empty(): return false
	if a.get("_serviceStay",false) or SimLeisurePlan.directing(w,id): return false
	return w.quest_balance.get("careers",{}).get("active",{}).get("target","")!=id
static func provider_ready(w: SimWorld,m: SimMotion,id: String) -> bool:
	var a: Dictionary=w.data.agents.get(id,{})
	if id=="player" or a.is_empty() or a.get("isDead",false): return false
	if a.get("jobKey","") not in ["doctor","priest"] or a.activity!="working": return false
	if a.has("_raidShelterUntil") or float(a.needs.hunger)<20 or float(a.needs.rest)<10: return false
	if not SimWorkSchedule.working(SimWorkSchedule.job(a,w.rules.jobs),int(w.data.clock.hour)): return false
	for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
		if not str(a.get(key,"")).is_empty(): return false
	if str(SimWorkSchedule.job(a,w.rules.jobs).get("workplace",""))!=a.currentLocation: return false
	var p: Dictionary=m.positions.get(id,{})
	return not p.is_empty() and not p.get("walking",true) and p.get("doorPhase")==null and SimCareerPresence.place(m,id)==a.currentLocation and w.data.townMap.locations.has(a.currentLocation)
static func needed(a: Dictionary,job: String) -> bool:
	return float(a.needs.rest)>=10 and float(a.needs.rest)<=40 if job=="doctor" else float(a.mood)<0
static func clear(a: Dictionary,reason: String) -> void:
	a.erase("_careVisit");a.erase("_careDestination");a.erase("_careHolding")
	a._careVisitNotice=reason
	if a.activity in ["care_travel","care_wait"]: a.activity="wandering";a._locationStayRemaining=0
static func tick(w: SimWorld) -> void:
	var m: SimMotion=w.social.observed_motion
	if m==null or not m.stable_routes or not w.social_enabled:
		for a in w.data.agents.values():
			if a.has("_careVisit"): clear(a,"目前無法繼續關懷行程。")
		return
	var ids: Array=w.data.agents.keys();ids.sort();var used: Dictionary={}
	for id in ids:
		var a: Dictionary=w.data.agents[id]
		if not a.has("_careVisit"): continue
		var v: Dictionary=a._careVisit;var provider: String=str(v.get("provider",""))
		if not eligible(w,id) or not provider_ready(w,m,provider) or used.has(provider) or int(w.data.tickCount)>=int(v.get("until",0)):
			clear(a,"求助中止：行程優先、服務者離開或等候逾時。");continue
		var b: Dictionary=w.data.agents[provider]
		if b.jobKey!=v.job or b.currentLocation!=v.place or not needed(a,v.job): clear(a,"目前不再需要這次關懷。");continue
		used[provider]=true
		var p: Dictionary=m.positions.get(id,{})
		var q: Dictionary=m.positions[provider]
		var arrived: bool=not p.is_empty() and not p.get("walking",true) and p.get("doorPhase")==null and SimCareerPresence.together(m,id,provider,v.place) and Vector2(p.x,p.y).distance_to(Vector2(q.x,q.y))<=48
		if v.state=="visiting" and not arrived: clear(a,"雙方已離開，結束這次關懷。");continue
		if arrived and v.state=="travel":
			v.state="visiting";v.finish=int(w.data.tickCount)+2
			w.social.converse(b,a,w.data,w.rng,w.rules.jobs);b._lastInteractionTick=w.data.tickCount
		if v.state=="visiting" and int(w.data.tickCount)>=int(v.finish): clear(a,"已完成短暫關懷交談，繼續原本生活。");continue
		a._careHolding=v.state=="visiting"
	for id in ids:
		var a: Dictionary=w.data.agents[id]
		if a.has("_careVisit") or not eligible(w,id) or int(a.get("_careVisitDay",-1))==SimClock.total_days(w.data.clock): continue
		for provider in ids:
			if provider==id or used.has(provider) or not provider_ready(w,m,provider): continue
			var b: Dictionary=w.data.agents[provider]
			if not needed(a,b.jobKey): continue
			var q: Dictionary=m.positions[provider];var goal:=Vector2.INF
			for offset in [Vector2(24,0),Vector2(-24,0),Vector2(0,24),Vector2(0,-24),Vector2(12,0),Vector2(-12,0),Vector2(0,12),Vector2(0,-12)]:
				var candidate: Vector2=Vector2(q.x,q.y)+offset
				if m.layout._walkable(candidate) and m.location_at(candidate)==b.currentLocation: goal=candidate;break
			if not goal.is_finite(): continue
			a._careVisit={"provider":provider,"job":b.jobKey,"place":b.currentLocation,"x":goal.x,"y":goal.y,"state":"travel","until":int(w.data.tickCount)+8}
			a._careVisitDay=SimClock.total_days(w.data.clock);a._careVisitNotice="前往尋求關懷。";used[provider]=true;break
static func apply(w: SimWorld,a: Dictionary,run: Dictionary) -> bool:
	if not a.has("_careVisit"): return false
	if not eligible(w,str(a.id)): clear(a,"先處理必要行程。");return false
	a.currentLocation=a._careVisit.place;a._careDestination=a.currentLocation
	a.activity="care_wait" if a.get("_careHolding",false) else "care_travel"
	run.targetLocation=null;a._locationStayRemaining=0
	return true

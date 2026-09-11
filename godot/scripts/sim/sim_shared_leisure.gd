class_name SimSharedLeisure
extends RefCounted
static func signature(p: Dictionary) -> Array:
	return [p.get("day"),p.get("place"),p.get("due"),p.get("until")]
static func plan(w: SimWorld,m: SimMotion,a: Dictionary,b: Dictionary,spots: Array) -> Dictionary:
	if w==null or m==null or not SimLeisurePlan.enabled(w): return {}
	var left: Dictionary=SimLeisurePlan.plans(w).get(a.id,{})
	var right: Dictionary=SimLeisurePlan.plans(w).get(b.id,{})
	if not SimLeisurePlan.LIVE.has(left.get("state","")) or not SimLeisurePlan.LIVE.has(right.get("state","")): return {}
	if left.place!=right.place or left.place not in spots: return {}
	var now:=int(w.data.tickCount);var ready:=now
	for pair in [[a,left],[b,right]]:
		var resident: Dictionary=pair[0];var leisure: Dictionary=pair[1]
		var length:=SimHangoutRoute.distance(m,resident.id,leisure.place)
		if is_inf(length): return {}
		var free:=-1
		for offset in 16:
			var hour:=posmod((int(w.data.clock.hour)*60+int(w.data.clock.minute)+offset*15)/60,24)
			if SimLeisurePlan.person_available(resident,w.rules.jobs,hour): free=offset;break
		if free<0: return {}
		ready=maxi(ready,maxi(int(leisure.due),now+free+ceili(length/m.travel_budget(true))+1)+2)
	if ready>=now+16 or ready>=mini(int(left.until),int(right.until)): return {}
	for resident in [a,b]:
		if not SimHangoutRoute.return_fits(m,resident,w.data.clock,w.rules.jobs,left.place,ready-now): return {}
	var minutes:=int(w.data.clock.hour)*60+int(w.data.clock.minute)+(ready-now)*15
	return {"spots":[left.place],"wait_ticks":maxi(0,maxi(int(left.due),int(right.due))+2-now),"hour":posmod(minutes/60,24),"minute":posmod(minutes,60),"shared_leisure":{str(a.id):signature(left),str(b.id):signature(right)}}
static func valid(w: SimWorld,p: Dictionary) -> bool:
	if not SimLeisurePlan.enabled(w) or not p.get("shared_leisure") is Dictionary or p.shared_leisure.size()!=2 or not p.shared_leisure.has(p.get("withId","")): return false
	for id in p.shared_leisure:
		var leisure: Dictionary=SimLeisurePlan.plans(w).get(id,{})
		if signature(leisure)!=p.shared_leisure[id] or leisure.get("state","") not in ["scheduled","traveling","attending","completed"]: return false
	return true
static func observe(w: SimWorld,m: SimMotion) -> void:
	for id in w.data.agents:
		var a: Dictionary=w.data.agents[id];var p: Variant=a.get("_pendingHangout")
		if not p is Dictionary or not p.has("shared_leisure") or not valid(w,p): continue
		var now:=int(w.data.tickCount)
		if now<int(p.not_before) or now>=int(p.expires_at) or not w.data.agents.has(p.withId): continue
		var b: Dictionary=w.data.agents[p.withId];var peer: Variant=b.get("_pendingHangout")
		if not peer is Dictionary or peer.get("shared_leisure")!=p.shared_leisure or peer.get("issued_tick")!=p.issued_tick or peer.get("withId")!=id: continue
		var ready:=true
		for resident in [a,b]:
			if SimLeisurePlan.plans(w)[resident.id].state!="completed" or resident.get("isDead",false) or resident.has("_raidShelterUntil") or float(resident.needs.hunger)<15 or float(resident.needs.rest)<10 or SimAppointments.directing(w,resident.id) or not SimLeisurePlan.available(w,resident.id,int(w.data.clock.hour)): ready=false
		if not ready or not SimCareerPresence.together(m,id,p.withId,p.location): continue
		var first: Dictionary=m.positions[id];var second: Dictionary=m.positions[p.withId]
		if Vector2(first.x,first.y).distance_to(Vector2(second.x,second.y))>48: continue
		var other: String=p.withId;var token:=SimHangoutVisits.key(id,p)
		SimHangoutVisits.depart(w,id,p);SimHangoutVisits.depart(w,other,peer)
		SimHangoutVisits.records(w)[token].arrived=[id,other]
		SimHangoutVisits.records(w)[token].mode="shared_leisure"
		SimHangoutVisits.complete(w,token)

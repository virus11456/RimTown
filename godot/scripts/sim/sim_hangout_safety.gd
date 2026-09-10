class_name SimHangoutSafety
extends RefCounted
static func enabled(w: SimWorld) -> bool:
	return bool(w.quest_balance.get("hangout_safety_enabled",false))
static func note(w: SimWorld,id: String,state: String,reason: String) -> void:
	var book: Dictionary=w.quest_balance.get("hangout_status",{})
	book[id]={"state":state,"reason":reason,"tick":int(w.data.tickCount)}
	w.quest_balance.hangout_status=book
static func cancel(w: SimWorld,id: String,reason: String) -> void:
	var a: Dictionary=w.data.agents[id];var p: Dictionary=a.get("_pendingHangout",{})
	var other: String=p.get("withId","")
	a._pendingHangout=null;note(w,id,"cancelled",reason)
	SimHangoutVisits.finish(w,SimHangoutVisits.key(id,p),"cancelled",reason)
	if w.data.agents.has(other):
		var peer: Variant=w.data.agents[other].get("_pendingHangout")
		if peer is Dictionary and peer.get("withId")==id and peer.get("issued_tick")==p.get("issued_tick"):
			w.data.agents[other]._pendingHangout=null;note(w,other,"cancelled",reason)
static func tick(w: SimWorld) -> void:
	if not enabled(w): return
	for id in w.data.agents:
		var a: Dictionary=w.data.agents[id];var pending: Variant=a.get("_pendingHangout")
		if not pending is Dictionary: continue
		var p: Dictionary=pending
		if not p.has("withId") or not p.has("expires_at"): cancel(w,id,"舊外出安排缺少對象或期限，需重新確認。");continue
		if not w.data.agents.has(p.withId) or w.data.agents[p.withId].get("isDead",false) or a.get("isDead",false): cancel(w,id,"同行對象已不在，外出安排取消。");continue
		if a.has("_raidShelterUntil") or w.data.agents[p.withId].has("_raidShelterUntil"): cancel(w,id,"避難優先，外出安排取消。");continue
		if not w.data.townMap.locations.has(p.location): cancel(w,id,"目的地已不存在，外出安排取消。");continue
		if int(w.data.tickCount)>=int(p.expires_at): cancel(w,id,"期限內未能開始外出，安排已到期。");continue
		if SimAppointments.directing(w,id) or SimAppointments.directing(w,str(p.withId)): cancel(w,id,"已確認的玩家約定優先。");continue
	SimHangoutVisits.tick(w)
	for id in w.data.agents:
		var a: Dictionary=w.data.agents[id];var p: Variant=a.get("_pendingHangout")
		if not p is Dictionary or not w.data.agents.has(p.get("withId","")): continue
		var now:=int(w.data.tickCount)
		if now<=int(p.get("countdown_tick",p.get("issued_tick",now))): continue
		p.countdown_tick=now
		var visit: Dictionary=SimHangoutVisits.records(w).get(SimHangoutVisits.key(id,p),{})
		if visit.get("paused",false): continue
		if available_person(w,a) and available_person(w,w.data.agents[p.withId]): p.tick=maxi(0,int(p.tick)-1)
	var book: Dictionary=w.quest_balance.get("hangout_status",{})
	for id in book.keys():
		if not w.data.agents.has(id): book.erase(id)
static func available_person(w: SimWorld,a: Dictionary) -> bool:
	return SimLeisurePlan.available(w,str(a.id),int(w.data.clock.hour)) and a.activity not in ["working","commuting","sleeping","eating","heading_home","planned_leisure","appointment_travel","appointment_wait"] and float(a.needs.hunger)>=15 and float(a.needs.rest)>=10 and not a.has("_raidShelterUntil")
static func route(w: SimWorld,a: Dictionary,run: Dictionary) -> void:
	var pending: Variant=a.get("_pendingHangout")
	if not pending is Dictionary: return
	var p: Dictionary=pending
	var visit: Dictionary=SimHangoutVisits.records(w).get(SimHangoutVisits.key(str(a.id),p),{})
	if visit.get("paused",false): return
	if not w.data.agents.has(p.get("withId","")): return
	var other: Dictionary=w.data.agents[p.withId]
	if not available_person(w,a) or not available_person(w,other):
		note(w,str(a.id),"deferred","先處理工作、通勤、需求或既有行程；外出暫緩。");return
	if int(p.tick)>0: note(w,str(a.id),"pending","等待外出；尚未確認共同到場。");return
	run.targetLocation=p.location;a.activity=p.get("activity","socializing");a._pendingHangout=null
	SimHangoutVisits.depart(w,str(a.id),p)
	note(w,str(a.id),"departed","已設定外出目的地；不代表同行者已到場或完成聚會。")

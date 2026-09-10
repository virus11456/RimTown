class_name SimHangoutVisits
extends RefCounted
static func records(w: SimWorld) -> Dictionary:
	return w.quest_balance.get("hangout_visits",{})
static func key(id: String,p: Dictionary) -> String:
	var ids: Array=[id,str(p.get("withId",""))];ids.sort()
	return "%s|%s|%d"%[ids[0],ids[1],int(p.get("issued_tick",-1))]
static func depart(w: SimWorld,id: String,p: Dictionary) -> void:
	var book:=records(w);var token:=key(id,p)
	if not book.has(token):
		book[token]={"people":[id,str(p.withId)],"place":p.location,"issued_tick":int(p.issued_tick),"until":int(p.expires_at)+8,"departed":[],"state":"traveling","reason":"等待雙方實際到場。"}
	var r: Dictionary=book[token]
	if r.state!="traveling": return
	if id not in r.departed: r.departed.append(id)
	for person in r.people: w.data.agents[person]._activeHangout=token
	w.data.agents[id]._hangoutDestination=p.location
	while book.size()>20:
		var removed:=false
		for old in book.keys():
			if book[old].state!="traveling": book.erase(old);removed=true;break
		if not removed: break
	w.quest_balance.hangout_visits=book
static func finish(w: SimWorld,token: String,state: String,reason: String) -> void:
	var r: Dictionary=records(w).get(token,{})
	if r.get("state","")!="traveling": return
	r.state=state;r.reason=reason;r.resolved_tick=int(w.data.tickCount)
	for id in r.people:
		if not w.data.agents.has(id): continue
		var a: Dictionary=w.data.agents[id]
		if a.get("_activeHangout","")==token: a.erase("_activeHangout");a.erase("_hangoutDestination")
		var pending: Variant=a.get("_pendingHangout")
		if pending is Dictionary and key(id,pending)==token: a._pendingHangout=null
		SimHangoutSafety.note(w,id,state,reason)
static func valid(w: SimWorld,r: Dictionary) -> bool:
	if not w.data.townMap.locations.has(r.place): return false
	for id in r.people:
		if not w.data.agents.has(id): return false
		var a: Dictionary=w.data.agents[id]
		if a.get("isDead",false) or a.has("_raidShelterUntil") or SimAppointments.directing(w,id): return false
		if id in r.departed and (not SimHangoutSafety.available_person(w,a) or a.currentLocation!=r.place): return false
	return true
static func tick(w: SimWorld) -> void:
	for token in records(w):
		var r: Dictionary=records(w)[token]
		if r.state!="traveling": continue
		if not valid(w,r): finish(w,token,"cancelled","工作、需求、既有行程或對象狀態改變，同行外出已中止。")
		elif int(w.data.tickCount)>=int(r.until): finish(w,token,"missed","期限內未確認雙方近距離到場，聚會未完成。")
static func restore_observations(w: SimWorld,positions: Dictionary) -> void:
	for token in records(w):
		var r: Dictionary=records(w)[token]
		if r.state!="traveling": continue
		for id in r.people:
			if not positions.get(id) is Dictionary or not positions[id].get("x") is float and not positions[id].get("x") is int or not positions[id].get("y") is float and not positions[id].get("y") is int:
				finish(w,token,"cancelled","存檔缺少實際位置，同行安排已中止，未確認碰面。")
				break
static func observe(w: SimWorld,m: SimMotion) -> void:
	if not SimHangoutSafety.enabled(w): return
	for token in records(w):
		var r: Dictionary=records(w)[token]
		if r.state!="traveling" or r.departed.size()!=2 or int(w.data.tickCount)>=int(r.until) or not valid(w,r): continue
		var left: String=r.people[0];var right: String=r.people[1]
		if not SimCareerPresence.together(m,left,right,str(r.place)): continue
		var a: Dictionary=m.positions[left];var b: Dictionary=m.positions[right]
		if Vector2(a.x,a.y).distance_to(Vector2(b.x,b.y))>48: continue
		var place: String=w.data.townMap.locations[r.place].get("name",r.place)
		var reason:="雙方已實際在"+place+"近距離碰面。"
		finish(w,token,"met",reason)
		for pair in [[left,right],[right,left]]:
			SimFeuds._memory(w.data.agents[pair[0]],w,"social","與"+str(w.data.agents[pair[1]].name)+"依同行安排，實際在"+place+"碰面。",4,[w.data.agents[pair[1]].name])

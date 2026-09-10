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
	if r.get("paused",false) or not w.data.townMap.locations.has(r.place): return false
	for id in r.people:
		if not w.data.agents.has(id): return false
		var a: Dictionary=w.data.agents[id]
		if a.get("isDead",false) or a.has("_raidShelterUntil") or SimAppointments.directing(w,id): return false
		if id in r.departed and (not SimHangoutSafety.available_person(w,a) or a.currentLocation!=r.place): return false
	return true
static func directing(w: SimWorld,id: String) -> bool:
	if not SimHangoutSafety.enabled(w): return false
	var a: Dictionary=w.data.agents[id]
	var r: Dictionary=records(w).get(a.get("_activeHangout",""),{})
	return r.get("state","")=="traveling" and not r.get("paused",false) and id in r.departed and int(w.data.tickCount)<int(r.until) and SimHangoutSafety.available_person(w,a)
static func blocking_reason(w: SimWorld,r: Dictionary) -> String:
	if not w.data.townMap.locations.has(r.place): return "目的地已不存在。"
	for id in r.people:
		if not w.data.agents.has(id): return "同行對象已離開小鎮。"
		var a: Dictionary=w.data.agents[id];var who:=str(a.name)
		if a.get("isDead",false): return who+"已離世。"
		if a.has("_raidShelterUntil"): return who+"需要避難。"
		if SimAppointments.directing(w,id): return who+"已有優先的玩家約定。"
		if SimLeisurePlan.directing(w,id): return who+"已有優先的休閒安排。"
		if not SimLeisurePlan.available(w,id,int(w.data.clock.hour)):
			var job: Dictionary=w.rules.jobs.get(str(a.get("jobKey","")),{})
			var hour:=int(w.data.clock.hour)
			if not job.is_empty() and hour>=int(job.work_hours[0])-1 and hour<int(job.work_hours[1]): return who+"已到通勤或工作時段。"
			return who+"已到睡眠時段。"
	return ""
static func tick(w: SimWorld) -> void:
	for token in records(w):
		var r: Dictionary=records(w)[token]
		if r.state!="traveling": continue
		var now:=int(w.data.tickCount)
		if now>=int(r.until):
			finish(w,token,"missed","期限內未確認雙方近距離到場，聚會未完成。")
			continue
		var urgent:=false;var why:=blocking_reason(w,r)
		if not why.is_empty():
			finish(w,token,"cancelled",why+"同行外出已中止。")
			continue
		for id in r.people:
			var a: Dictionary=w.data.agents[id]
			if float(a.needs.hunger)<15 or float(a.needs.rest)<10 or a.activity in ["eating","sleeping"]: urgent=true
		if r.get("paused",false):
			if now>=int(r.pause_until):
				finish(w,token,"cancelled","短暫休整期限已到，同行安排取消。")
				continue
			var ready:=not urgent
			for id in r.people: ready=ready and SimHangoutSafety.available_person(w,w.data.agents[id])
			if ready:
				r.paused=false;r.reason="雙方已可繼續，恢復原地點安排；到場期限不延長。"
				for id in r.people:
					if id in r.departed: w.data.agents[id].currentLocation=r.place;w.data.agents[id]._hangoutDestination=r.place
					SimHangoutSafety.note(w,id,"resumed",r.reason)
			continue
		if urgent:
			if r.get("pause_used",false):
				finish(w,token,"cancelled","再次需要進食或休息，同行安排取消。")
				continue
			r.paused=true;r.pause_used=true;r.pause_until=mini(now+4,int(r.until));r.reason="先處理進食或休息，最多暫停一小時；雙方恢復後繼續，原期限不延長。"
			for id in r.people:
				w.data.agents[id].erase("_hangoutDestination")
				w.data.agents[id]._locationStayRemaining=0
				SimHangoutSafety.note(w,id,"paused",r.reason)
			continue
		if not valid(w,r): finish(w,token,"cancelled","行程或目的地改變，同行外出已中止。")
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
		if r.state!="traveling" or int(w.data.tickCount)>=int(r.until) or not valid(w,r): continue
		for id in r.departed:
			if SimCareerPresence.place(m,id)==str(r.place):
				var arrivals: Array=r.get("arrived",[])
				if id not in arrivals:
					arrivals.append(id);r.arrived=arrivals
					SimHangoutSafety.note(w,id,"waiting","已實際到場，等待同行者；最晚於原期限結束。")
		if r.departed.size()!=2: continue
		var left: String=r.people[0];var right: String=r.people[1]
		if not SimCareerPresence.together(m,left,right,str(r.place)): continue
		var a: Dictionary=m.positions[left];var b: Dictionary=m.positions[right]
		if Vector2(a.x,a.y).distance_to(Vector2(b.x,b.y))>48: continue
		var place: String=w.data.townMap.locations[r.place].get("name",r.place)
		var reason:="雙方已實際在"+place+"近距離碰面。"
		finish(w,token,"met",reason)
		for pair in [[left,right],[right,left]]:
			SimFeuds._memory(w.data.agents[pair[0]],w,"social","與"+str(w.data.agents[pair[1]].name)+"依同行安排，實際在"+place+"碰面。",4,[w.data.agents[pair[1]].name])

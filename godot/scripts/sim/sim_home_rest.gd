class_name SimHomeRest
extends RefCounted
static func physical(w: SimWorld) -> bool:
	return w.quest_balance.get("hangout_safety_enabled",false) or (w.social.observed_motion!=null and w.social.observed_motion.stable_routes)
static func arrived(w: SimWorld,a: Dictionary) -> bool:
	var m: SimMotion=w.social.observed_motion
	if m==null or not m.positions.has(str(a.id)): return false
	var home:=m.layout._house_id(str(a.id),str(a.homeLocation))
	var p: Dictionary=m.positions[str(a.id)]
	if home.is_empty() or not m.layout.houses.has(home) or not p.has("x") or not p.has("y"): return false
	return SimCareerPresence.room(m,str(a.id))==home and not p.get("walking",true) and p.get("doorPhase") == null
static func apply(w: SimWorld,a: Dictionary) -> void:
	if a.get("isPlayer",false) or not physical(w): return
	if a.activity=="sleeping" and not arrived(w,a):
		a.activity="heading_home"
		# Re-evaluate the home destination even if the previous activity was also heading home.
		a._locationStayRemaining=0

static func plan(w: SimWorld,a: Dictionary) -> Dictionary:
	var m: SimMotion=w.social.observed_motion
	if m==null or not m.stable_routes or a.get("isPlayer",false) or a.get("isDead",false) or a.has("_raidShelterUntil"): return {}
	if float(a.needs.hunger)<15 or float(a.needs.rest)<10: return {}
	var hour:=int(w.data.clock.hour);var job: Dictionary=SimWorkSchedule.job(a,w.rules.jobs)
	if not job.is_empty() and SimWorkSchedule.working(job,hour): return {}
	var after_meeting: Dictionary=a.get("_hangoutHome",{})
	if after_meeting.get("home")==a.homeLocation and int(after_meeting.get("until",0))>int(w.data.tickCount) and not arrived(w,a): return after_meeting
	var sleep_window:=SimShiftSleep.window(a,w.rules.jobs)
	var remaining:=posmod(int(sleep_window.start)*4-hour*4-int(w.data.clock.minute)/15,96)
	if remaining<=0 or remaining>16: return {}
	var home:=m.layout._house_id(str(a.id),str(a.homeLocation))
	if not m.layout.houses.has(home) or not m.positions.has(str(a.id)): return {}
	var until:=int(w.data.tickCount)+remaining
	var signature:=JSON.stringify([home,a.get("jobKey",""),job,sleep_window.start,until,m.tick_seconds])
	if a.get("_homeReturn",{}).get("signature")==signature: return a._homeReturn
	var house: Dictionary=m.layout.houses[home];var p: Dictionary=m.positions[str(a.id)]
	var start:=Vector2(p.x,p.y);var length:=0.0
	var exit_door: Variant=m.door(m.inside(start),str(a.id))
	if exit_door!=null:
		var exit_point:=Vector2(exit_door.x,exit_door.y)
		length+=SimHangoutRoute.segment(m,start,exit_point);start=exit_point
	var entry:=Vector2(house.doorPixelX,house.doorPixelY)
	length+=SimHangoutRoute.segment(m,start,entry)+SimHangoutRoute.segment(m,entry,Vector2(house.interiorX,house.interiorY))
	if is_inf(length): return {}
	var required:=mini(16,maxi(4,ceili(length/m.travel_budget())+1))
	if remaining>required: return {}
	return {"signature":signature,"until":until,"required_ticks":required,"home":a.homeLocation}

static func after_meeting(w: SimWorld,a: Dictionary,place: String) -> void:
	var m: SimMotion=w.social.observed_motion
	if m==null or not m.stable_routes or a.get("isPlayer",false): return
	var length:=SimHangoutRoute.home_distance(m,a,place)
	if is_inf(length): return
	var ticks:=ceili(length/m.travel_budget())+2
	if ticks>=96: return
	a._hangoutHome={"home":a.homeLocation,"until":int(w.data.tickCount)+ticks,"required_ticks":ticks,"signature":"hangout:"+str(w.data.tickCount)}
	a._locationStayRemaining=0

static func remaining_distance(m: SimMotion,a: Dictionary) -> float:
	if m==null or not m.positions.has(str(a.id)): return INF
	var home:=m.layout._house_id(str(a.id),str(a.homeLocation));var house: Dictionary=m.layout.houses.get(home,{})
	if house.is_empty(): return INF
	var p: Dictionary=m.positions[str(a.id)];var start:=Vector2(p.x,p.y);var length:=0.0
	var exit_door: Variant=m.door(m.inside(start),str(a.id))
	if exit_door!=null:
		var exit_point:=Vector2(exit_door.x,exit_door.y)
		length+=SimHangoutRoute.segment(m,start,exit_point);start=exit_point
	var entry:=Vector2(house.doorPixelX,house.doorPixelY);var offset:=str(a.id).unicode_at(0)%4
	var goal:=m.layout._nearest(Vector2(house.interiorX+(offset%2-.5)*16,house.interiorY+(floori(offset/2.0)-.5)*16))
	return length+SimHangoutRoute.segment(m,start,entry)+SimHangoutRoute.segment(m,entry,goal)
static func resume_after_meal(w: SimWorld,a: Dictionary) -> void:
	var m: SimMotion=w.social.observed_motion;var task: Dictionary=a.get("_hangoutHome",{})
	var now:=int(w.data.tickCount)
	if m==null or not m.stable_routes or a.get("isPlayer",false) or a.get("isDead",false) or a.has("_raidShelterUntil") or task.is_empty(): return
	if task.get("meal_replanned",false) or task.get("home")!=a.homeLocation or now>=int(task.get("until",0)) or arrived(w,a): return
	if a.activity!="eating" or float(a.needs.hunger)<15: return
	var length:=remaining_distance(m,a)
	if is_inf(length): return
	var original:=int(task.until);var needed:=now+ceili(length/m.travel_budget())+1
	task.meal_replanned=true;task.meal_resumed_tick=now;task.original_until=original
	task.until=mini(original+4,maxi(original,needed))
	task.meal_allowance_ticks=int(task.until)-original

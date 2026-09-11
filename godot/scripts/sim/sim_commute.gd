class_name SimCommute
extends RefCounted
static func plan(w: SimWorld,a: Dictionary) -> Dictionary:
	var m: SimMotion=w.social.observed_motion
	if m==null or not m.stable_routes or a.get("isPlayer",false) or a.get("isDead",false) or a.has("_raidShelterUntil"): return {}
	if float(a.needs.hunger)<15 or float(a.needs.rest)<10: return {}
	var hour:=int(w.data.clock.hour)
	if SimShiftSleep.asleep(a,w.rules.jobs,hour): return {}
	var job: Dictionary=SimWorkSchedule.job(a,w.rules.jobs)
	if job.is_empty() or not w.data.townMap.locations.has(job.workplace): return {}
	var remaining:=posmod(int(job.work_hours[0])*4-hour*4-int(w.data.clock.minute)/15,96)
	if remaining<=0 or remaining>16: return {}
	var length:=SimHangoutRoute.distance(m,str(a.id),str(job.workplace))
	if is_inf(length): return {}
	# Budget ordinary walking using the same clock cadence as the app.
	var required:=mini(16,maxi(4,ceili(length/m.travel_budget())+1))
	var continuing: bool=a.get("_commuteDestination","")==job.workplace and a.get("_commuteDay",-1)==SimClock.total_days(w.data.clock)
	if not continuing and remaining>required: return {}
	return {"place":job.workplace,"required_ticks":required,"remaining_ticks":remaining}

# Eat before departure only at a real, stopped meal location. Never feed a walker.
static func meal_place(w: SimWorld,a: Dictionary) -> String:
	var m: SimMotion=w.social.observed_motion
	if m==null or not m.stable_routes or a.get("isPlayer",false) or a.get("isDead",false) or a.has("_raidShelterUntil"): return ""
	var hour:=int(w.data.clock.hour)
	if float(a.needs.rest)<10 or SimShiftSleep.asleep(a,w.rules.jobs,hour): return ""
	var job:=SimWorkSchedule.job(a,w.rules.jobs)
	if job.is_empty() or not w.data.townMap.locations.has(job.workplace): return ""
	var remaining:=posmod(int(job.work_hours[0])*4-hour*4-int(w.data.clock.minute)/15,96)
	if remaining<=0 or remaining>16 or float(a.needs.hunger)>=minf(35,15+remaining*2): return ""
	var p: Dictionary=m.positions.get(str(a.id),{})
	if p.is_empty() or p.get("walking",true) or p.get("doorPhase")!=null: return ""
	if SimHomeRest.arrived(w,a): return str(a.homeLocation)
	var actual:=SimCareerPresence.place(m,str(a.id))
	return actual if actual in [str(job.workplace),"tavern"] else ""

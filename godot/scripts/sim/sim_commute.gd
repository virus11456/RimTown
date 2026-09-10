class_name SimCommute
extends RefCounted
static func plan(w: SimWorld,a: Dictionary) -> Dictionary:
	var m: SimMotion=w.social.observed_motion
	if m==null or not m.stable_routes or a.get("isPlayer",false) or a.get("isDead",false) or a.has("_raidShelterUntil"): return {}
	if float(a.needs.hunger)<15 or float(a.needs.rest)<10: return {}
	var hour:=int(w.data.clock.hour);var traits: Array=a.personality.get("traits",[])
	var start:=2 if "night_owl" in traits else 20 if "early_bird" in traits else 22
	var end:=9 if "night_owl" in traits else 5 if "early_bird" in traits else 6
	if (hour>=start or hour<end if start>end else hour>=start and hour<end): return {}
	var job: Dictionary=w.rules.jobs.get(str(a.get("jobKey","")),{})
	if job.is_empty() or not w.data.townMap.locations.has(job.workplace): return {}
	var remaining:=int(job.work_hours[0])*4-hour*4-int(w.data.clock.minute)/15
	if remaining<=0 or remaining>16: return {}
	var length:=SimHangoutRoute.distance(m,str(a.id),str(job.workplace))
	if is_inf(length): return {}
	# Ordinary movement is 36 px/game tick; budget 30 plus one tick margin.
	var required:=mini(16,maxi(4,ceili(length/30.0)+1))
	var continuing: bool=a.get("_commuteDestination","")==job.workplace and a.get("_commuteDay",-1)==SimClock.total_days(w.data.clock)
	if not continuing and remaining>required: return {}
	return {"place":job.workplace,"required_ticks":required,"remaining_ticks":remaining}

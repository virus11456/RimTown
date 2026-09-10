class_name SimShiftSleep
extends RefCounted
static func preferred(a: Dictionary) -> Dictionary:
	var traits: Array=a.personality.get("traits",[])
	var start:=2 if "night_owl" in traits else 20 if "early_bird" in traits else 22
	var end:=9 if "night_owl" in traits else 5 if "early_bird" in traits else 6
	return {"start":start,"end":end,"duration":posmod(end-start,24),"lead":1}
static func window(a: Dictionary,jobs: Dictionary) -> Dictionary:
	var saved: Dictionary=a.get("_shiftSleep",{})
	var job: Dictionary=jobs.get(str(a.get("jobKey","")),{})
	if not a.get("isPlayer",false) and not saved.is_empty() and saved.get("job")==a.get("jobKey") and saved.get("hours")==job.get("work_hours") and saved.get("workplace")==job.get("workplace") and saved.get("traits")==a.personality.get("traits",[]): return saved
	return preferred(a)
static func asleep(a: Dictionary,jobs: Dictionary,hour: int) -> bool:
	var p:=window(a,jobs);return posmod(hour-int(p.start),24)<int(p.duration)
static func choose(a: Dictionary,job: Dictionary,lead: int) -> Dictionary:
	var p:=preferred(a);var duration:=int(p.duration)
	var start:=int(job.work_hours[0]);var end:=int(job.work_hours[1])
	var room:=24-(end-start)-duration
	p.lead=mini(lead,maxi(1,room));p.conflict=room<lead
	if room<1: return p
	var best:=99
	for bed in 24:
		var fits:=true
		for offset in duration:
			if posmod(bed+offset-(start-int(p.lead)),24)<end-start+int(p.lead): fits=false;break
		if not fits: continue
		var distance:=mini(posmod(bed-int(p.start),24),posmod(int(p.start)-bed,24))
		if distance<best: best=distance;p["chosen"]=bed
	if p.has("chosen"): p.start=p.chosen;p.end=posmod(int(p.start)+duration,24);p.erase("chosen")
	return p
static func refresh(w: SimWorld,m: SimMotion) -> void:
	if m==null or not m.stable_routes: return
	for id in w.data.agents:
		var a: Dictionary=w.data.agents[id];var job: Dictionary=w.rules.jobs.get(str(a.get("jobKey","")),{})
		if a.get("isPlayer",false) or a.get("isDead",false) or job.is_empty() or not w.data.townMap.locations.has(job.get("workplace","")): a.erase("_shiftSleep");continue
		var home: String=m.layout._house_id(id,str(a.homeLocation))
		var signature:=JSON.stringify([SimClock.total_days(w.data.clock),a.jobKey,job.work_hours,job.workplace,home,a.personality.get("traits",[])])
		if a.get("_shiftSleep",{}).get("signature")==signature: continue
		var house: Dictionary=m.layout.houses.get(home,{})
		if house.is_empty(): a.erase("_shiftSleep");continue
		var origin:=Vector2(house.interiorX,house.interiorY)
		var door: Variant=m.door(str(job.workplace),id)
		var goal:=m.layout._nearest(m.layout._center(str(job.workplace)))
		var length:=SimHangoutRoute.segment(m,origin,goal) if door==null else SimHangoutRoute.segment(m,origin,Vector2(door.x,door.y))+SimHangoutRoute.segment(m,Vector2(door.x,door.y),goal)
		if is_inf(length): a.erase("_shiftSleep");continue
		var lead:=clampi(ceili((length/30.0+1)/4),1,4)
		var p:=choose(a,job,lead)
		p.merge({"signature":signature,"job":a.jobKey,"hours":job.work_hours.duplicate(),"workplace":job.workplace,"traits":a.personality.get("traits",[]).duplicate(),"estimated_lead":lead})
		a._shiftSleep=p

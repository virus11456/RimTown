class_name SimWorkSchedule
extends RefCounted
static func job(a: Dictionary,jobs: Dictionary) -> Dictionary:
	var value: Dictionary=jobs.get(str(a.get("jobKey","")),{})
	if a.get("jobKey")!="guard" or not a.has("_guardShift"): return value
	var result:=value.duplicate(true)
	result.work_hours=[18,6] if a._guardShift=="night" else [6,18]
	result.workplace=a.get("_guardWorkplace",value.get("workplace","guardpost"))
	return result
static func working(job: Dictionary,hour: int,lead: int=0) -> bool:
	if job.is_empty() or not job.has("work_hours"): return false
	var start:=int(job.work_hours[0]);var duration:=posmod(int(job.work_hours[1])-start,24)
	return duration>0 and posmod(hour-start+lead,24)<duration+lead
static func refresh(w: SimWorld,m: SimMotion) -> void:
	if m==null or not m.stable_routes: return
	var guards: Array=[]
	for a in w.data.agents.values():
		if a.get("jobKey")=="guard" and not a.get("isPlayer",false) and not a.get("isDead",false): guards.append(a)
		else: a.erase("_guardShift");a.erase("_guardWorkplace")
	var counts:={"day":0,"night":0}
	for a in guards:
		if a.get("_guardShift","") in ["day","night"]: counts[a._guardShift]+=1
	for a in guards:
		if a.get("_guardShift","") not in ["day","night"]:
			var shift: String="day" if guards.size()==1 else "day" if a.id=="yang_feng" else "night" if a.id=="gao_lang" else "day" if counts.day<=counts.night else "night"
			a._guardShift=shift;counts[shift]+=1
		# An existing public square can be watched without granting a free guardpost.
		var place: String="guardpost" if w.data.townMap.locations.has("guardpost") else "town_square" if w.data.townMap.locations.has("town_square") else "guardpost"
		if a.get("_guardWorkplace","")!=place: a._locationStayRemaining=0
		a._guardWorkplace=place

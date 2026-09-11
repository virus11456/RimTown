class_name SimServiceStay
extends RefCounted
# Only newly accepted, unhurried services reserve a short physical stay.
static func priority(w: SimWorld,id: String) -> String:
	var a: Dictionary=w.data.agents.get(id,{})
	if a.is_empty() or a.get("isDead",false): return "服務對象已不在。"
	if a.has("_raidShelterUntil"): return "對方需要避難。"
	if float(a.needs.hunger)<20: return "對方需要先吃飯。"
	if a.activity=="sleeping" or float(a.needs.rest)<10 or SimShiftSleep.asleep(a,w.rules.jobs,int(w.data.clock.hour)): return "對方需要先休息。"
	var job:=SimWorkSchedule.job(a,w.rules.jobs)
	if not job.is_empty() and SimWorkSchedule.working(job,int(w.data.clock.hour)): return "對方需要上工。"
	if not SimCommute.meal_place(w,a).is_empty() or not SimCommute.plan(w,a).is_empty(): return "對方需要用餐或準備上工。"
	if SimAppointments.directing(w,id) or SimHangoutVisits.directing(w,id): return "對方有已排定的見面行程。"
	if not SimHomeRest.plan(w,a).is_empty(): return "對方需要準備走回家休息。"
	return ""
static func holding(w: SimWorld,id: String) -> bool:
	var t: Dictionary=w.quest_balance.get("careers",{}).get("active",{})
	return t.get("stay",false) and str(t.get("target",""))==id and int(w.data.tickCount)<=int(t.get("finish",-1)) and priority(w,id).is_empty() and SimCareerPresence.service_need_error(w,t).is_empty() and SimCareerPresence.task_error(w.social.observed_motion,t).is_empty()
static func clear(w: SimWorld) -> void:
	for a in w.data.agents.values():
		if a.has("_serviceStay"):
			a.erase("_serviceStay")
			if a.activity=="receiving_service": a.activity="wandering";a._locationStayRemaining=0
static func sync(w: SimWorld) -> void:
	var t: Dictionary=w.quest_balance.get("careers",{}).get("active",{})
	var id:=str(t.get("target",""))
	for a in w.data.agents.values():
		if a.has("_serviceStay") and (str(a.id)!=id or not holding(w,str(a.id))):
			a.erase("_serviceStay")
			if a.activity=="receiving_service": a.activity="wandering";a._locationStayRemaining=0
	if not id.is_empty() and holding(w,id): w.data.agents[id]._serviceStay=true

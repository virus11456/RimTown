extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m;m.stable_routes=true
	var a: Dictionary=w.data.agents.chen_wei
	for traits in [[],["night_owl"],["early_bird"]]:
		a.personality.traits=traits
		for job_key in w.rules.jobs:
			var job: Dictionary=w.rules.jobs[job_key];var p:=SimShiftSleep.choose(a,job,4)
			check(int(p.duration)==int(SimShiftSleep.preferred(a).duration) and posmod(int(p.end)-int(p.start),24)==int(p.duration),"full rest duration: "+job_key+str(traits))
			var overlap:=false
			for offset in int(p.duration):
				var hour:=posmod(int(p.start)+offset,24)
				if hour>=int(job.work_hours[0]) and hour<int(job.work_hours[1]): overlap=true
			check(not overlap,"sleep avoids shift: "+job_key+str(traits))
	a.personality.traits=["night_owl"];a.jobKey="cook"
	SimShiftSleep.refresh(w,m)
	check(a.has("_shiftSleep") and a._shiftSleep.duration==7,"scene estimate creates full night-owl schedule")
	var p: Dictionary=a._shiftSleep
	check(not SimLeisurePlan.available(w,a.id,int(p.start)) and not SimAppointments.free_hour(w,a.id,int(p.start)),"leisure and player invitations share adjusted sleep")
	w.data.clock.hour=int(p.start);a.needs.hunger=80;a.needs.rest=80;w._activity(a,int(p.start))
	check(a.activity=="sleeping","actual activity uses adjusted bedtime")
	var saved:=w.snapshot();var restored:=SimWorld.new();restored.load_snapshot(saved)
	check(equal(SimShiftSleep.window(a,w.rules.jobs),SimShiftSleep.window(restored.data.agents.chen_wei,restored.rules.jobs)),"schedule persists across world reload")
	a.jobKey="";check(SimShiftSleep.window(a,w.rules.jobs).start==2,"job removal immediately falls back to preference")
	SimShiftSleep.refresh(w,m);check(not a.has("_shiftSleep"),"removed job clears cached schedule")
	var tight:=SimShiftSleep.choose(a,w.rules.jobs.guard,4)
	check(tight.duration==7,"long shift never cuts desired sleep")
	var early: Dictionary=a.duplicate(true);early.personality.traits=["early_bird"]
	tight=SimShiftSleep.choose(early,w.rules.jobs.guard,4)
	check(tight.conflict and tight.duration==9 and tight.lead<4,"overfull day flags commute conflict without cutting rest")
	var report:={"checks":checks,"failures":failures,"scope":"all original jobs x three sleep preferences, no shortened duration or shift overlap, shared activity/leisure/invitation constraints, live job removal, cache reload and overfull-day conflict; scheduled windows, not measured sleep quality"}
	FileAccess.open("res://docs/SHIFT_SLEEP_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

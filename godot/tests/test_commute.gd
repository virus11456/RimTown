extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m;m.stable_routes=true
	w.social.observe_positions(m);w.rules.jobs.commute_test={"work_hours":[12,18],"workplace":"library"}
	var a: Dictionary=w.data.agents.chen_wei;a.jobKey="commute_test";a.activity="wandering"
	var point:=m.layout._nearest(m.layout._center("park"));m.positions.chen_wei.x=point.x;m.positions.chen_wei.y=point.y
	w.data.clock.hour=7;w.data.clock.minute=0
	check(SimCommute.plan(w,a).is_empty(),"cannot start more than four hours early")
	w.data.clock.hour=8
	var plan:=SimCommute.plan(w,a)
	check(not plan.is_empty() and plan.required_ticks==16,"long route starts up to four hours early")
	var stock: Dictionary=w.data.stockpile.duplicate(true);w._update("chen_wei")
	check(a.activity=="commuting" and a.currentLocation=="library" and a._commuteDestination=="library","agent update keeps commute destination")
	check(equal(stock,w.data.stockpile),"early commute does not pay resources")
	point=m.layout._nearest(m.layout._center("library"));m.positions.chen_wei.x=point.x;m.positions.chen_wei.y=point.y
	w.data.clock.hour=10
	check(not SimCommute.plan(w,a).is_empty(),"early arrival stays at workplace until shift")
	w.data.clock.hour=12;check(SimCommute.plan(w,a).is_empty(),"work start releases commute control")
	w.data.clock.hour=8
	for fault in ["hunger","rest","shelter","sleep","player","missing"]:
		var copy: Dictionary=a.duplicate(true)
		match fault:
			"hunger": copy.needs.hunger=0
			"rest": copy.needs.rest=0
			"shelter": copy._raidShelterUntil=999
			"sleep": copy.personality.traits=["night_owl"]
			"player": copy.isPlayer=true
			"missing": copy.jobKey=""
		check(SimCommute.plan(w,copy).is_empty(),"higher priority or absent job: "+fault)
	m.stable_routes=false;check(SimCommute.plan(w,a).is_empty(),"legacy mode unchanged")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());check(SimCommute.plan(restored,restored.data.agents.chen_wei).is_empty(),"reload without current scene observations cannot invent travel estimate")
	var report:={"checks":checks,"failures":failures,"scope":"controlled custom shift and route, four-hour cap, actual agent update, waiting after arrival, work start release, needs/sleep/raid/player priorities and no-observation fallback; not natural punctuality proof"}
	FileAccess.open("res://docs/COMMUTE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_careers.gd"
func _initialize() -> void:
	var w:=world();var layout:=TownLayout.new();layout.rebuild(w.data)
	var m:=SimMotion.new();m.configure(layout);m.stable_routes=true;w.social.observe_positions(m)
	var a: Dictionary=w.data.agents.lin_mei;a.personality.traits=["night_owl"];a.erase("_shiftSleep");a.needs.hunger=90;a.needs.rest=80
	w.rules.jobs.sleep_test={"work_hours":[8,18],"workplace":"clinic"};a.jobKey="sleep_test";a.activity="heading_home";a.currentLocation=a.homeLocation
	w.data.clock.hour=7;w.data.clock.minute=0
	w._activity(a,7);check(a.activity=="sleeping","physical sleep window takes precedence over legacy one-hour commute")
	w._update("lin_mei");check(a.activity=="heading_home" and a.currentLocation==a.homeLocation,"absent physical arrival still walks home rather than commuting")
	m.update({"lin_mei":a})
	for frame in 12000:
		m.update({"lin_mei":a})
		if SimHomeRest.arrived(w,a): break
	check(SimHomeRest.arrived(w,a),"resident walks into own room")
	w.data.clock.hour=6;a.needs.hunger=10;a.needs.rest=40;a.activity="sleeping";a._locationStayRemaining=0
	var resources: Dictionary=w.data.stockpile.duplicate(true);var before: Dictionary=m.positions.duplicate(true)
	w._update("lin_mei")
	check(a.activity=="eating" and a.currentLocation==a.homeLocation,"hungry sleeping resident eats at home even after 05:00")
	check(a.needs.rest<40 and a.needs.hunger==30,"meal is still an eating tick without sleep recovery")
	m.update({"lin_mei":a})
	check(is_equal_approx(m.positions.lin_mei.x,before.lin_mei.x) and is_equal_approx(m.positions.lin_mei.y,before.lin_mei.y),"meal does not send resident out of room")
	w._update("lin_mei");check(a.activity=="sleeping" and a.currentLocation==a.homeLocation,"sleep resumes after urgent hunger resolves")
	check(equal(resources,w.data.stockpile),"location choice adds no resources or duplicate daily ration charge")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());restored.social.observe_positions(m)
	var copy: Dictionary=restored.data.agents.lin_mei;copy.needs.hunger=10;copy._locationStayRemaining=0;restored._update("lin_mei")
	check(copy.currentLocation==copy.homeLocation and copy.activity=="eating","sleep-period home meal survives save restore")
	w.data.clock.hour=10;a.needs.hunger=90;a.activity="heading_home";w._activity(a,10)
	check(a.activity=="working","work resumes outside sleep window")
	w.data.clock.hour=7;m.stable_routes=false;w.quest_balance.hangout_safety_enabled=false;a.activity="heading_home";w._activity(a,7)
	check(a.activity=="commuting","source-only legacy activity remains compatible")
	var report:={"checks":checks,"failures":failures,"scope":"controlled overlapping preferred sleep/job window, actual slow home arrival, sleep-period meal without leaving or restoring rest, unchanged stockpile, save restore, work and legacy boundaries"}
	FileAccess.open("res://docs/SLEEP_INTERRUPTION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

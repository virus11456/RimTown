extends "res://tests/test_careers.gd"
func _initialize() -> void:
	var w:=world();var layout:=TownLayout.new();layout.rebuild(w.data)
	var m:=SimMotion.new();m.configure(layout);m.stable_routes=true
	var a: Dictionary=w.data.agents.chen_wei;a.jobKey="";a.personality.traits=[];a.currentLocation="park";a.activity="wandering";a.needs.hunger=90;a.needs.rest=80
	m.update({"chen_wei":a});w.social.observe_positions(m)
	w.data.clock.hour=17;w.data.clock.minute=0
	check(SimHomeRest.plan(w,a).is_empty(),"no return more than four hours before bedtime")
	var original_positions: Dictionary=m.positions.duplicate(true)
	var first:=-1
	for hour in range(18,22):
		w.data.clock.hour=hour
		if not SimHomeRest.plan(w,a).is_empty(): first=hour;break
	check(first>=18 and first<21,"long actual path triggers return before old one-hour window")
	var plan:=SimHomeRest.plan(w,a);var stock: Dictionary=w.data.stockpile.duplicate(true)
	w._update("chen_wei")
	check(a.activity=="heading_home" and a.currentLocation==a.homeLocation and a.has("_homeReturn"),"world routes and retains early return plan")
	check(a.needs.rest<80 and equal(stock,w.data.stockpile),"early departure awards neither sleep nor goods")
	check(not SimLeisurePlan.available(w,"chen_wei",first),"current return time unavailable for leisure")
	check(SimHangoutVisits.blocking_reason(w,{"place":"park","people":["chen_wei"],"until":int(w.data.tickCount)+4}).contains("返家"),"outing interruption names return travel")
	var house: Dictionary=layout.houses[layout._house_id("chen_wei",a.homeLocation)]
	m.positions.chen_wei.x=house.interiorX;m.positions.chen_wei.y=house.interiorY;m.positions.chen_wei.walking=false;m.positions.chen_wei.doorPhase=null
	check(SimHomeRest.plan(w,a).get("settled",false) and SimHomeRest.plan(w,a).until==plan.until,"early arrival retains plan until bedtime")
	w._update("chen_wei");check(a.activity=="idle","early arrival does not start sleeping early")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());restored.social.observe_positions(m)
	check(SimHomeRest.plan(restored,restored.data.agents.chen_wei).get("settled",false) and SimHomeRest.plan(restored,restored.data.agents.chen_wei).until==plan.until,"active return plan survives snapshot with physical observations")
	w.data.clock.hour=22;check(SimHomeRest.plan(w,a).is_empty(),"bedtime releases return plan")
	w._update("chen_wei");check(a.activity=="sleeping" and not a.has("_homeReturn"),"actual home sleep takes over at bedtime")
	w.data.clock.hour=first
	for fault in ["hunger","rest","shelter","player","dead","work"]:
		var copy: Dictionary=a.duplicate(true)
		match fault:
			"hunger":copy.needs.hunger=0
			"rest":copy.needs.rest=0
			"shelter":copy._raidShelterUntil=999
			"player":copy.isPlayer=true
			"dead":copy.isDead=true
			"work":w.rules.jobs.return_test={"work_hours":[first,22],"workplace":"library"};copy.jobKey="return_test"
		check(SimHomeRest.plan(w,copy).is_empty(),"priority guard: "+fault)
	w.data.clock.hour=first;m.positions=original_positions.duplicate(true);a.needs.hunger=90;a.needs.rest=80
	w.quest_balance.appointments={"current":{"state":"accepted","npc":"chen_wei","place":"town_square","due":int(w.data.tickCount)+4,"until":int(w.data.tickCount)+12}}
	w._update("chen_wei")
	check(a.activity=="appointment_travel" and a.currentLocation=="town_square" and not a.has("_homeReturn"),"confirmed player appointment retains priority over return")
	w.quest_balance.erase("appointments")
	a.personality.traits=["night_owl"];w.data.clock.hour=23
	check(not SimHomeRest.plan(w,a).is_empty(),"return window crosses midnight for 02:00 bedtime")
	m.positions.clear();check(SimHomeRest.plan(w,a).is_empty(),"no position cannot invent a path")
	var report:={"checks":checks,"failures":failures,"first_return_hour":first,"scope":"controlled route and schedule, early arrival hold, no early sleep/resources, leisure/outing conflict, snapshot, bedtime release and priority guards; not natural sleep-duration proof"}
	FileAccess.open("res://docs/HOME_RETURN_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

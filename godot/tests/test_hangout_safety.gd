extends "res://tests/test_daily_talk.gd"
func fixture() -> SimWorld:
	var w: SimWorld=setup().w;w.quest_balance.hangout_safety_enabled=true;w.data.clock.hour=18
	for pair in [["chen_wei","lin_mei"],["lin_mei","chen_wei"]]:
		var a: Dictionary=w.data.agents[pair[0]];a.jobKey="";a.activity="wandering"
		a._pendingHangout={"location":"park","activity":"socializing","tick":0,"withId":pair[1],"issued_tick":w.data.tickCount,"expires_at":int(w.data.tickCount)+16}
	return w
func _initialize() -> void:
	for blocked in ["job","sleep","eat","commute","hungry","rest","leisure"]:
		var w:=fixture();var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents.lin_mei
		match blocked:
			"job": a.jobKey="priest"
			"sleep": b.activity="sleeping"
			"eat": a.activity="eating"
			"commute": a.activity="commuting"
			"hungry": a.needs.hunger=0
			"rest": b.needs.rest=0
			"leisure": b.activity="planned_leisure"
		var run:={"targetLocation":"tavern"};SimHangoutSafety.route(w,a,run)
		check(run.targetLocation=="tavern" and a._pendingHangout!=null and w.quest_balance.hangout_status.chen_wei.state=="deferred","normal target protected: "+blocked)
	for fault in ["expiry","dead","shelter","place","legacy"]:
		var w:=fixture()
		match fault:
			"expiry": w.data.tickCount+=16
			"dead": w.data.agents.lin_mei.isDead=true
			"shelter": w.data.agents.lin_mei._raidShelterUntil=999
			"place": w.data.townMap.locations.erase("park")
			"legacy": w.data.agents.chen_wei._pendingHangout.erase("expires_at")
		var stock: Dictionary=w.data.stockpile.duplicate(true);SimHangoutSafety.tick(w)
		check(w.data.agents.chen_wei._pendingHangout==null and w.data.agents.lin_mei._pendingHangout==null,"paired cancellation: "+fault)
		check(equal(stock,w.data.stockpile),"cancellation has no resource effects: "+fault)
	var w:=fixture();var a: Dictionary=w.data.agents.chen_wei;var run:={"targetLocation":"tavern"}
	SimHangoutSafety.route(w,a,run)
	check(run.targetLocation=="park" and a._pendingHangout==null and w.quest_balance.hangout_status.chen_wei.state=="departed","free resident changes destination without claiming meeting")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());check(equal(w.quest_balance.hangout_status,restored.quest_balance.hangout_status),"latest status saved")
	w=fixture();w.quest_balance.hangout_safety_enabled=false;var saved:=w.snapshot();SimHangoutSafety.tick(w);check(equal(saved,w.snapshot()),"pure legacy mode unchanged")
	var report:={"checks":checks,"failures":failures,"scope":"configured paired plans, work/sleep/commute/needs/other agenda priority, both-party expiry/death/shelter/missing destination/legacy cancellation, departure only, no resources, status reload and compatibility"}
	FileAccess.open("res://docs/HANGOUT_SAFETY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

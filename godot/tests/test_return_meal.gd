extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	for fault in ["normal","player","dead","shelter","hungry","not_eating","expired","changed_home","no_motion","missing_position","unreachable"]:
		var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m;m.stable_routes=true;m.tick_seconds=8;w.social.observe_positions(m)
		var a: Dictionary=w.data.agents.chen_wei;a.activity="eating";a.needs.hunger=35
		a._hangoutHome={"home":a.homeLocation,"until":int(w.data.tickCount)+1,"signature":"fixture"}
		match fault:
			"player": a.isPlayer=true
			"dead": a.isDead=true
			"shelter": a._raidShelterUntil=999
			"hungry": a.needs.hunger=5
			"not_eating": a.activity="heading_home"
			"expired": a._hangoutHome.until=w.data.tickCount
			"changed_home": a._hangoutHome.home="removed"
			"no_motion": w.social.observed_motion=null
			"missing_position": m.positions.erase(a.id)
			"unreachable": m.positions[a.id].x=-1000;m.positions[a.id].y=-1000
		var before: Dictionary=a._hangoutHome.duplicate(true);var stock: Dictionary=w.data.stockpile.duplicate(true);var needs: Dictionary=a.needs.duplicate(true);var positions:=m.positions.duplicate(true)
		SimHomeRest.resume_after_meal(w,a)
		if fault=="normal":
			check(a._hangoutHome.get("meal_replanned",false) and int(a._hangoutHome.until)<=int(before.until)+4,"meal detour gets one bounded route-based correction")
			var corrected: Dictionary=a._hangoutHome.duplicate(true);w.data.tickCount+=1;SimHomeRest.resume_after_meal(w,a)
			check(equal(corrected,a._hangoutHome),"later meals or ticks cannot repeatedly extend task")
		else: check(equal(before,a._hangoutHome),"no correction for "+fault)
		check(equal(stock,w.data.stockpile) and equal(needs,a.needs) and equal(positions,m.positions),"no food, rest or position effects: "+fault)
	var report:={"checks":checks,"failures":failures,"scope":"controlled return metadata and meal state, finite allowance, repeated calls, invalid or expired task and no resource/needs/position mutation; not natural arrival evidence"}
	FileAccess.open("res://docs/RETURN_MEAL_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

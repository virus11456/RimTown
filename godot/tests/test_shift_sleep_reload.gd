extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	var before: Dictionary={}
	for id in w.data.agents:
		var a: Dictionary=w.data.agents[id]
		if a.get("isPlayer",false): continue
		var hours: Array=[]
		for hour in 24: hours.append(SimShiftSleep.asleep(a,w.rules.jobs,hour))
		before[id]=hours
	for round_trip in 2:
		var saved: Dictionary=app.progress_snapshot();var stock: Dictionary=w.data.stockpile.duplicate(true)
		app._load_document(JSON.stringify(saved),"sleep schedule round trip")
		for id in before:
			var hours: Array=[]
			for hour in 24: hours.append(SimShiftSleep.asleep(w.data.agents[id],w.rules.jobs,hour))
			check(hours==before[id],"all 24 sleep-hour decisions preserved after reload %d: %s"%[round_trip,id])
		check(equal(stock,w.data.stockpile),"reload does not alter stockpile")
	var night: Dictionary=w.data.agents.gao_lang
	check(int(SimShiftSleep.window(night,w.rules.jobs).start)==8 and SimShiftSleep.asleep(night,w.rules.jobs,10) and not SimShiftSleep.asleep(night,w.rules.jobs,23),"loaded night guard sleeps in daytime, not at night")
	app.show_tab("居民",true);app.show_agenda(night.id);await settle()
	check(has_text(app.drawer_body,"08:00–16:00"),"loaded phone agenda retains daytime sleep hours")
	check(SimShiftSleep.same_hours([18.0,6.0],[18,6]),"numeric representation is irrelevant to equal hours")
	check(not SimShiftSleep.same_hours([18.5,6.0],[18,6]),"fractional time is not truncated into a false match")
	check(not SimShiftSleep.same_hours([6,18],[18,6]),"different actual shift is rejected")
	check(not SimShiftSleep.same_hours([18],[18,6]) and not SimShiftSleep.same_hours(null,[18,6]) and not SimShiftSleep.same_hours(["18",6],[18,6]),"malformed and textual hours are rejected")
	var copy: Dictionary=night.duplicate(true);copy._guardShift="day"
	check(int(SimShiftSleep.window(copy,w.rules.jobs).start)==22,"real shift change invalidates old cached sleep window")
	var report:={"checks":checks,"failures":failures,"scope":"two native JSON app round trips compare 24-hour sleep decisions for every NPC, unchanged resources, phone agenda, numeric normalization and real shift invalidation"}
	FileAccess.open("res://docs/SHIFT_SLEEP_RELOAD_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

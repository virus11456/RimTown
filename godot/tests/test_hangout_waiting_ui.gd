extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;w.data.clock.hour=18;w.data.clock.minute=0;w.quest_balance.leisure_plans_enabled=false
	var token:=""
	for pair in [["chen_wei","lin_mei"],["lin_mei","chen_wei"]]:
		var a: Dictionary=w.data.agents[pair[0]];a.jobKey="";a.activity="wandering";a.needs.hunger=80;a.needs.rest=80
		var pending:={"location":"park","activity":"socializing","tick":0,"withId":pair[1],"issued_tick":int(w.data.tickCount),"expires_at":int(w.data.tickCount)+16}
		a._pendingHangout=pending;token=SimHangoutVisits.key(pair[0],pending)
		var run:={"targetLocation":a.currentLocation};SimHangoutSafety.route(w,a,run);a.currentLocation=run.targetLocation
	w.data.agents.lin_mei.needs.hunger=14
	app._tick_simulation();app.show_tab("居民",true);app.show_agenda("chen_wei");await settle()
	check(has_text(app.drawer_body,"最多暫停一小時"),"agenda explains bounded pause")
	var snapshot: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(snapshot),"waiting resume");await settle()
	check(SimHangoutVisits.records(w)[token].get("pause_used",false),"app reload retains spent retry")
	var fits:=true
	app.show_agenda("chen_wei");await settle()
	for c in app.drawer_body.get_children():
		if c is Control and c.size.x>app.drawer.size.x: fits=false
	check(fits,"375px status fits")
	for i in range(3): app._tick_simulation()
	app.show_agenda("chen_wei");await settle()
	check(SimHangoutVisits.records(w)[token].state=="traveling" and not SimHangoutVisits.records(w)[token].paused,"normal app ticks recover and resume")
	check(has_text(app.drawer_body,"恢復原地點安排"),"resumed reason visible")
	var report:={"checks":checks,"failures":failures,"scope":"375px app agenda, controlled needs interruption, real tick recovery, app snapshot reload; no production AI"}
	FileAccess.open("res://docs/HANGOUT_WAITING_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

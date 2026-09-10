extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;w.data.clock.hour=18;w.data.clock.minute=0
	for pair in [["chen_wei","lin_mei"],["lin_mei","chen_wei"]]:
		var a: Dictionary=w.data.agents[pair[0]];a.jobKey="priest";a.activity="working";a.needs.hunger=80;a.needs.rest=80;a._locationStayRemaining=0
		a._pendingHangout={"location":"park","activity":"socializing","tick":0,"withId":pair[1],"issued_tick":int(w.data.tickCount),"expires_at":int(w.data.tickCount)+16}
	app._tick_simulation();app.show_tab("居民",true);app.show_agenda("chen_wei");await settle()
	check(w.data.agents.chen_wei.activity=="working" and w.data.agents.chen_wei.currentLocation==w.rules.jobs.priest.workplace,"normal tick preserves actual job destination")
	check(has_text(app.drawer_body,"最近居民同行安排") and has_text(app.drawer_body,"外出暫緩"),"agenda explains deferred outing")
	var fits:=true
	for c in app.drawer_body.get_children():
		if c is Control and c.size.x>app.drawer.size.x: fits=false
	check(fits,"375px outing status fits")
	var snapshot: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(snapshot),"hangout resume");await settle()
	check(w.data.agents.chen_wei._pendingHangout!=null and w.quest_balance.hangout_safety_enabled,"pending safe outing survives reload")
	w.data.tickCount+=16;app._tick_simulation();app.show_agenda("chen_wei")
	check(w.data.agents.chen_wei._pendingHangout==null and w.data.agents.lin_mei._pendingHangout==null,"normal tick expires both pending plans")
	check(has_text(app.drawer_body,"安排已到期"),"expired result visible")
	var report:={"checks":checks,"failures":failures,"scope":"controlled paired outing and priest work fixture through normal app ticks, 375px agenda, app snapshot reload and paired expiry; not a full joint arrival implementation"}
	FileAccess.open("res://docs/HANGOUT_SAFETY_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

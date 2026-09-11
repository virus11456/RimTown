extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	SimAppointments.offer(w,"chen_wei");SimAppointments.respond(w,true)
	var appointment:=SimAppointments.current(w);var due:=int(appointment.due)
	w.quest_balance.leisure_plans_enabled=false
	for pair in [["chen_wei","lin_mei"],["lin_mei","chen_wei"]]:
		w.data.agents[pair[0]]._pendingHangout={"withId":pair[1],"location":"park","issued_tick":int(w.data.tickCount),"expires_at":due+4,"not_before":due-8,"agenda_until":due+8,"tick":2}
	var positions: Dictionary=app.motion.positions.duplicate(true);SimHangoutSafety.tick(w)
	var reason: String=w.quest_balance.hangout_status.chen_wei.reason
	for id in ["chen_wei","lin_mei"]:
		app.show_tab("居民",true);app.show_agenda(id);await settle()
		check(has_text(app.drawer_body,reason),"resident agenda exposes common cancellation reason: "+id)
		check(reason in SimPlayerChat.prompt(w,id,"原本的同行怎麼了？"),"chat prompt includes real cancelled-plan memory: "+id)
	check(equal(positions,app.motion.positions) and appointment.state=="accepted","reading cancellation cannot move residents or cancel player commitment")
	var memories: Dictionary={"chen_wei":w.data.agents.chen_wei.memory.duplicate(true),"lin_mei":w.data.agents.lin_mei.memory.duplicate(true)}
	app._load_document(JSON.stringify(app.progress_snapshot()),"social conflict native reload")
	var before:=w.snapshot();SimHangoutSafety.tick(w)
	check(equal(before,w.snapshot()) and equal(memories.chen_wei,w.data.agents.chen_wei.memory) and equal(memories.lin_mei,w.data.agents.lin_mei.memory),"native reload does not repeat paired cancellation memory")
	app.show_agenda("lin_mei");await settle();var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits and has_text(app.drawer_body,reason),"375px restored agenda keeps correct reason")
	var report:={"checks":checks,"failures":failures,"scope":"controlled overlapping pair and real accepted player card, both agenda pages and chat memory context, no position change, native replay protection and 375px width; no generated AI response claim"}
	FileAccess.open("res://docs/SOCIAL_CONFLICT_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

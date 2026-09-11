extends "res://tests/test_player_chat_ui.gd"
func action_for(parent: Node,label: String) -> Callable:
	for node in parent.get_children():
		if node is Button and node.text==label: return node.pressed.get_connections()[0].callable
	check(false,"missing action: "+label);return func(): pass
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var initial: Dictionary=app.progress_snapshot()
	for label in ["接受邀約","婉拒邀約","取消約定","申請順延一天","同意新時間","婉拒改約"]:
		app._load_document(JSON.stringify(initial),"card isolation fixture")
		var original_traits: Array=w.data.agents.chen_wei.personality.traits.duplicate()
		if label in ["同意新時間","婉拒改約"]: w.data.agents.chen_wei.jobKey=""
		SimAppointments.offer(w,"chen_wei")
		if label not in ["接受邀約","婉拒邀約"]: SimAppointments.respond(w,true)
		if label in ["同意新時間","婉拒改約"]:
			w.data.agents.chen_wei.personality.traits=["early_bird"];SimAppointments.tick(w)
			check(SimAppointments.current(w).state=="change_offered","controlled earlier sleep creates replacement card")
		app.show_tab("居民",true);app.show_appointment("chen_wei")
		var stale:=action_for(app.drawer_body,label);var old_key:=SimAppointments.card_key(SimAppointments.current(w))
		SimAppointments.finish(w,"cancelled","fixture end");w.data.agents.chen_wei.personality.traits=original_traits;w.data.tickCount+=96;w.data.clock.day+=1
		SimAppointments.offer(w,"chen_wei")
		if label in ["取消約定","申請順延一天"]: SimAppointments.respond(w,true)
		if label in ["同意新時間","婉拒改約"]:
			SimAppointments.respond(w,true);w.data.agents.chen_wei.personality.traits=["early_bird"];SimAppointments.tick(w)
		var new_key:=SimAppointments.card_key(SimAppointments.current(w));var before:=w.snapshot()
		check(old_key!=new_key,"replacement is a distinct appointment: "+label)
		stale.call();await settle()
		check(equal(before,w.snapshot()) and has_text(app.drawer_body,"約定已更新"),"stale card cannot change new appointment: "+label)
	app._load_document(JSON.stringify(initial),"same card native reload")
	SimAppointments.offer(w,"chen_wei");app.show_appointment("chen_wei")
	var accept:=action_for(app.drawer_body,"接受邀約");var key:=SimAppointments.card_key(SimAppointments.current(w))
	app._load_document(JSON.stringify(app.progress_snapshot()),"same appointment roundtrip")
	check(key==SimAppointments.card_key(SimAppointments.current(w)),"card identity survives numeric JSON normalization")
	accept.call();await settle();check(SimAppointments.current(w).state=="accepted","valid same appointment card remains usable after reload")
	var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"375px current appointment card fits")
	var report:={"checks":checks,"failures":failures,"scope":"six actual retained UI callbacks for accept/decline/cancel/player reschedule/NPC replacement accept/decline cannot touch new appointments; same-card native reload remains valid, phone width"}
	FileAccess.open("res://docs/APPOINTMENT_CARD_ISOLATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

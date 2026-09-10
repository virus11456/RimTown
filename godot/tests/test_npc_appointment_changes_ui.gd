extends "res://tests/test_appointments_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	w.data.agents.chen_wei.jobKey="" # Free-day fixture for return-window rescheduling.
	SimAppointments.offer(w,"chen_wei");SimAppointments.respond(w,true)
	# Controlled trigger: earlier sleep leaves less time for a normal walk home.
	w.data.agents.chen_wei.personality.traits=["early_bird"]
	app.show_tab("居民",true);app._tick_simulation();await settle()
	var a:=SimAppointments.current(w)
	check(a.state=="change_offered" and "提出改約" in app.status.text,"app tick emits visible NPC change notice")
	press(app.drawer_body,"見面約定 · 待回覆");await settle()
	check(has_text(app.drawer_body,"原約定已暫停"),"UI explains old appointment is suspended")
	var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"375px proposal fits")
	var path:=ProjectSettings.globalize_path("res://../../../outputs/居民改約待回覆.rimtown")
	var archive:=SaveArchive.encode(JSON.stringify(app.progress_snapshot()))
	var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(archive);file.close()
	app.dialog.file_selected.emit(path);await settle();a=SimAppointments.current(w)
	check(a.state=="change_offered" and int(a.proposal.hour)<int(a.hour),"native archive retains unaccepted alternative")
	app.show_appointment("chen_wei");press(app.drawer_body,"同意新時間");await settle()
	check(a.state=="accepted" and SimAppointments.free_hour(w,"chen_wei",int(a.hour)),"actual consent button applies new hour")
	app.motion.manual_player=true
	var arrived:=false;var maximum:=0.0
	for tick in 300:
		app._tick_simulation()
		for frame in 120:
			var previous:=Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)
			app.motion.update(w.data.agents)
			if SimAppointments.directing(w,"chen_wei"): maximum=maxf(maximum,previous.distance_to(Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)))
			SimAppointments.observe(w,app.motion)
		if a.state=="waiting": arrived=true;break
		if not SimAppointments.LIVE.has(a.state): break
	check(arrived,"NPC actually arrives at accepted replacement: "+str(a.reason))
	if arrived:
		check(walk_player(app,Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)),"player walks to replacement meeting")
		SimAppointments.observe(w,app.motion);check(a.state=="met","replacement concludes through physical proximity")
	check(maximum<=1,"replacement travel no teleport")
	# Re-open the same pending archive and exercise the other UI choice.
	app.dialog.file_selected.emit(path);await settle();a=SimAppointments.current(w);app.show_appointment("chen_wei")
	press(app.drawer_body,"婉拒改約");await settle()
	check(a.state=="cancelled" and has_text(app.drawer_body,"玩家婉拒改約"),"decline cancels old appointment with visible reason")
	var report:={"checks":checks,"failures":failures,"max_step_pixels":maximum,"scope":"configured free day and earlier sleep preference; actual app tick notification, mobile card, native archive, accept/reject callbacks, natural needs/time and physical NPC/player movement on replacement date; no live AI"}
	FileAccess.open("res://docs/NPC_APPOINTMENT_CHANGES_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

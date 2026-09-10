extends "res://tests/test_appointments_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	w.data.agents.chen_wei.jobKey="" # Controlled free-day fixture for the stricter return-time check.
	SimAppointments.offer(w,"chen_wei");app.show_tab("居民",true);app.show_appointment("chen_wei")
	press(app.drawer_body,"接受邀約");await settle()
	var a:=SimAppointments.current(w);var old_due:=int(a.due)
	press(app.drawer_body,"申請順延一天");await settle()
	check(int(a.due)==old_due+96 and has_text(app.drawer_body,"對方同意改期"),"button reschedules with actual result")
	check(has_text(app.drawer_body,"最近約定紀錄"),"reschedule history visible")
	var disabled:=false;var fits:=true
	for child in app.drawer_body.get_children():
		if child is Button and child.text=="申請順延一天": disabled=child.disabled
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(disabled and fits,"one-time limit disabled and 375px panel fits")
	var archive:=SaveArchive.encode(JSON.stringify(app.progress_snapshot()))
	var path:=ProjectSettings.globalize_path("res://../../../outputs/廣場改約後.rimtown")
	var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(archive);file.close()
	app.dialog.file_selected.emit(path);await settle();a=SimAppointments.current(w)
	check(int(a.reschedule_count)==1 and int(a.due)==old_due+96,"delivered archive restores changed appointment")
	app.motion.manual_player=true
	var arrived:=false;var maximum:=0.0;var old_active:=false;var decision_needs: Dictionary={}
	for tick in 300:
		decision_needs=w.data.agents.chen_wei.needs.duplicate(true)
		app._tick_simulation()
		if int(w.data.tickCount)==old_due: old_active=SimAppointments.directing(w,"chen_wei")
		for frame in 120:
			var previous:=Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)
			app.motion.update(w.data.agents)
			if SimAppointments.directing(w,"chen_wei"): maximum=maxf(maximum,previous.distance_to(Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)))
			SimAppointments.observe(w,app.motion)
		if a.state=="waiting": arrived=true;break
		if not SimAppointments.LIVE.has(a.state): break
	check(not old_active,"NPC does not keep old appointment travel window")
	var needs: Dictionary=decision_needs
	var needs_cancel: bool=a.state=="cancelled" and a.reason=="對方需要先休息或進食" and (float(needs.hunger)<15 or float(needs.rest)<10)
	check(arrived or needs_cancel,"rescheduled date reaches physical waiting or a verified urgent-needs cancellation: "+str(a.reason))
	if arrived:
		check(walk_player(app,Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)),"player can walk to rescheduled meeting")
		SimAppointments.observe(w,app.motion);check(a.state=="met","new date physically completes")
	check(maximum<=1,"rescheduled NPC walk does not teleport")
	app.show_appointment("chen_wei");await settle()
	check(has_text(app.drawer_body,"最近約定紀錄") and has_text(app.drawer_body,str(a.reason)),"history shows changed plan and terminal outcome")
	var report:={"checks":checks,"failures":failures,"max_step_pixels":maximum,"state":a,"needs_before_decision_tick":decision_needs,"scope":"controlled free-day NPC; valid natural urgent-needs cancellation is an outcome, not a completed meeting; actual reschedule button, mobile panel, delivered compressed native reload, natural ticks and SimMotion until rescheduled date, player collision movement and meeting; no live AI or visual art review"}
	FileAccess.open("res://docs/APPOINTMENT_RESCHEDULE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

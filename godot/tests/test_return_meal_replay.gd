extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var capture: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://docs/WANG_RETURN_REPLAY.json"))
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	app._load_document(JSON.stringify(capture.save),"natural return replay")
	var w: SimWorld=app.simulation;var rows: Array=[];var maximum:=0.0;var arrived_tick:=-1;var final_until:=int(w.data.agents.wang_li._hangoutHome.until);var seen_meal:=false;var allowance:=0;var resume_saved:=false
	for frame in int(capture.remaining_frames):
		app.motion.update(w.data.agents);SimAppointments.observe(w,app.motion);SimLeisurePlan.observe(w,app.motion);SimHangoutVisits.observe(w,app.motion)
	for tick in 14:
		app._tick_simulation()
		var a: Dictionary=w.data.agents.wang_li;seen_meal=seen_meal or a.activity=="eating"
		var task: Dictionary=a.get("_hangoutHome",{})
		if not task.is_empty(): final_until=int(task.until);allowance=int(task.get("meal_allowance_ticks",0))
		if task.get("meal_replanned",false) and not resume_saved:
			var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"meal allowance reload");a=w.data.agents.wang_li
			check(equal(task,a._hangoutHome),"meal replan metadata survives actual app reload")
			var before: Dictionary=a._hangoutHome.duplicate(true);SimHomeRest.resume_after_meal(w,a)
			check(equal(before,a._hangoutHome),"reload and repeated check cannot grant more allowance")
			resume_saved=true
		for frame in app.motion.frames_per_tick():
			var previous:=Vector2(app.motion.positions.wang_li.x,app.motion.positions.wang_li.y)
			app.motion.update(w.data.agents);SimAppointments.observe(w,app.motion);SimLeisurePlan.observe(w,app.motion);SimHangoutVisits.observe(w,app.motion)
			maximum=maxf(maximum,previous.distance_to(Vector2(app.motion.positions.wang_li.x,app.motion.positions.wang_li.y)))
			if arrived_tick<0 and SimHomeRest.arrived(w,a): arrived_tick=int(w.data.tickCount)
		rows.append({"tick":w.data.tickCount,"activity":a.activity,"hunger":a.needs.hunger,"deadline":final_until,"arrived":SimHomeRest.arrived(w,a)})
		if arrived_tick>=0: break
	check(seen_meal and resume_saved,"unchanged natural replay includes meal detour and one replan")
	check(allowance>0 and allowance<=4,"extra return allowance is needed and capped at one hour")
	check(arrived_tick>=0 and arrived_tick<final_until,"resident physically reaches own home before revised deadline")
	check(maximum<2,"return never teleports")
	var report:={"checks":checks,"failures":failures,"rows":rows,"arrival_tick":arrived_tick,"original_deadline":capture.save.agents.wang_li._hangoutHome.until,"revised_deadline":final_until,"meal_allowance_ticks":allowance,"max_step":maximum,"scope":"unmodified natural first-meeting snapshot plus remaining frames, actual app ticks and motion, meal replan reload; no edited needs, jobs or positions"}
	FileAccess.open("res://docs/RETURN_MEAL_REPLAY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

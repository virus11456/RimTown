extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var rows: Array=[];var captured:=false
	for t in 152:
		app._tick_simulation()
		for frame in app.motion.frames_per_tick():
			app.motion.update(w.data.agents);SimAppointments.observe(w,app.motion);SimLeisurePlan.observe(w,app.motion);SimHangoutVisits.observe(w,app.motion)
			if not captured and w.data.agents.wang_li.has("_hangoutHome"):
				captured=true;FileAccess.open("res://docs/WANG_RETURN_REPLAY_CURRENT.json",FileAccess.WRITE).store_string(JSON.stringify({"remaining_frames":app.motion.frames_per_tick()-frame-1,"save":app.progress_snapshot()}))
		if int(w.data.tickCount)>=136:
			var a: Dictionary=w.data.agents.wang_li
			rows.append({"tick":w.data.tickCount,"clock":w.data.clock.duplicate(true),"activity":a.activity,"location":a.currentLocation,"needs":a.needs.duplicate(true),"return":a.get("_hangoutHome",{}).duplicate(true),"motion":app.motion.positions.wang_li.duplicate(true),"arrived":SimHomeRest.arrived(w,a)})
	check(captured,"natural Wang Li meeting return captured")
	FileAccess.open("res://docs/RETURN_DIAGNOSIS_CURRENT.json",FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"rows":rows},"  "));print(JSON.stringify({"checks":checks,"failures":failures}));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var arrivals: Dictionary={};var maximum_step:=0.0
	for t in 192:
		app._tick_simulation()
		for frame in 120:
			var previous: Dictionary={}
			for id in app.motion.positions: previous[id]=Vector2(app.motion.positions[id].x,app.motion.positions[id].y)
			app.motion.update(w.data.agents)
			SimAppointments.observe(w,app.motion);SimLeisurePlan.observe(w,app.motion);SimHangoutVisits.observe(w,app.motion)
			for id in previous:
				if not app.motion.positions.has(id): continue
				var p: Dictionary=app.motion.positions[id];var a: Dictionary=w.data.agents[id]
				maximum_step=maxf(maximum_step,previous[id].distance_to(Vector2(p.x,p.y)))
				if a.activity in ["working","eating","sleeping"] and not p.walking and SimCareerPresence.place(app.motion,id)==a.currentLocation:
					arrivals[id+"|"+a.activity+"|"+a.currentLocation]=true
		if t==95:
			var saved: Dictionary=app.progress_snapshot();var before: Dictionary=app.motion.positions.duplicate(true)
			app._load_document(JSON.stringify(saved),"routine route reload")
			check(app.motion.stable_routes and equal(before,app.motion.positions),"app reload preserves physical routes and enables stable movement")
		if t%96==95: print("day ",t/96+1," arrivals ",arrivals.size())
	check(maximum_step<2,"original residents never teleport during ordinary or directed movement")
	for activity in ["working","eating","sleeping"]:
		check(arrivals.keys().any(func(key): return "|"+activity+"|" in key),"natural residents actually arrive for "+activity)
	var report:={"checks":checks,"failures":failures,"ticks":192,"motion_frames_per_tick":120,"maximum_step":maximum_step,"arrivals":arrivals.keys(),"scope":"two original app days, no changed destinations/jobs/needs/positions/resources, every motion frame displacement audited, distinct observed work/eating/sleep arrivals, day-one reload; headless, not universal arrival guarantee"}
	FileAccess.open("res://docs/ROUTINE_ROUTE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

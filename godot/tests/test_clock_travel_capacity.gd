extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var rows: Array=[];var before:=w.snapshot();var positions: Dictionary=app.motion.positions.duplicate(true)
	for id in w.data.agents:
		var a: Dictionary=w.data.agents[id]
		if a.get("isPlayer",false) or a.get("isDead",false): continue
		var job: Dictionary=w.rules.jobs.get(str(a.get("jobKey","")),{});var sleep_window:=SimShiftSleep.window(a,w.rules.jobs);var hours: Array=[]
		for hour in range(8,20):
			if SimAppointments.free_hour(w,id,hour): hours.append(hour)
		var square:=SimHangoutRoute.home_distance(app.motion,a,"town_square");var park:=SimHangoutRoute.home_distance(app.motion,a,"park")
		rows.append({"id":id,"name":a.name,"job":a.get("jobKey",""),"work_hours":job.get("work_hours",[]),"sleep_start":sleep_window.start,"sleep_end":sleep_window.end,"square_return_hours":(ceili(square/app.motion.travel_budget())+1)/4.0 if not is_inf(square) else -1,"park_return_hours":(ceili(park/app.motion.travel_budget())+1)/4.0 if not is_inf(park) else -1,"player_invitation_hours":hours})
	check(rows.all(func(row): return row.square_return_hours>=0 and row.park_return_hours>=0),"every original assigned home, including overflow housing, has a return route")
	check(equal(before,w.snapshot()) and equal(positions,app.motion.positions),"capacity audit does not change world or positions")
	var report:={"checks":checks,"failures":failures,"residents":rows,"scope":"read-only original app opening snapshot: actual normal-speed routes and current jobs/sleep windows; available invitation hours already include full two-hour wait; not actual player attendance"}
	FileAccess.open("res://docs/CLOCK_TRAVEL_CAPACITY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify({"checks":checks,"failures":failures}));quit(0 if failures.is_empty() else 1)

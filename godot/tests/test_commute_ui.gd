extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var shifts: Array=[];var maximum_step:=0.0
	for t in 192:
		app._tick_simulation()
		if int(w.data.clock.minute)==0:
			for id in w.data.agents:
				var a: Dictionary=w.data.agents[id];var job: Dictionary=w.rules.jobs.get(str(a.get("jobKey","")),{})
				if a.get("isPlayer",false) or a.get("isDead",false) or job.is_empty() or int(w.data.clock.hour)!=int(job.work_hours[0]): continue
				shifts.append({"id":id,"tick":w.data.tickCount,"workplace":job.workplace,"actual_place":SimCareerPresence.place(app.motion,id),"on_time":SimCareerPresence.place(app.motion,id)==job.workplace,"activity":a.activity})
		for frame in 120:
			var before: Dictionary={}
			for id in app.motion.positions: before[id]=Vector2(app.motion.positions[id].x,app.motion.positions[id].y)
			app.motion.update(w.data.agents);SimAppointments.observe(w,app.motion);SimLeisurePlan.observe(w,app.motion);SimHangoutVisits.observe(w,app.motion)
			for id in before:
				if app.motion.positions.has(id): maximum_step=maxf(maximum_step,before[id].distance_to(Vector2(app.motion.positions[id].x,app.motion.positions[id].y)))
	var baseline: bool="--baseline" in OS.get_cmdline_user_args()
	var on_time:=shifts.filter(func(row): return row.on_time).size()
	check(not shifts.is_empty(),"natural scheduled shifts observed")
	check(maximum_step<2,"commuting never teleports")
	if not baseline: check(on_time>0,"natural residents can reach work by shift start")
	var report:={"checks":checks,"failures":failures,"shifts":shifts,"on_time":on_time,"total":shifts.size(),"maximum_step":maximum_step,"scope":"two original app days with real movement, measured actual venue at scheduled work start before movement of that tick; no changed jobs/needs/positions/resources, not proof of every worker arriving on time"}
	FileAccess.open("res://docs/COMMUTE_BASELINE.json" if baseline else "res://docs/COMMUTE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

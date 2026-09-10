extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	check(SimLeisurePlan.enabled(w),"app default enabled")
	app._tick_simulation()
	app.show_tab("居民",true);app.show_agenda("chen_wei");await settle()
	check(has_text(app.drawer_body,"今日自主休閒安排"),"agenda exposes plan")
	var fits:=true
	for c in app.drawer_body.get_children():
		if c is Control and c.size.x>app.drawer.size.x: fits=false
	check(fits,"375px agenda fits")
	var completed:=[];var max_step:=0.0
	for t in 80:
		app._tick_simulation()
		for frame in app.motion.frames_per_tick():
			var before: Dictionary=app.motion.positions.duplicate(true)
			app.motion.update(w.data.agents)
			for id in SimLeisurePlan.plans(w):
				if SimLeisurePlan.directing(w,id) and before.has(id) and app.motion.positions.has(id):
					var a: Dictionary=before[id];var b: Dictionary=app.motion.positions[id]
					var step:=Vector2(a.x,a.y).distance_to(Vector2(b.x,b.y))
					max_step=maxf(max_step,step)
			SimLeisurePlan.observe(w,app.motion)
		for id in SimLeisurePlan.plans(w):
			if SimLeisurePlan.plans(w)[id].state=="completed" and not completed.has(id): completed.append(id)
	check(not completed.is_empty(),"original residents physically complete with normal simulation and motion")
	check(max_step<2.0,"directed travel has no teleport")
	var before: Dictionary=SimLeisurePlan.plans(w).duplicate(true)
	var path:=ProjectSettings.globalize_path("res://../../../outputs/居民自主休閒.rimtown")
	var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())));file.close()
	app.dialog.file_selected.emit(path);await settle()
	check(equal(before,SimLeisurePlan.plans(app.simulation)),"native archive restores plan states")
	var report:={"checks":checks,"failures":failures,"completed_residents":completed,"maximum_directed_frame_displacement":max_step,"scope":"original app residents, 80 normal simulation ticks with 480 movement frames each, no position/needs/job changes, phone agenda and native archive"}
	FileAccess.open("res://docs/LEISURE_PLAN_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

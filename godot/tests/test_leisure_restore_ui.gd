extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;w.quest_balance.leisure_plans_enabled=true
	w.data.clock.hour=8;w.data.clock.minute=0;SimLeisurePlan.tick(w)
	var p: Dictionary=SimLeisurePlan.plans(w).chen_wei
	w.data.agents.chen_wei.jobKey="";w.data.agents.chen_wei.needs.hunger=80;w.data.agents.chen_wei.needs.rest=80
	w.data.tickCount=p.due;w.data.clock.hour=p.hour
	var point: Vector2=app.motion.layout._nearest(app.motion.layout._center(p.place))
	app.motion.positions.chen_wei.x=point.x;app.motion.positions.chen_wei.y=point.y
	SimLeisurePlan.observe(w,app.motion);w.data.tickCount+=1;SimLeisurePlan.observe(w,app.motion)
	check(p.dwell==1,"fixture has one physically observed segment")
	var baseline: Dictionary=app.progress_snapshot()
	for mode in ["complete","missing_all","missing_resident"]:
		var snapshot:=baseline.duplicate(true)
		if mode=="missing_all": snapshot._godot4a.erase("motion")
		if mode=="missing_resident": snapshot._godot4a.motion.erase("chen_wei")
		var path:=ProjectSettings.globalize_path("res://tests/restore-"+mode+".json.tmp")
		var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(SaveArchive.encode(JSON.stringify(snapshot)));file.close()
		app.dialog.file_selected.emit(path);await settle();p=SimLeisurePlan.plans(w).chen_wei
		if mode=="complete":
			check(p.dwell==1 and p.state=="attending","complete physical save preserves earned dwell")
			w.data.tickCount+=1;SimLeisurePlan.observe(w,app.motion)
			check(p.state=="completed","complete save continues normally")
		else:
			check(p.dwell==0 and not p.has("observed_tick"),"missing position resets old dwell: "+mode)
			check(p.get("arrival_observed",false) and "gap" in p.interruptions,"past arrival retained but continuity gap recorded: "+mode)
			var need: float=w.data.agents.chen_wei.needs.recreation
			w.data.tickCount+=1;SimLeisurePlan.observe(w,app.motion)
			check(p.state!="completed" and w.data.agents.chen_wei.needs.recreation==need,"rebuilt or absent position cannot cash old dwell: "+mode)
		DirAccess.remove_absolute(path)
	var report:={"checks":checks,"failures":failures,"scope":"controlled actual-position dwell fixture; native compressed load with complete, absent and partial motion data, preserve earned normal progress, reset unverifiable continuity without rewards"}
	FileAccess.open("res://docs/LEISURE_RESTORE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

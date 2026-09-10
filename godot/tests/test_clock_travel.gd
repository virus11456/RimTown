extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	check(app.motion.frames_per_tick()==480,"3D clock grants 480 ordinary motion frames per quarter hour")
	check(app.motion.travel_budget()==120 and app.motion.travel_budget(true)==240,"ordinary and approach estimates share the clock cadence")
	var legacy:=SimMotion.new()
	check(legacy.frames_per_tick()==120 and legacy.travel_budget()==30,"pure source simulation retains original timing")
	var snapshot: Dictionary=app.progress_snapshot()
	for speed in [1,4,16]:
		app._load_document(JSON.stringify(snapshot),"clock speed fixture")
		app.running=true;app.speed=speed;app.frame_accumulator=0;app.tick_accumulator=0
		var before:=int(app.simulation.data.tickCount)
		for frame in 480/speed-1: app._process(1.0/60)
		check(int(app.simulation.data.tickCount)==before,"no early simulation tick at speed "+str(speed))
		app._process(1.0/60)
		check(int(app.simulation.data.tickCount)==before+1,"one quarter hour after full frame budget at speed "+str(speed))
	app.running=false
	app.tick_accumulator=3.0
	var saved: Dictionary=app.progress_snapshot();var positions: Dictionary=app.motion.positions.duplicate(true)
	app._load_document(JSON.stringify(saved),"same cadence reload")
	check(is_equal_approx(app.tick_accumulator,3.0),"new save preserves partial clock phase")
	check(equal(positions,app.motion.positions),"reload preserves actual positions")
	saved._godot4a.erase("tick_seconds");saved._godot4a.tick_accumulator=1.0
	app._load_document(JSON.stringify(saved),"legacy cadence reload")
	check(is_equal_approx(app.tick_accumulator,4.0),"old half-tick resumes halfway through new clock")
	check(equal(positions,app.motion.positions),"legacy migration never relocates residents")
	var report:={"checks":checks,"failures":failures,"scope":"actual app process at 1x/4x/16x, old and new partial-tick saves, exact position preservation, shared route budgets and pure-source cadence"}
	FileAccess.open("res://docs/CLOCK_TRAVEL_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

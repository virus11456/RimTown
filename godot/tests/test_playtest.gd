extends SceneTree
var failures: Array[String]=[]
var checks:=0
var app: Node
func check(value: bool,message: String) -> void:
	checks+=1
	if not value: failures.append(message)
func _initialize() -> void: call_deferred("run")
func settle() -> void:
	for i in 4: await process_frame
func button(node: Node,text: String) -> Button:
	if node is Button and node.text==text: return node
	for child in node.get_children():
		var found:=button(child,text)
		if found!=null: return found
	return null
func click(text: String) -> void:
	var control:=button(app,text)
	check(control!=null,"button exists: "+text)
	if control==null: return
	var point:=control.get_global_rect().get_center()
	for pressed in [true,false]:
		var event:=InputEventMouseButton.new()
		event.position=point; event.button_index=MOUSE_BUTTON_LEFT; event.pressed=pressed
		root.push_input(event,true)
		await process_frame
	await settle()
func run() -> void:
	root.size=Vector2i(1280,800)
	app=load("res://scenes/main.tscn").instantiate(); root.add_child(app)
	await settle()
	app.simulation.social_enabled=false # Keep historical Phase 4a preservation assertions; enabled mode has its own oracle/UI tests.
	app.set_process(false) # Time under test is deterministic, driven explicitly below.
	app.simulation.inner_voice_enabled=false # Preserve the older suite scope.
	app.simulation.thoughts_enabled=false # Earlier feature suites keep their original scope.
	app.simulation.factions_enabled=false # This suite isolates its historical subsystem.
	app.simulation.feuds_enabled=false # Keep this historical suite within its original scope.
	app.simulation.romance_enabled=false # This suite isolates pre-romance behavior.
	var raw: String=app.document.serialize()
	check(not app.running,"starts paused")
	await click("＋15 分")
	check(app.simulation.data.tickCount==1 and app.simulation.data.clock.minute==15,"single step advances clock")
	check(app.document.serialize()==raw,"simulation leaves original bytes untouched")
	await click("▶ 繼續")
	check(app.running,"play button starts")
	for i in 120: app._process(1.0/60)
	check(app.simulation.data.tickCount==2,"1x advances one tick in 2 seconds")
	var first: String=app.motion.positions.keys()[0]
	var position: Dictionary=app.motion.positions[first].duplicate(true)
	await click("Ⅱ 暫停")
	app._process(.25)
	check(not app.running and app.motion.positions[first]==position,"pause freezes motion")
	await click("1×")
	check(app.speed==4,"4x speed selected")
	await click("▶ 繼續")
	for i in 120: app._process(1.0/60)
	check(app.simulation.data.tickCount==6,"4x advances four ticks in 2 seconds")
	await click("Ⅱ 暫停")
	var restored: Node=load("res://scenes/main.tscn").instantiate()
	root.add_child(restored)
	restored.set_process(false)
	restored._load_document(JSON.stringify(app.progress_snapshot(),"",false,true),"續跑測試")
	app.running=true
	restored.running=true
	restored.speed=app.speed
	for i in 120:
		app._process(1.0/60)
		restored._process(1.0/60)
	check(JSON.parse_string(JSON.stringify(app.progress_snapshot(),"",false,true))==JSON.parse_string(JSON.stringify(restored.progress_snapshot(),"",false,true)),"full save/resume preserves motion and clock phase")
	if not failures.is_empty():
		FileAccess.open("res://tests/phase4a/resume-a.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
		FileAccess.open("res://tests/phase4a/resume-b.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(restored.progress_snapshot(),"",false,true))
	app.running=false
	restored.queue_free()
	await settle()
	var snapshot: Dictionary=app.simulation.snapshot()
	var resumed:=SimWorld.new(); resumed.load_snapshot(JSON.parse_string(JSON.stringify(snapshot,"",false,true)))
	for i in 100: app.simulation.tick(); resumed.tick()
	check(JSON.stringify(app.simulation.snapshot(),"",false,true)==JSON.stringify(resumed.snapshot(),"",false,true),"save/resume remains identical for 100 ticks")
	var current: Dictionary=app.simulation.snapshot()
	var source: Dictionary=JSON.parse_string(raw)
	for key in source:
		if key not in ["clock","agents","tickCount"]: check(current[key]==source[key],"preserved subsystem: "+key)
	for id in source.agents:
		for key in source.agents[id]:
			if key not in ["needs","activity","currentLocation","mood","skills","currentThought","_locationStayRemaining"]:
				check(current.agents[id][key]==source.agents[id][key],"preserved agent field: "+id+"/"+key)
	var future:=source.duplicate(true)
	future.futureSystem={"nested":[1,"value",{"keep":true}]}
	future.agents[first].futureField={"untouched":[7,8,9]}
	var future_world:=SimWorld.new(); future_world.load_snapshot(future); future_world.tick()
	check(future_world.snapshot().futureSystem==future.futureSystem and future_world.snapshot().agents[first].futureField==future.agents[first].futureField,"future nested keys survive ticking")
	# File produced for an independent original-JS load test, not a live-server upload.
	FileAccess.open("res://tests/phase4a/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(current,"",false,true))
	var clock_data:={"year":1,"season":"冬季","day":15,"hour":23,"minute":45}
	check(SimClock.tick(clock_data)==["new_hour","new_day","new_year","new_season"] and clock_data.year==2 and clock_data.season=="春季","year rollover matches event order")
	root.size=Vector2i(375,812); await settle()
	check(app.playback.get_global_rect().end.x<=375,"mobile playback fits")
	await click("＋15 分")
	check(not app.running,"mobile single step pauses")
	check(app.header.get_global_rect().end.x<=375 and app.summary.get_global_rect().end.x<=375 and app.header.size.y<=110,"mobile clock header stays compact")
	var incomplete:=SimWorld.new()
	incomplete.load_snapshot({"clock":{},"agents":{},"townMap":{"locations":{}}})
	check(not incomplete.validation_error().is_empty(),"incomplete save cannot start simulation")
	check(app.simulation.validation_error().is_empty(),"normal save can simulate")
	var report:={"checks":checks,"failures":failures,"scope":"Phase 4a controls, deterministic resume, untouched subsystem and unknown-field preservation"}
	FileAccess.open("res://docs/PLAYTEST_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report)); quit(0 if failures.is_empty() else 1)

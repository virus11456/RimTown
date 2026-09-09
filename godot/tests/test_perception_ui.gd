extends SceneTree
var checks:=0
var failures: Array=[]
func check(value: bool,message: String) -> void:
	checks+=1
	if not value: failures.append(message)
func press(parent: Node,text: String) -> void:
	for child in parent.get_children():
		if child is Button and child.text==text: child.pressed.emit();return
	check(false,"missing button "+text)
func has_text(parent: Node,text: String) -> bool:
	for child in parent.get_children():
		if child is Label and text in child.text: return true
	return false
func _initialize() -> void: call_deferred("run")
func equal(a: Variant,b: Variant) -> bool:
	if (a is float or a is int) and (b is float or b is int): return absf(float(a)-float(b))<.00000001
	if a is Dictionary and b is Dictionary:
		if a.size()!=b.size(): return false
		for key in a:
			if not b.has(key) or not equal(a[key],b[key]): return false
		return true
	if a is Array and b is Array:
		if a.size()!=b.size(): return false
		for i in a.size():
			if not equal(a[i],b[i]): return false
		return true
	return a==b
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false)
	check(app.simulation.perception_enabled,"fresh import enabled")
	var raw: String=app.document.serialize()
	var w: SimWorld=app.simulation;var a: Dictionary=w.data.agents.chen_wei
	for actor in w.data.agents.values(): actor.activity="sleeping"
	a.activity="wandering";a.currentLocation="town_square"
	w.data.agents.lin_mei.activity="working";w.data.agents.lin_mei.currentLocation="town_square"
	for i in 400: w.data.tickCount+=1;SimPerception.process(a,w)
	check(w.runtime[a.id].obs_count==6,"daily cap reached")
	var memory:=SimMemory.new();memory.load_entries(a.memory)
	check(memory.about_agent("林美",10).any(func(e): return e.category=="observation"),"observation retrievable by person")
	app.has_simulated=true;app.show_tab("居民",true);app.show_memories(a.id)
	check(has_text(app.drawer_body,"看到林美正忙著工作"),"observation visible")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px width")
	check(app.document.serialize()==raw,"original unchanged")
	FileAccess.open("res://tests/perception/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_tab("設定",true);press(app.drawer_body,"居民環境感知：開啟")
	app._load_document(JSON.stringify(app.progress_snapshot(),"",false,true),"resume")
	w=app.simulation;a=w.data.agents.chen_wei
	check(not w.perception_enabled and w.runtime[a.id].obs_count==6,"mode and cap survive reload")
	var count: int=a.memory.size();var seed:=w.rng.state
	for i in 100: w.data.tickCount+=1;SimPerception.process(a,w)
	check(a.memory.size()==count and w.rng.state==seed,"reloading does not bypass cap")
	app.show_tab("設定",true);press(app.drawer_body,"居民環境感知：關閉")
	w.data.clock.day+=1
	for i in 400: w.data.tickCount+=1;SimPerception.process(a,w)
	check(a.memory.size()==count+6,"new day resets allowance")
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 96: app._tick_simulation();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"all-mode resume")
	var report:={"checks":checks,"failures":failures,"scope":"prepared observation, memory lookup/mobile display, mode and daily cap reload, new-day reset, original preservation and all-mode JSON/RNG resume"}
	FileAccess.open("res://docs/PERCEPTION_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

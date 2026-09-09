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
	check(app.simulation.trace_enabled,"fresh imports record traces")
	var raw: String=app.document.serialize()
	app.show_tab("居民",true);app.show_agent("chen_wei",false);press(app.drawer_body,"今日足跡")
	check(has_text(app.drawer_body,"今天尚無足跡"),"empty page")
	for i in 40: app._tick_simulation()
	var w: SimWorld=app.simulation;var a: Dictionary=w.data.agents.chen_wei
	check(a.todayTrace.size()>1,"normal ticks record changing activities")
	check(app.resident_page=="trace" and has_text(app.drawer_body,"今日足跡"),"selected page refreshes")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px width")
	check(not w.data.agents.player.has("todayTrace"),"NPC-only recording")
	check(app.document.serialize()==raw,"original preserved")
	FileAccess.open("res://tests/trace/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_tab("設定",true);press(app.drawer_body,"居民足跡：開啟")
	var old: Array=a.todayTrace.duplicate(true)
	app._tick_simulation()
	check(equal(old,a.todayTrace),"disabled mode leaves trace intact")
	app._load_document(JSON.stringify(app.progress_snapshot(),"",false,true),"resume")
	check(not app.simulation.trace_enabled,"mode restored")
	app.show_tab("設定",true);press(app.drawer_body,"居民足跡：關閉")
	w=app.simulation
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 96: app._tick_simulation();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"all mode resume across midnight")
	a=w.data.agents.chen_wei
	check(a._traceDay==SimTrace.day_key(w.data.clock),"new day key")
	w.data.clock.day+=1;app.has_simulated=true;app.show_trace(a.id)
	check(has_text(app.drawer_body,"今天尚無足跡"),"stale previous day hidden before next record")
	var report:={"checks":checks,"failures":failures,"scope":"normal NPC ticks, live page, 375px layout, mode, stale day display, original/player preservation and JSON/RNG resume across midnight"}
	FileAccess.open("res://docs/TRACE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

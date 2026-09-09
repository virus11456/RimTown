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
	app.simulation.perception_enabled=false # Isolate prior suites.
	app.simulation.trace_enabled=false # Isolate prior suites.
	app.simulation.mourning_enabled=false # Isolate earlier suites.
	app.simulation.mischief_enabled=false # Isolate earlier suites.
	check(app.simulation.stargazing_enabled,"fresh import enables stargazing")
	var raw: String=app.document.serialize()
	var w: SimWorld=app.simulation
	var a: Dictionary=w.data.agents.chen_wei
	var b: Dictionary=w.data.agents.lin_mei
	w.data.clock.hour=23
	for actor in [a,b]:
		actor.activity="stargazing";actor.currentLocation="town_square";actor.personality.traits=["night_owl"]
		actor.needs.rest=100;actor.needs.hunger=100
	var old_player: Dictionary=w.data.agents.player.duplicate(true)
	var old_mood: float=w.runtime[a.id].moodModifier
	var old_memory: int=a.memory.size()
	var found:=false
	for i in 600:
		SimStargazing.process(a,w)
		if w.data.messageLog.back().type=="discovery": found=true;break
	check(found,"prepared scenario reaches discovery")
	check(w.runtime[a.id].moodModifier>old_mood,"stargazing mood bonus")
	check(a.memory.size()>old_memory,"discovery and bonding create memories")
	check(equal(old_player,w.data.agents.player),"unrelated player unchanged")
	app.has_simulated=true
	app.show_tab("居民",true);app.show_thoughts(a.id)
	check(has_text(app.drawer_body,a.currentThought),"discovery visible as current voice")
	app.show_memories(a.id)
	check(has_text(app.drawer_body,a.currentThought),"discovery visible in memory page")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px memory content width")
	check(app.document.serialize()==raw,"original document preserved")
	FileAccess.open("res://tests/stargazing/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_tab("設定",true);press(app.drawer_body,"觀星互動：開啟")
	check(not w.stargazing_enabled,"toggle off")
	app._load_document(JSON.stringify(app.progress_snapshot(),"",false,true),"resume")
	check(not app.simulation.stargazing_enabled,"disabled mode survives JSON load")
	app.show_tab("設定",true);press(app.drawer_body,"觀星互動：關閉")
	check(app.simulation.stargazing_enabled,"toggle on")
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(app.simulation.snapshot(),"",false,true)))
	for i in 96: app._tick_simulation();resumed.tick()
	check(equal(app.simulation.snapshot(),resumed.snapshot()),"all enabled modes resume through a day")
	var report:={"checks":checks,"failures":failures,"scope":"prepared discovery, mood/memory and mobile resident pages, unrelated player, original data, toggle and all-mode JSON/RNG resume; Godot button signals"}
	FileAccess.open("res://docs/STARGAZING_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

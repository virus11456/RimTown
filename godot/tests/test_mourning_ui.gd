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
	check(app.simulation.mourning_enabled,"fresh import enables mourning")
	var raw: String=app.document.serialize()
	var w: SimWorld=app.simulation
	var a: Dictionary=w.data.agents.chen_wei
	a._mourningTargets=[{"name":"祖母","isFamily":true,"custom":"保留"},{"name":"故友","isFamily":false}]
	a._annualMourning=[];a.activity="mourning";a.currentLocation="cemetery"
	var player: Dictionary=w.data.agents.player.duplicate(true)
	var previous: float=w.runtime[a.id].moodModifier
	for i in 100:
		SimMourning.process(a,w)
		if a._mourningTargets.size()==1: break
	check(a._mourningTargets.size()==1 and a._mourningTargets[0].name=="故友","process only first recent entry")
	check(a._annualMourning.size()==1 and a._annualMourning[0].lastVisitYear==w.data.clock.year,"family added to annual list")
	check(absf(w.runtime[a.id].moodModifier-previous-.3)<.00000001,"recent mourning comforts")
	app.has_simulated=true
	FileAccess.open("res://tests/mourning/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_tab("居民",true);app.show_memories(a.id)
	check(has_text(app.drawer_body,"前往墓園弔念祖母"),"recent memory visible")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px memory content width")
	check(equal(player,w.data.agents.player),"unrelated player unchanged")
	check(app.document.serialize()==raw,"original document preserved")
	app.show_tab("設定",true);press(app.drawer_body,"居民弔念：開啟")
	check(not w.mourning_enabled,"toggle off")
	app._load_document(JSON.stringify(app.progress_snapshot(),"",false,true),"resume")
	w=app.simulation;a=w.data.agents.chen_wei;app.has_simulated=true
	check(not w.mourning_enabled and a._mourningTargets.size()==1,"pending queue and disabled mode restored")
	app.show_tab("設定",true);press(app.drawer_body,"居民弔念：關閉")
	for i in 100: SimMourning.process(a,w)
	check(a._mourningTargets.is_empty() and a._annualMourning.size()==1,"friend processed without annual entry")
	var count: int=a.memory.size()
	for i in 100: SimMourning.process(a,w)
	check(a.memory.size()==count,"no duplicate visit this year")
	w.data.clock.year+=1
	previous=w.runtime[a.id].moodModifier
	for i in 100: SimMourning.process(a,w)
	check(a.memory.size()==count+1 and w.runtime[a.id].moodModifier==previous-2,"one annual visit next year")
	app.show_thoughts(a.id)
	check(has_text(app.drawer_body,"又到了一年...去看看祖母吧。"),"annual voice visible")
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 96: app._tick_simulation();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"all-mode JSON/RNG resume")
	var report:={"checks":checks,"failures":failures,"scope":"recent FIFO, annual once per year, memory/voice mobile pages, original/player preservation, pending queue and mode save, all-mode resume; Godot button signals"}
	FileAccess.open("res://docs/MOURNING_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

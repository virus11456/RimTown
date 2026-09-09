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
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false)
	app.simulation.inner_voice_enabled=false # Preserve the older suite scope.
	app.simulation.thoughts_enabled=false # Earlier feature suites keep their original scope.
	app.simulation.factions_enabled=false # This suite isolates its historical subsystem.
	app.simulation.feuds_enabled=false # Keep this historical suite within its original scope.
	var raw: String=app.document.serialize()
	check(app.simulation.romance_enabled,"fresh import enables daily relationships")
	app.show_tab("設定",true);press(app.drawer_body,"每日關係事件：開啟")
	check(not app.simulation.romance_enabled,"toggle off")
	var before: Dictionary=app.simulation.data.agents.duplicate(true)
	app.simulation.social_enabled=false
	for i in 96: app._tick_simulation()
	for id in before: check(app.simulation.data.agents[id].relationships==before[id].relationships,"disabled relationships "+id)
	check(app.document.serialize()==raw,"original bytes unchanged by simulation")
	app._load_document(JSON.stringify(app.progress_snapshot(),"",false,true),"resume")
	check(not app.simulation.romance_enabled,"mode survives save")
	app.show_tab("設定",true);press(app.drawer_body,"每日關係事件：關閉")
	var data: Dictionary=app.simulation.data
	for person in data.agents.values(): person.relationships={}
	var a: Dictionary=data.agents.chen_wei
	var b: Dictionary=data.agents.lin_mei
	var ra:=SimSocial.relationship(a,b);var rb:=SimSocial.relationship(b,a)
	for r in [ra,rb]: r.status="dating";r.statusSince=0;r.affinity=80;r.romanticInterest=70
	data.tickCount=1000;data.clock.hour=23;data.clock.minute=30
	app.show_tab("故事",true);press(app.drawer_body,"關係事件")
	app._tick_simulation()
	check(ra.status=="dating","no relationship processing before midnight")
	app.simulation.rng.state=11456
	app._tick_simulation()
	check(ra.status=="married" and rb.status=="married","marriage runs at day boundary")
	check(ra.statusSince==1002,"event records the boundary tick")
	check(app.romance_page and not app.gossip_page and not app.conversation_page,"event page retained while ticking")
	check(has_text(app.drawer_body,"結婚了"),"marriage visible in event panel")
	check(a.thoughts.any(func(t): return t.kind=="married"),"marriage thought")
	check(a.memory.any(func(m): return "結婚了" in m.content),"marriage memory")
	check(data.gossip.any(func(g): return "婚禮好浪漫" in g.content),"marriage gossip")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"event panel fits 375px")
	press(app.drawer_body,"返回故事");press(app.drawer_body,"八卦與鎮民動態")
	check(app.gossip_page and not app.romance_page,"gossip navigation clears event page")
	app.show_tab("故事",true);press(app.drawer_body,"關係事件")
	var exported: Dictionary=app.progress_snapshot()
	FileAccess.open("res://tests/romance/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(exported,"",false,true))
	app._load_document(JSON.stringify(exported,"",false,true),"marriage resume")
	check(app.simulation.data.agents.chen_wei.relationships.lin_mei.status=="married","marriage restored")
	check(app.simulation.romance_enabled,"enabled mode restored")
	# A one-ULP JSON roundtrip must not change flooring at future attraction thresholds.
	var w:=SimWorld.new();w.load_snapshot(exported)
	w.data.agents.chen_wei.relationships.lin_mei.affinity=35.8
	var exact: float=w.data.agents.chen_wei.relationships.lin_mei.affinity
	var saved: Dictionary=JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true))
	var resumed:=SimWorld.new();resumed.load_snapshot(saved)
	check(resumed.data.agents.chen_wei.relationships.lin_mei.affinity==exact,"relationship float restored exactly")
	saved.agents.chen_wei.relationships.lin_mei.affinity=50
	resumed.load_snapshot(saved)
	check(resumed.data.agents.chen_wei.relationships.lin_mei.affinity==50,"external edit overrides precision extension")
	var report:={"checks":checks,"failures":failures,"scope":"daily switch, midnight marriage, memories/gossip, save precision and external edits, mobile page; button signals"}
	FileAccess.open("res://docs/ROMANCE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

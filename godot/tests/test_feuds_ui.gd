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
	app.simulation.trace_enabled=false # Isolate prior suites.
	app.simulation.mourning_enabled=false # Isolate earlier suites.
	app.simulation.mischief_enabled=false # Isolate earlier suites.
	app.simulation.stargazing_enabled=false # Isolate the existing feature suite.
	app.simulation.inner_voice_enabled=false # Preserve the older suite scope.
	app.simulation.thoughts_enabled=false # Earlier feature suites keep their original scope.
	app.simulation.factions_enabled=false # This suite isolates its historical subsystem.
	var raw: String=app.document.serialize()
	check(app.simulation.feuds_enabled,"fresh import enables feuds")
	app.simulation.social_enabled=false;app.simulation.romance_enabled=false
	var data: Dictionary=app.simulation.data
	for person in data.agents.values(): person.relationships={}
	var a: Dictionary=data.agents.chen_wei;var b: Dictionary=data.agents.lin_mei
	var witness: Dictionary=data.agents.values().filter(func(p): return p.id!=a.id and p.id!=b.id and not p.isPlayer)[0]
	var ra:=SimSocial.relationship(a,b);var rb:=SimSocial.relationship(b,a)
	ra.affinity=-35;rb.affinity=-35;ra.future={"keep":true}
	SimSocial.relationship(witness,a).affinity=40
	data.clock.hour=23;data.clock.minute=30;data.tickCount=1000;data.feudCooldown={};data.messageLog=[]
	app.show_tab("故事",true);press(app.drawer_body,"關係事件")
	app._tick_simulation()
	check(data.messageLog.is_empty(),"no feud before midnight")
	app.simulation.rng.state=11456;app._tick_simulation()
	check(ra.affinity==-39 and rb.affinity==-39,"midnight argument affects both residents")
	check(witness.relationships[b.id].affinity==-3,"witness takes friend's side")
	check(witness.memory.any(func(m): return "我當然站" in m.content),"witness remembers argument")
	check(has_text(app.drawer_body,"大吵一架"),"argument visible in relationship events")
	var count: int=data.messageLog.size()
	for i in 96: app._tick_simulation()
	check(data.messageLog.size()==count,"cooldown prevents next-day repeat")
	app.show_tab("設定",true);press(app.drawer_body,"每日仇怨事件：開啟")
	ra.affinity=-60;rb.affinity=-60
	for i in 96: app._tick_simulation()
	check(not ra.get("isFeud",false),"disabled mode prevents severance")
	check(app.document.serialize()==raw,"original bytes unchanged")
	var saved: Dictionary=app.progress_snapshot()
	app._load_document(JSON.stringify(saved,"",false,true),"resume")
	check(not app.simulation.feuds_enabled,"mode restored independently")
	app.show_tab("設定",true);press(app.drawer_body,"每日仇怨事件：關閉")
	app.show_tab("故事",true);press(app.drawer_body,"關係事件")
	for i in 96: app._tick_simulation()
	data=app.simulation.data;ra=data.agents.chen_wei.relationships.lin_mei
	check(ra.isFeud and data.agents.lin_mei.relationships.chen_wei.isFeud,"both severance flags set")
	check(ra.future.keep,"unknown relationship field retained")
	check(app.romance_page and has_text(app.drawer_body,"正式絕交"),"event page retained with severance")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px event width")
	app.show_tab("居民",true);app.show_relationships("chen_wei")
	check(has_text(app.drawer_body,"已絕交"),"resident relationship shows severance")
	FileAccess.open("res://tests/feuds/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(app.simulation.snapshot(),"",false,true)))
	for i in 96: app.simulation.tick();resumed.tick()
	check(equal(app.simulation.snapshot(),resumed.snapshot()),"cooldown and flags resume identically")
	var report:={"checks":checks,"failures":failures,"scope":"midnight argument, witnesses, cooldown, toggle, severance, mobile page, JSON resume; button signals"}
	FileAccess.open("res://docs/FEUDS_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

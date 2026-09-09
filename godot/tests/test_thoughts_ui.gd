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
	app.simulation.stargazing_enabled=false # Isolate the existing feature suite.
	app.simulation.inner_voice_enabled=false # Preserve the older suite scope.
	check(app.simulation.thoughts_enabled,"fresh import enables daily thoughts")
	app.simulation.social_enabled=false;app.simulation.romance_enabled=false;app.simulation.feuds_enabled=false;app.simulation.factions_enabled=false
	var original: String=app.document.serialize()
	var data: Dictionary=app.simulation.data
	var a: Dictionary=data.agents.chen_wei;var b: Dictionary=data.agents.lin_mei
	var relation:=SimSocial.relationship(a,b);relation.affinity=10
	var today:=SimClock.total_days(data.clock)
	a.thoughts=[{"kind":"jealous","label":"嫉妒的煎熬","mood":-8,"opinion":-2,"targetId":b.id,"targetName":b.name,"start":today,"days":3,"future":{"keep":true}},{"kind":"broke_up","label":"剛失戀","mood":-15,"opinion":0,"targetId":null,"targetName":null,"start":today,"days":1}]
	app.has_simulated=true
	app.show_tab("居民",true);app.show_agent(a.id,false);press(app.drawer_body,"目前想法")
	check(has_text(app.drawer_body,"嫉妒的煎熬") and has_text(app.drawer_body,"每日 -2.0"),"shows label and directed daily opinion")
	check(has_text(app.drawer_body,"剩餘 3 天") and has_text(app.drawer_body,"-8.0"),"shows remaining days and current mood effect")
	FileAccess.open("res://tests/thoughts/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	data.clock.hour=23;data.clock.minute=30
	app._tick_simulation()
	check(a.thoughts.size()==2 and relation.affinity==10,"no expiry or opinion before midnight")
	app._tick_simulation()
	check(a.thoughts.size()==1 and a.thoughts[0].future.keep,"expiry removes only expired thought and retains unknown fields")
	check(relation.affinity==8,"active opinion applies at midnight")
	check(has_text(app.drawer_body,"剩餘 2 天") and has_text(app.drawer_body,"-5.3"),"page refreshes faded mood while remaining selected")
	check(app.resident_page=="thoughts","thought subpage retained")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px thought content width")
	app.show_tab("設定",true);press(app.drawer_body,"每日想法更新：開啟")
	for day in 3:
		data.clock.hour=23;data.clock.minute=45;app._tick_simulation()
	check(a.thoughts.size()==1 and relation.affinity==8,"disabled mode freezes cleanup and opinion")
	app.show_tab("居民",true);app.show_thoughts(a.id)
	check(has_text(app.drawer_body,"已關閉") and has_text(app.drawer_body,"已到期"),"disabled expired state explained")
	check(app.document.serialize()==original,"original bytes unchanged")
	var saved: Dictionary=app.progress_snapshot()
	app._load_document(JSON.stringify(saved,"",false,true),"resume")
	check(not app.simulation.thoughts_enabled,"disabled mode restored")
	app.show_tab("設定",true);press(app.drawer_body,"每日想法更新：關閉")
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(app.simulation.snapshot(),"",false,true)))
	for i in 96: app._tick_simulation();resumed.tick()
	check(equal(app.simulation.snapshot(),resumed.snapshot()),"daily thought save resumes identically")
	check(app.simulation.data.agents.chen_wei.thoughts.is_empty(),"re-enabled cleanup removes expired thought without late opinion")
	check(app.simulation.data.agents.chen_wei.relationships.lin_mei.affinity==8,"no retroactive drift for missed days")
	app.show_tab("居民",true);app.show_thoughts("chen_wei")
	check(has_text(app.drawer_body,"沒有持續影響"),"empty state")
	var report:={"checks":checks,"failures":failures,"scope":"thought display, midnight expiry/opinion, mood fading, toggle, unknown fields, original bytes, mobile layout and JSON resume"}
	FileAccess.open("res://docs/THOUGHTS_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

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
	check(app.simulation.inner_voice_enabled,"fresh import enables inner voice")
	for field in ["social_enabled","romance_enabled","feuds_enabled","factions_enabled","thoughts_enabled"]: app.simulation.set(field,false)
	var raw: String=app.document.serialize()
	var data: Dictionary=app.simulation.data
	var a: Dictionary=data.agents.chen_wei
	a.currentThought="";data.agents.player.currentThought="玩家心聲"
	app.has_simulated=true
	app.show_tab("居民",true);app.show_thoughts(a.id)
	check(has_text(app.drawer_body,"暫時沒有新的心聲"),"empty voice state")
	for i in 96: app._tick_simulation()
	check(not str(a.currentThought).is_empty(),"tick generates inner voice")
	check(app.resident_page=="thoughts" and has_text(app.drawer_body,a.currentThought),"selected page refreshes live voice")
	check(has_text(app.drawer_body,"不直接改變心情或好感"),"distinguishes voice from persistent mood thoughts")
	check(data.agents.player.currentThought=="玩家心聲","does not generate NPC voice for player")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px thought content width")
	app.show_agent(a.id,false)
	check(has_text(app.drawer_body,"此刻心聲："+a.currentThought),"resident summary shows current voice")
	# Calling generation changes only currentThought and RNG, not memories or mood.
	var before: Dictionary=data.duplicate(true)
	SimInnerVoice.generate(a,app.simulation)
	before.agents[a.id].currentThought=a.currentThought
	check(equal(before,data),"prose does not create mood modifiers or memories")
	check(app.document.serialize()==raw,"original bytes unchanged")
	FileAccess.open("res://tests/inner_voice/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_tab("設定",true);press(app.drawer_body,"居民日常心聲：開啟")
	check(not app.simulation.inner_voice_enabled,"toggle off")
	var saved: Dictionary=app.progress_snapshot()
	app._load_document(JSON.stringify(saved,"",false,true),"resume")
	check(not app.simulation.inner_voice_enabled and app.simulation.data.agents.chen_wei.currentThought==a.currentThought,"mode and current prose restore")
	app.show_tab("設定",true);press(app.drawer_body,"居民日常心聲：關閉")
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(app.simulation.snapshot(),"",false,true)))
	for i in 96: app._tick_simulation();resumed.tick()
	check(equal(app.simulation.snapshot(),resumed.snapshot()),"inner voice random sequence resumes exactly")

	var report:={"checks":checks,"failures":failures,"scope":"NPC tick generation, player exclusion, resident summary, prose versus lasting effects, mobile page, mode and JSON/RNG resume"}
	FileAccess.open("res://docs/INNER_VOICE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

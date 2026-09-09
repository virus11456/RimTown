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
	app.simulation.thoughts_enabled=false # Earlier feature suites keep their original scope.
	check(app.simulation.factions_enabled,"new imports enable factions")
	app.simulation.social_enabled=false;app.simulation.romance_enabled=false;app.simulation.feuds_enabled=false
	var data: Dictionary=app.simulation.data
	data.factions={"factions":{},"_counter":0,"_daysSinceCheck":0}
	app.show_tab("故事",true);press(app.drawer_body,"居民派系")
	for day in 2:
		data.clock.hour=23;data.clock.minute=45;app._tick_simulation()
		check(data.factions.factions.is_empty(),"wait for third day")
	data.clock.hour=23;data.clock.minute=45;app.simulation.rng.state=11456;app._tick_simulation()
	check(not data.factions.factions.is_empty(),"formation on third-day check")
	check(app.factions_page and has_text(app.drawer_body,"成員："),"live faction page retained")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px faction panel")
	FileAccess.open("res://tests/factions/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_tab("設定",true);press(app.drawer_body,"居民派系：開啟")
	var before: Dictionary=data.factions.duplicate(true)
	for i in 288: app._tick_simulation()
	check(data.factions==before,"disabled mode freezes three-day counter and factions")
	app._load_document(JSON.stringify(app.progress_snapshot(),"",false,true),"resume")
	check(not app.simulation.factions_enabled,"mode restored")
	# New event feeds the visual cue without parsing names or touching simulation RNG.
	data=app.simulation.data
	for a in data.agents.values(): a.relationships={}
	SimSocial.relationship(data.agents.chen_wei,data.agents.lin_mei).affinity=-35
	SimSocial.relationship(data.agents.lin_mei,data.agents.chen_wei).affinity=-35
	data.feudCooldown={};data.clock.hour=23;data.clock.minute=45
	app.simulation.feuds_enabled=true;app.simulation.rng.state=11456
	app.drawer.hide();app.active_tab=""
	var ready_save: Dictionary=app.progress_snapshot()
	for item in [["chen_wei",624],["lin_mei",656]]:
		ready_save._godot4a.motion[item[0]].x=item[1];ready_save._godot4a.motion[item[0]].y=480
	FileAccess.open("res://tests/factions/dispute-ready.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(ready_save,"",false,true))
	app._tick_simulation()
	var bubbles: DisputeBubbles=app.world_view.dispute_bubbles
	check(bubbles.bubbles.has("chen_wei") and bubbles.bubbles.has("lin_mei"),"both arguing residents get bubbles")
	var snapshot: Dictionary=app.simulation.snapshot();var random_state: int=app.simulation.rng.state
	app.rig.position=Vector3(40,0,30);app.rig.width=18;app.rig._sync()
	app.world_view.actors.chen_wei.position=Vector3(40,.16,30)
	app.world_view.actors.lin_mei.position=Vector3(40.1,.16,30)
	bubbles._process(0)
	var first: Control=bubbles.bubbles.chen_wei.panel;var second: Control=bubbles.bubbles.lin_mei.panel
	check(first.visible and second.visible,"bubbles visible above on-screen actors")
	check(not first.get_rect().intersects(second.get_rect()),"nearby bubbles do not overlap")
	check(first.mouse_filter==Control.MOUSE_FILTER_IGNORE,"bubble does not block game input")
	var old: Vector2=first.position
	app.world_view.actors.chen_wei.position.x+=2;bubbles._process(0)
	check(first.position!=old,"bubble follows actor")
	app.rig.turn(1);bubbles._process(0)
	for entry in bubbles.bubbles.values():
		check(entry.panel.position.x>=0 and entry.panel.get_rect().end.x<=375,"bubble stays within mobile width")
	check(equal(snapshot,app.simulation.snapshot()) and random_state==app.simulation.rng.state,"visual update does not change simulation or random state")
	bubbles._process(6.1)
	check(bubbles.bubbles.is_empty(),"expires after real-time lifetime even when simulation paused")
	bubbles.show_dispute("chen_wei","lin_mei")
	app._load_document(JSON.stringify(snapshot,"",false,true),"reload")
	check(bubbles.bubbles.is_empty(),"reload clears old bubbles without replay")
	var report:={"checks":checks,"failures":failures,"scope":"three-day factions, toggle/resume, mobile UI; fresh feud bubble cue, tracking, overlap, camera rotation, expiry, input passthrough and no simulation mutation"}
	FileAccess.open("res://docs/FACTIONS_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

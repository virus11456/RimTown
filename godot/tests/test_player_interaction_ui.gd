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
	var raw: String=app.document.serialize()
	var w: SimWorld=app.simulation;var a: Dictionary=w.data.agents.chen_wei
	for id in app.motion.positions:
		app.motion.positions[id].x=1000;app.motion.positions[id].y=1000
	app.motion.positions.player.x=100;app.motion.positions.player.y=100
	app.motion.positions.chen_wei.x=140;app.motion.positions.chen_wei.y=100
	check(SimPlayerInteraction.nearby(app.motion.positions,w.data.agents)=="","exact range excluded")
	app.motion.positions.chen_wei.x=130
	check(SimPlayerInteraction.nearby(app.motion.positions,w.data.agents)=="chen_wei","closest resident")
	var key:=InputEventKey.new();key.physical_keycode=KEY_F;key.pressed=true
	app.traveler._input(key)
	check(app.resident_page=="interaction" and app.selected_agent=="chen_wei","F opens nearby interaction")
	var prior: float=SimSocial.relationship(a,w.data.agents.player).affinity
	press(app.drawer_body,"安慰他")
	check(a.relationships.player.affinity==minf(100,prior+2),"button changes affinity")
	check(has_text(app.drawer_body,"覺得被支持了"),"feedback visible")
	check(a.thoughts.any(func(t): return t.kind=="nice_chat"),"lasting thought created")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px width")
	FileAccess.open("res://tests/player_interaction/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	var before: Dictionary=w.snapshot()
	app.motion.positions.chen_wei.x=500
	app.comfort_resident("chen_wei")
	check(equal(before,w.snapshot()),"stale button cannot act at distance")
	check(has_text(app.drawer_body,"距離太遠"),"distance feedback")
	var edit:=LineEdit.new();app.drawer_body.add_child(edit);edit.grab_focus()
	await process_frame
	app.resident_page="sentinel";app.motion.positions.chen_wei.x=130;app.traveler._input(key)
	check(app.resident_page=="sentinel","F ignored while typing")
	edit.release_focus();app.dialog.popup_centered();await process_frame;app.traveler._input(key)
	check(app.resident_page=="sentinel","F ignored in file dialog")
	app.dialog.hide()
	check(app.document.serialize()==raw,"original unchanged")
	var saved: Dictionary=app.progress_snapshot()
	app._load_document(JSON.stringify(saved,"",false,true),"resume")
	check(equal(app.simulation.data.agents.chen_wei.thoughts,a.thoughts),"comfort thoughts saved")
	check(equal(app.simulation.data.playerActions,saved.playerActions),"player action saved")
	var report:={"checks":checks,"failures":failures,"scope":"nearest range, F event handler, text/modal guards, mobile UI, comfort button, stale distance rejection and save preservation"}
	FileAccess.open("res://docs/PLAYER_INTERACTION_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

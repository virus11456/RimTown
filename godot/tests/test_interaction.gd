extends SceneTree
# Exercise actual Control hit testing and event dispatch, not button signals or view methods.
var app: Node
var checks := 0
var failures: Array[String] = []
var cases: Array[String] = []
func check(ok: bool, name: String) -> void:
	checks += 1
	cases.append(name)
	if not ok: failures.append(name)
func _initialize() -> void:
	call_deferred("run")
func settle() -> void:
	for i in range(4): await process_frame
func find_button(node: Node, title: String) -> Button:
	if node is Button and node.text == title: return node
	for child in node.get_children():
		var found := find_button(child, title)
		if found != null: return found
	return null
func click_control(control: Control) -> void:
	if control == null:
		check(false,"requested control exists")
		return
	var ancestor := control.get_parent()
	while ancestor != null:
		if ancestor is ScrollContainer: ancestor.ensure_control_visible(control)
		ancestor = ancestor.get_parent()
	await settle()
	var viewport := control.get_viewport()
	var point := control.get_global_rect().get_center()
	var motion := InputEventMouseMotion.new()
	motion.position = point
	viewport.push_input(motion, true)
	for pressed in [true, false]:
		var event := InputEventMouseButton.new()
		event.position = point
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		viewport.push_input(event, true)
		await process_frame
	await settle()
func click(title: String) -> void:
	await click_control(find_button(app, title))
func key(code: Key) -> void:
	for pressed in [true,false]:
		var event := InputEventKey.new()
		event.keycode = code
		event.pressed = pressed
		root.push_input(event, true)
		await process_frame
	await settle()
func choose_file(path: String) -> void:
	app.dialog.current_dir = path.get_base_dir()
	await settle()
	var field: LineEdit = app.dialog.get_line_edit()
	field.clear()
	field.grab_focus()
	await settle()
	for character in path.get_file():
		var event := InputEventKey.new()
		event.unicode = character.unicode_at(0)
		event.pressed = true
		field.get_viewport().push_input(event, true)
	await settle()
	for pressed in [true,false]:
		var enter := InputEventKey.new()
		enter.keycode = KEY_ENTER
		enter.pressed = pressed
		field.get_viewport().push_input(enter,true)
		await process_frame
	await settle()

func run() -> void:
	root.size = Vector2i(1280,800)
	root.gui_embed_subwindows = true
	app = load("res://scenes/main.tscn").instantiate()
	root.add_child(app)
	await settle()
	check(app.document.data.agents.size()==21,"initial frontier has 21 residents")
	await click("小鎮")
	check(app.drawer.visible and app.active_tab=="小鎮","mouse opens town drawer")
	await click("查看海風鎮示範")
	check(app.demo_theme=="harbor" and app.document.data.agents.size()==16,"mouse switches harbor with 16 residents")
	await click("查看邊境鎮示範")
	check(app.demo_theme=="frontier" and app.document.data.agents.size()==21,"mouse switches back to frontier")
	await click("居民")
	check(app.active_tab=="居民","mouse opens residents")
	var id: String = app.document.data.agents.keys()[0]
	var name: String = app.document.data.agents[id].name
	await click(name)
	check(find_button(app,"返回居民列表")!=null and app.drawer_body.get_child(0).text==name,"resident click opens correct details")
	var actor_pos: Vector3 = app.world_view.agent_position(id)
	check(app.rig.position.is_equal_approx(Vector3(actor_pos.x,0,actor_pos.z)),"resident click focuses their location")
	await click("返回居民列表")
	check(find_button(app,name)!=null,"back button restores list")
	await click("故事")
	check(app.active_tab=="故事" and app.drawer_body.get_child_count()>1,"story panel has content")
	await click("設定")
	check(app.active_tab=="設定","settings opens")
	var password_masked := false
	for field in app.drawer_body.get_children():
		if field is LineEdit and field.placeholder_text=="密碼": password_masked = field.secret
	check(password_masked or not app.api.token.is_empty(),"password field masked or existing session")
	await click("收起面板 ×")
	check(not app.drawer.visible,"close drawer")
	var angle: float = app.rig.angle
	await click("↷")
	check(is_equal_approx(app.rig.angle,fposmod(angle+90,360)),"camera clockwise button")
	await click("↶")
	check(is_equal_approx(app.rig.angle,angle),"camera counterclockwise button")
	await click("＋")
	check(is_equal_approx(app.rig.width,32),"zoom in button")
	await click("－")
	check(is_equal_approx(app.rig.width,40),"zoom out button")
	var focus := root.gui_get_focus_owner()
	if focus != null: focus.release_focus()
	await key(KEY_E)
	check(is_equal_approx(app.rig.angle,fposmod(angle+90,360)),"keyboard E rotates")
	await key(KEY_Q)
	check(is_equal_approx(app.rig.angle,angle),"keyboard Q rotates back")
	var wheel := InputEventMouseButton.new()
	wheel.position = Vector2(400,350)
	wheel.button_index = MOUSE_BUTTON_WHEEL_UP
	wheel.pressed = true
	root.push_input(wheel,true)
	await settle()
	check(is_equal_approx(app.rig.width,36),"wheel zooms world")
	var before_pan: Vector3 = app.rig.position
	var drag := InputEventMouseMotion.new()
	drag.position = Vector2(400,350)
	drag.relative = Vector2(40,20)
	drag.button_mask = MOUSE_BUTTON_MASK_LEFT
	root.push_input(drag,true)
	await settle()
	check(not app.rig.position.is_equal_approx(before_pan),"drag pans world")
	await click("小鎮")
	await click("匯入網頁版存檔")
	check(app.dialog.visible,"import opens file picker")
	await choose_file(ProjectSettings.globalize_path("res://tests/golden/harbor-day-07.json"))
	check(not app.dialog.visible and int(app.document.data.clock.day)==7 and app.document.data.agents.size()==16,"file picker imports harbor day 7")
	var source := FileAccess.get_file_as_string("res://tests/golden/harbor-day-07.json")
	check(app.document.serialize()==source,"import retains byte-exact JSON")
	await click("匯出原始存檔副本")
	var export_prefix := "副本已儲存於 "
	check(app.status.text.begins_with(export_prefix),"export reports saved file")
	if app.status.text.begins_with(export_prefix):
		var path: String = app.status.text.trim_prefix(export_prefix)
		check(FileAccess.get_file_as_string(path)==source,"exported JSON matches imported bytes")
	# Only test-generated malformed data, no live-account requests.
	var invalid_path := "res://tests/invalid-interaction.json"
	FileAccess.open(invalid_path,FileAccess.WRITE).store_string("{broken")
	await click("匯入網頁版存檔")
	await choose_file(ProjectSettings.globalize_path(invalid_path))
	check(app.document.serialize()==source,"invalid import preserves loaded world")
	check(app.status.text.contains("JSON 格式錯誤"),"invalid import displays useful error")
	DirAccess.remove_absolute(invalid_path)
	# Resize the same scene and exercise real mobile hit testing.
	root.size = Vector2i(375,812)
	await settle()
	await click("收起面板 ×")
	await click("居民")
	check(app.drawer.visible and app.active_tab=="居民","375px residents button hit target")
	await click("收起面板 ×")
	angle=app.rig.angle
	await click("↻")
	check(is_equal_approx(app.rig.angle,fposmod(angle+90,360)),"375px rotate button hit target")
	check(app.navigation.get_global_rect().end.x<=375,"375px navigation inside viewport")
	var report := {"checks":checks,"failures":failures,"cases":cases,"method":"Godot headless root viewport mouse/key event dispatch; OS automation is separately inconclusive","production_login":"not attempted"}
	FileAccess.open("res://docs/INTERACTION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

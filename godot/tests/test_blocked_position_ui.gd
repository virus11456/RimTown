extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var m: SimMotion=app.motion;var w: SimWorld=app.simulation
	var original: Dictionary=m.positions.chen_wei.duplicate(true)
	m.positions.chen_wei.x=-8.0;m.positions.chen_wei.y=-8.0
	m.update(w.data.agents)
	app.show_tab("居民",true);app.show_agent("chen_wei",false);await settle()
	check(has_text(app.drawer_body,"目前位置不可通行"),"resident card explains invalid position")
	press(app.drawer_body,"今日作息與行程");await settle()
	check(has_text(app.drawer_body,"地圖障礙解除後") and has_text(app.drawer_body,"預定："),"agenda separates blockage from intended activity")
	var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"375px agenda retains width with obstruction explanation")
	var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"blocked position native fixture")
	app.show_agenda("chen_wei");await settle()
	check(m.positions.chen_wei.x==-8 and m.positions.chen_wei.y==-8 and has_text(app.drawer_body,"目前位置不可通行"),"native reload preserves actual invalid position and live explanation")
	# Restore the fixture's original geometry-valid position; this is test setup, not a gameplay rescue.
	m.positions.chen_wei=original
	app.show_agenda("chen_wei");await settle()
	check(not has_text(app.drawer_body,"目前位置不可通行"),"reopening panel clears obsolete diagnostic")
	var report:={"checks":checks,"failures":failures,"scope":"real resident card and agenda at 375px, invalid imported position, native reload preserves coordinates, live diagnostic refresh; controlled fixture only"}
	FileAccess.open("res://docs/BLOCKED_POSITION_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

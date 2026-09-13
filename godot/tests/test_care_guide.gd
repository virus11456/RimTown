extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	for size in [Vector2i(375,812),Vector2i(1280,800)]:
		var viewport:=SubViewport.new();viewport.size=size;viewport.own_world_3d=true;root.add_child(viewport)
		var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
		app._load_document(FileAccess.get_file_as_string("res://docs/CARE_FOLLOWUP_HARBOR_PROGRESS.rimtown"),"natural guide test")
		app.active_tab="居民";app.drawer.show();app.show_care_availability("hb_shishu")
		var before: Dictionary=app.progress_snapshot().duplicate(true)
		press(app.drawer_body,"看懂照護與赴診");await settle()
		check(app.resident_page=="care_guide" and has_text(app.drawer_body,"照護與生活節奏指南"),"care page opens guide")
		check(equal(before,app.progress_snapshot()),"reading guide changes no progress quota or motion")
		check(has_text(app.drawer_body,"不保證") and has_text(app.drawer_body,"意圖") and has_text(app.drawer_body,"不會退回"),"guide distinguishes estimates intent and consumed attempt")
		var fits:=true
		for child in app.drawer_body.get_children():
			if child is Control and child.size.x>app.drawer.size.x: fits=false
		check(fits,"guide controls fit "+str(size))
		app._tick_simulation();await settle()
		check(app.resident_page=="care_guide" and has_text(app.drawer_body,"照護與生活節奏指南"),"world tick does not replace guide")
		press(app.drawer_body,"核對作息與完成紀錄");await settle()
		check(has_text(app.drawer_body,"實際到家") and has_text(app.drawer_body,"到場工作"),"guide opens real natural followup evidence")
		app.show_care_guide("hb_shishu");press(app.drawer_body,"前往生活節奏設定");await settle()
		check(app.active_tab=="設定","guide routes to actual settings")
		press(app.drawer_body,"生活節奏：從容");await settle();check(app.clock_pace()=="original","explicit setting click changes pace")
		before=app.progress_snapshot().duplicate(true)
		press(app.drawer_body,"照護與生活節奏指南");await settle()
		check(equal(before,app.progress_snapshot()) and app.clock_pace()=="original","settings guide does not silently change pace")
		press(app.drawer_body,"查看職業與值勤");await settle();check(app.active_tab=="小鎮","career link uses town navigation")
		viewport.queue_free();await process_frame
	var report:={"checks":checks,"failures":failures,"scope":"desktop/mobile real controls, natural progress, read-only guide, live tick retention, actual agenda links and explicit settings change"}
	FileAccess.open("res://docs/CARE_GUIDE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

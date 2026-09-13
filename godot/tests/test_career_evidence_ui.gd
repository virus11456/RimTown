extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
func run() -> void:
	for size in [Vector2i(375,812),Vector2i(1280,800)]:
		var viewport:=SubViewport.new();viewport.size=size;viewport.own_world_3d=true;root.add_child(viewport)
		var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
		var task:=Fixture.prepare(app,"frontier","cook");var w: SimWorld=app.simulation
		app.show_careers();await settle();press(app.drawer_body,"開始："+str(task.label));await settle();press(app.drawer_body,"取消值勤");await settle()
		press(app.drawer_body,"最近值勤結果");await settle()
		check(has_text(app.drawer_body,"已中止、未結算") and has_text(app.drawer_body,"不自動重試"),"cancelled UI shows truthful next step")
		press(app.drawer_body,"返回目前職務與工作");await settle();press(app.drawer_body,"開始："+str(task.label));await settle()
		for tick in 4:w.tick()
		app.show_careers();await settle();press(app.drawer_body,"最近值勤結果");await settle()
		check(has_text(app.drawer_body,"已完成並結算") and has_text(app.drawer_body,"已中止、未結算"),"completed and cancelled attempts coexist")
		check(has_text(app.drawer_body,"本次職涯紀錄") and has_text(app.drawer_body,"起步 → 入門"),"UI shows historical transition")
		press(app.drawer_body,"查看廚師目前職涯");await settle()
		check(has_text(app.drawer_body,"廚師 · 玩法") and w.data.agents.player.jobKey=="cook","link opens current career without enrollment")
		app.show_career_outcomes();await settle()
		var before: Dictionary=app.progress_snapshot().duplicate(true)
		app.show_career_outcomes();await settle();check(equal(before,app.progress_snapshot()),"viewing results is read only")
		var fits:=true
		for child in app.drawer_body.get_children():
			if child is Control and child.size.x>app.drawer.size.x:fits=false
		check(fits,"results fit "+str(size))
		app._load_document(JSON.stringify(before),"outcomes reload");app.show_career_outcomes();await settle()
		check(has_text(app.drawer_body,"已完成並結算") and equal(before,app.progress_snapshot()),"real app reload preserves receipts without replay")
		for row in app.simulation.quest_balance.careers.outcomes:row.erase("career")
		app.show_career_outcomes();await settle()
		check(has_text(app.drawer_body,"沒有職涯變化明細") and not has_text(app.drawer_body,"起步 → 入門"),"legacy completed receipt does not borrow current progress")
		app.simulation.quest_balance.careers.erase("outcomes");app.simulation.quest_balance.careers.history=["舊巡查完成"]
		app.show_career_outcomes();await settle();check(has_text(app.drawer_body,"舊版完成文字紀錄") and not has_text(app.drawer_body,"已完成並結算"),"legacy history remains separate")
		viewport.queue_free();await process_frame
	var report:={"checks":checks,"failures":failures,"scope":"actual buttons start/cancel/restart/complete cook duty, desktop/mobile results, read-only display and app reload, legacy text"}
	FileAccess.open("res://docs/CAREER_EVIDENCE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

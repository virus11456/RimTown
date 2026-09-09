extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false);var w: SimWorld=app.simulation
	app.show_tab("小鎮",true);press(app.drawer_body,"研究")
	check(w.research_enabled and has_text(app.drawer_body,"前置"),"research entry and prerequisites")
	press(app.drawer_body,"研究：商業");check(w.data.research.current=="commerce","UI selection")
	var before:=w.snapshot();check(not SimResearch.start(w,"architecture") and equal(before,w.snapshot()),"locked research blocked")
	w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
	var progress: float=w.data.research.projects.commerce.progress;check(progress>0,"midnight research advances")
	app.show_research();press(app.drawer_body,"研究：進階農業")
	check(w.data.research.current=="agriculture" and w.data.research.projects.commerce.progress==progress,"switch retains progress")
	app.show_tab("設定",true);press(app.drawer_body,"每日研究：開啟")
	w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
	check(w.data.research.projects.agriculture.progress==0,"disabled research frozen")
	w.research_enabled=true
	var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 960: w.tick();restored.tick()
	check(equal(w.snapshot(),restored.snapshot()),"ten-day buildings trade research combined resume")
	FileAccess.open("res://tests/research/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_research();await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px research layout")
	var report:={"checks":checks,"failures":failures,"scope":"research selection, prerequisites, midnight, switching, disable, ten-day all-system resume and 375px layout"}
	FileAccess.open("res://docs/RESEARCH_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false);var w: SimWorld=app.simulation
	w.data.industry.industries={};w.data.industry.maxIndustries=1
	app.show_tab("小鎮",true);press(app.drawer_body,"產業")
	check(w.industry_enabled and has_text(app.drawer_body,"下一城鎮等級"),"industry entry and capacity")
	var def: Dictionary=SimIndustry.rules().industries.lumber
	press(app.drawer_body,"開啟："+str(def.name))
	check(w.data.industry.industries.has("lumber"),"UI chooses industry")
	var before:=w.snapshot()
	check(not SimIndustry.choose(w,"lumber") and not SimIndustry.choose(w,"mining") and not SimIndustry.choose(w,"unknown") and equal(before,w.snapshot()),"duplicate full and invalid choice atomic")
	for k in w.data.stockpile.resources: w.data.stockpile.resources[k]=0
	before=w.snapshot();check(not SimIndustry.upgrade(w,"lumber") and equal(before,w.snapshot()),"unaffordable upgrade atomic")
	for k in w.data.stockpile.resources: w.data.stockpile.resources[k]=10000
	app.show_industry();press(app.drawer_body,"升級："+str(SimIndustry.next_level(w,"lumber").name))
	check(w.data.industry.industries.lumber.level==2,"UI upgrades")
	w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
	check(not w.data.industry.industries.lumber.dailyOutput.is_empty(),"midnight produces")
	var ledger_size: int=w.data.stockpile.history.size();app._tick_simulation()
	check(w.data.stockpile.history.size()==ledger_size,"no duplicate daily production")
	app.show_tab("設定",true);press(app.drawer_body,"每日產業產出：開啟")
	w.data.industry.industries.lumber.dailyOutput={};w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
	check(w.data.industry.industries.lumber.dailyOutput.is_empty(),"disabled production frozen")
	w.industry_enabled=true
	var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 960: w.tick();restored.tick()
	check(equal(w.snapshot(),restored.snapshot()),"ten-day combined resume")
	FileAccess.open("res://tests/industry/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_industry();await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px industry layout")
	var report:={"checks":checks,"failures":failures,"scope":"industry UI choice/upgrade, atomic guards, midnight exactly once, disable, ten-day all-system resume, mobile layout"}
	FileAccess.open("res://docs/INDUSTRY_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

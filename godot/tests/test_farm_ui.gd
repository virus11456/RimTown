extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame
	app.set_process(false);var w: SimWorld=app.simulation
	w.data.industry.industries={};SimIndustry.choose(w,"farming")
	app.show_tab("小鎮",true);press(app.drawer_body,"農田")
	check(w.farm_enabled and has_text(app.drawer_body,"下一次午夜"),"farm entry and unlock guidance")
	w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation();check(w.data.farm.plots.size()==4,"midnight allocates four plots")
	app.show_farm();press(app.drawer_body,"翻土 #1");check(SimFarm.plot(w,1).state=="tilled","UI till")
	var before:=w.snapshot();check(not SimFarm.plant(w,1,"rice") and not SimFarm.plant(w,1,"unknown") and not SimFarm.harvest(w,1) and equal(before,w.snapshot()),"locked invalid unready guards atomic")
	var silver: float=w.data.stockpile.resources.silver;w.data.stockpile.resources.silver=0
	before=w.snapshot();check(not SimFarm.plant(w,1,"wheat") and equal(before,w.snapshot()),"seed cost atomic")
	w.data.stockpile.resources.silver=silver
	press(app.drawer_body,"播種 #1");check(SimFarm.plot(w,1).crop=="wheat","UI seasonal crop selection")
	w.data.stockpile.resources.herbs=10;app.show_farm();press(app.drawer_body,"施肥 #1 · 2 草藥")
	check(SimFarm.plot(w,1).fertilized and w.data.stockpile.resources.herbs==8,"UI fertilize cost")
	before=w.snapshot();check(not SimFarm.fertilize(w,1) and equal(before,w.snapshot()),"fertilizer once")
	SimFarm.plot(w,1).waterLevel=20;app.show_farm();press(app.drawer_body,"澆水 #1");check(SimFarm.plot(w,1).waterLevel==50,"UI water")
	app.show_tab("設定",true);press(app.drawer_body,"每日農田生長：開啟")
	before=w.data.farm.duplicate(true);w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
	check(equal(before,w.data.farm),"disabled farm frozen")
	w.farm_enabled=true;w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
	check(SimFarm.plot(w,1).growthProgress>0,"enabled growth")
	before=w.data.farm.duplicate(true);app._tick_simulation();check(equal(before,w.data.farm),"growth once per midnight")
	for i in 10:
		SimFarm.water(w,1);SimFarm.daily(w)
		if SimFarm.plot(w,1).state=="ready": break
	check(SimFarm.plot(w,1).state=="ready","matures")
	app.show_farm();press(app.drawer_body,"收成 #1")
	check(SimFarm.plot(w,1).state=="empty" and w.data.farm.harvestLog.size()==1 and SimEconomy.amount(w,"wheat")>0,"UI harvest and crop inventory")
	before=w.snapshot();check(not SimFarm.harvest(w,1) and equal(before,w.snapshot()),"no double harvest")
	SimFarm.till(w,1);SimFarm.plant(w,1,"wheat")
	var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 960: w.tick();restored.tick()
	check(equal(w.snapshot(),restored.snapshot()),"ten-day all-system farm resume")
	FileAccess.open("res://tests/farm/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_farm();await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px farm layout")
	var report:={"checks":checks,"failures":failures,"scope":"farm UI full crop lifecycle, atomic invalid/cost guards, daily once and disable, ten-day all-system resume and mobile layout"}
	FileAccess.open("res://docs/FARM_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false);var w: SimWorld=app.simulation
	app.show_tab("小鎮",true);press(app.drawer_body,"建築工程")
	check(w.buildings_enabled and has_text(app.drawer_body,"3D 選址"),"default and scope disclosed")
	var wood:=SimEconomy.amount(w,"wood");press(app.drawer_body,"開工：穀倉");await settle()
	check(w.data.buildings.projects.size()==1 and SimEconomy.amount(w,"wood")==wood-30,"UI starts paid project")
	var before:=w.snapshot();check(SimBuildings.start(w,"granary").is_empty() and equal(before,w.snapshot()),"duplicate atomic")
	w.data.clock.hour=23;w.data.clock.minute=30;app._tick_simulation()
	check(w.data.buildings.projects[0].workDone==0,"no work before midnight")
	app._tick_simulation();check(w.data.buildings.projects[0].workDone>0,"work at midnight")
	var work: float=w.data.buildings.projects[0].workDone;app._tick_simulation();check(w.data.buildings.projects[0].workDone==work,"no duplicate work")
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 960: w.tick();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"ten-day all-mode resume")
	check(w.data.buildings.completed.size()==1 and w.data.buildings.activeEffects.food_capacity==500,"granary completed and capacity active")
	FileAccess.open("res://tests/buildings/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	before=w.snapshot();check(SimBuildings.start(w,"granary").is_empty() and equal(before,w.snapshot()),"completed base duplicate blocked")
	for resource in w.data.stockpile.resources: w.data.stockpile.resources[resource]=10000
	app.show_buildings();press(app.drawer_body,"升級：大型穀倉")
	check(w.data.buildings.projects.size()==1 and w.data.buildings.projects[0].upgradeKey=="granary","UI upgrade")
	before=w.snapshot();check(SimBuildings.start(w,"granary",true).is_empty() and equal(before,w.snapshot()),"duplicate upgrade atomic")
	app.show_tab("設定",true);press(app.drawer_body,"每日建築施工：開啟")
	w.data.clock.hour=23;w.data.clock.minute=45;work=w.data.buildings.projects[0].workDone;app._tick_simulation()
	check(w.data.buildings.projects[0].workDone==work,"disabled construction frozen")
	for resource in w.data.stockpile.resources: w.data.stockpile.resources[resource]=0
	before=w.snapshot();check(SimBuildings.start(w,"school").is_empty() and equal(before,w.snapshot()),"insufficient resources no partial charge")
	app.show_buildings();await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px construction layout")
	var report:={"checks":checks,"failures":failures,"scope":"paid start/upgrade UI, insufficient/duplicate guards, midnight once, enabled flag, capacity effect, ten-day all-mode save resume, 375px layout"}
	FileAccess.open("res://docs/BUILDINGS_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

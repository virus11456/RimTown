extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var choices:=BuildingSites.candidates(w.data)
	check(not choices.is_empty(),"frontier has safe sites")
	for site in choices: check(BuildingSites.allowed(w.data,site),"candidate passes final validation")
	var harbor: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/harbor-day-01.json"))
	var harbor_sites:=BuildingSites.candidates(harbor)
	check(not harbor_sites.is_empty(),"harbor has safe sites")
	for candidate in harbor_sites: check(BuildingSites.allowed(harbor,candidate),"harbor candidate safe")
	var before:=w.snapshot();check(SimBuildings.start(w,"granary",false,Vector2i(26,20)).is_empty() and equal(before,w.snapshot()),"road rejects before charging")
	check(SimBuildings.start(w,"granary",false,Vector2i(80,60)).is_empty() and equal(before,w.snapshot()),"outside map rejects")
	app.show_buildings();press(app.drawer_body,"開工：穀倉")
	check(is_instance_valid(app.placement_preview) and equal(before,w.snapshot()),"preview costs nothing")
	var first: Vector3=app.placement_preview.position;press(app.drawer_body,"下一塊空地")
	check(app.placement_preview.position!=first,"next candidate moves preview")
	press(app.drawer_body,"取消選址");check(not is_instance_valid(app.placement_preview) and equal(before,w.snapshot()),"cancel clears preview without costs")
	press(app.drawer_body,"開工：穀倉");press(app.drawer_body,"確認開工")
	var p: Dictionary=w.data.buildings.projects[0];var site:=Vector2i(p.siteX,p.siteY)
	check(SimEconomy.amount(w,"wood")==float(before.stockpile.resources.wood)-30,"confirmed project paid once")
	check(not BuildingSites.allowed(w.data,site),"occupied site rejects")
	check(not app.motion.pathfinder.walkable(site.x,site.y),"construction blocks navigation")
	check(app.world_view.content.get_children().any(func(n): return n.get_meta("construction_key","")=="granary" and n.get_meta("phase","")=="building"),"construction mesh appears immediately")
	FileAccess.open("res://tests/buildings/site-building.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	for i in 10:
		w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
		if not w.data.buildings.completed.is_empty(): break
	check(not w.data.buildings.completed.is_empty(),"completed with normal work")
	check(app.world_view.content.get_children().any(func(n): return n.get_meta("construction_key","")=="granary" and n.get_meta("phase","")=="complete"),"completion mesh updates at midnight")
	for r in w.data.stockpile.resources: w.data.stockpile.resources[r]=10000
	app.show_buildings();press(app.drawer_body,"升級：大型穀倉")
	for i in 20:
		w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
		if w.data.buildings.projects.is_empty(): break
	var complete: Dictionary=w.data.buildings.completed[0]
	check(complete.siteX==site.x and complete.siteY==site.y and complete.level==2,"upgrade retains site")
	check(app.world_view.content.get_children().any(func(n): return n.get_meta("construction_key","")=="granary" and n.get_meta("level",0)==2),"upgrade visual level")
	FileAccess.open("res://tests/buildings/site-complete.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 960: w.tick();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"site survives ten-day resume")
	app.show_building_site("school");await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"mobile placement layout")
	app.show_tab("設定",true);check(not is_instance_valid(app.placement_preview),"navigation clears placement")
	var report:={"checks":checks,"failures":failures,"scope":"safe sites, road/boundary/occupancy atomic guards, preview/cancel/confirm, collision and geometry refresh, upgrade location, save/resume and mobile layout"}
	FileAccess.open("res://docs/BUILDING_SITE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

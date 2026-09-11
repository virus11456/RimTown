extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var m: SimMotion=app.motion;var w: SimWorld=app.simulation
	# Controlled geometry for the actual resident UI; not a rendered-world visual fixture.
	for y in range(60):
		for x in range(80): m.layout.grid[y][x]=5 if x==20 else 0
	m.layout.nature.route_test={"x":24,"y":20,"w":1,"h":1};m.layout.work_sites.route_test=true
	w.data.townMap.locations.route_test={"name":"測試目的地"}
	var a: Dictionary=w.data.agents.chen_wei;a.currentLocation="route_test";a.activity="wandering"
	m.positions.chen_wei.x=319.9;m.positions.chen_wei.y=328.0
	m.pathfinder.grid=m.layout.grid;m.update({"chen_wei":a})
	app.show_tab("居民",true);app.show_agent("chen_wei",false);await settle()
	check(has_text(app.drawer_body,"前方受阻"),"resident card shows blocked route reason")
	press(app.drawer_body,"今日作息與行程");await settle()
	check(has_text(app.drawer_body,"目前找不到可通行路線") and has_text(app.drawer_body,"預定："),"agenda separates failed route from intended activity")
	var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"375px blocked-route agenda fits")
	m.layout.grid[20][20]=0;app.show_agenda("chen_wei");await settle()
	check(not has_text(app.drawer_body,"前方受阻"),"reopened route removes outdated explanation before retry")
	var report:={"checks":checks,"failures":failures,"scope":"375px resident card and agenda with controlled navigation barrier; current geometry clears stale reason; no screenshot or full-scene visual claim"}
	FileAccess.open("res://docs/BLOCKED_ROUTE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

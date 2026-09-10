extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	app.show_tab("小鎮",true);press(app.drawer_body,"職業與值勤");await settle()
	press(app.drawer_body,"登記：守衛");await settle()
	var w: SimWorld=app.simulation
	check(w.data.agents.player.jobKey=="guard","UI registers actual career")
	press(app.drawer_body,"開始：巡查石匠坑");await settle()
	check(SimCareers.book(w).active.is_empty(),"UI checks physical position")
	for loc in SimCareers.PATROL:
		var position: Dictionary=w.data.townMap.locations[loc]
		var zone: Dictionary=app.motion.layout.buildings.get(loc,app.motion.layout.nature.get(loc,{}))
		app.motion.positions.player.x=(zone.x+zone.w*.5)*16;app.motion.positions.player.y=(zone.y+zone.h*.5)*16;w.data.agents.player.currentLocation=loc
		app.show_careers();await settle();press(app.drawer_body,"開始：巡查"+str(position.name));await settle()
		check(not SimCareers.book(w).active.is_empty(),"onsite button starts timed work")
		for i in 4: w.tick()
	app.show_careers();await settle()
	check(SimCareers.book(w).used==3 and SimCareers.defense_bonus(w)==2,"UI route affects guard strength")
	check(has_text(app.drawer_body,"今日完成 3 / 3"),"completion shown")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px width fits")
	var report:={"checks":checks,"failures":failures,"scope":"375px UI registration, physical-position gate, three real tick-based patrols and completion"}
	FileAccess.open("res://docs/CAREER_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

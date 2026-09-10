extends "res://tests/test_player_chat_ui.gd"
func stand(app: Node,loc: String) -> void:
	var zone: Dictionary=app.motion.layout.buildings.get(loc,app.motion.layout.nature.get(loc,{}))
	app.motion.positions.player.x=(zone.x+zone.w*.5)*16;app.motion.positions.player.y=(zone.y+zone.h*.5)*16;app.simulation.data.agents.player.currentLocation=loc
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	app.show_careers();press(app.drawer_body,"登記：木匠");await settle();check(w.data.agents.player.jobKey=="carpenter","carpenter registration button")
	SimBuildings.start(w,"watchtower");SimGovernance.daily(w);SimGovernance.execute(w,1)
	check(not w.data.buildings.projects.is_empty(),"UI fixture uses actual mayor approval")
	var p: Dictionary=w.data.buildings.projects[0];stand(app,"workshop");app.show_careers();await settle()
	press(app.drawer_body,"開始：製備工程構件："+str(p.name));await settle()
	for i in 4: w.tick()
	check(p.workDone==2,"onsite carpenter work commits after four ticks")
	app.show_careers();press(app.drawer_body,"登記：研究員");await settle()
	w.data.research.current="trial";w.data.research.projects.trial={"key":"trial","name":"測試研究","status":"researching","cost":100,"progress":0,"effects":{},"prerequisites":[]};w.data.stockpile.resources.research_points=0
	stand(app,"library");app.show_careers();await settle();press(app.drawer_body,"開始：整理研究資料：測試研究");await settle()
	for i in 4: w.tick()
	check(SimEconomy.amount(w,"research_points")==3,"research UI supplies three notes")
	app.show_careers();press(app.drawer_body,"登記：牧師");await settle()
	w.data.clock.hour=12;w.data.clock.minute=0
	var a: Dictionary=w.data.agents[SimGovernance.mayor(w)];a.needs.hunger=90;a._pendingHangout=null;a.currentLocation="town_hall";a.mood=-50;w.runtime[a.id].moodModifier=-90;w._activity(a,int(w.data.clock.hour));a._locationStayRemaining=20;w.runtime[a.id].targetLocation=null
	stand(app,"town_hall");app.motion.positions[a.id].x=app.motion.positions.player.x;app.motion.positions[a.id].y=app.motion.positions.player.y;app.show_careers();await settle();press(app.drawer_body,"開始：陪伴低落的"+str(a.name));await settle()
	for i in 4:
		w.tick()
	check(SimCareers.book(w).get("counseled",[]).has(a.id),"support UI affects actual resident")
	app.show_careers();await settle();check(has_text(app.drawer_body,"今日完成 3 / 3"),"shared cap visible")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px expanded menu fits")
	var report:={"checks":checks,"failures":failures,"scope":"375px six-career UI, three new registrations and real tick-based completions"}
	FileAccess.open("res://docs/CAREER_EXPANSION_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

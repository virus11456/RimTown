extends "res://tests/test_careers_expansion_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	app.show_careers();press(app.drawer_body,"登記：守衛");await settle();var w: SimWorld=app.simulation
	check(has_text(app.drawer_body,"下一階段：入門"),"first task visible")
	for day in 5:
		w.data.clock.day=day+1;w.data.clock.hour=12;w.data.clock.minute=0
		for loc in SimCareers.PATROL:
			stand(app,loc);app.show_careers();await settle()
			press(app.drawer_body,"開始：巡查"+str(w.data.townMap.locations[loc].name));await settle()
			var duration:=SimCareerProgress.ticks(w,"guard")
			for i in duration: w.tick()
		app.show_careers();await settle()
		check(has_text(app.drawer_body,"職涯："+str(SimCareerProgress.STAGES[[1,1,2,2,3][day]])),"earned stage displayed")
	check(has_text(app.drawer_body,"每次 30 分鐘"),"mastery changes displayed duration")
	check(has_text(app.drawer_body,"三階段任務完成"),"track completion visible")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px career progress fits")
	press(app.drawer_body,"登記：醫護員");await settle();check(has_text(app.drawer_body,"下一階段：入門"),"other track not awarded for guard work")
	var report:={"checks":checks,"failures":failures,"scope":"375px UI starts fifteen actual patrol duties over a five-day fixture, stage checklist/completion and shortened duration display, separate profession track"}
	FileAccess.open("res://docs/CAREER_PROGRESS_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

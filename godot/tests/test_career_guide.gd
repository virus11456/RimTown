extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	for size in [Vector2i(375,812),Vector2i(1280,800)]:
		var viewport:=SubViewport.new();viewport.size=size;viewport.own_world_3d=true;root.add_child(viewport)
		var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
		var w: SimWorld=app.simulation
		for job in SimCareers.JOBS:
			var before: Dictionary=app.progress_snapshot().duplicate(true)
			app.show_career_guide(job);await settle()
			check(has_text(app.drawer_body,str(SimCareers.JOBS[job].name)+" · 玩法"),"all jobs have concrete preview "+job)
			check(has_text(app.drawer_body,SimCareerProgress.detail(job,1)) and has_text(app.drawer_body,"60 遊戲分鐘"),"preview matches actual starting progression")
			check(equal(before,app.progress_snapshot()),"preview does not enroll initialize ledger or grant progress")
			var fits:=true
			for child in app.drawer_body.get_children():
				if child is Control and child.size.x>app.drawer.size.x: fits=false
			check(fits,"preview fits "+str(size)+job)
		w.data.agents.player.jobKey="guard"
		app.show_careers();await settle()
		var first_start:=-1;var first_enroll:=-1
		for index in app.drawer_body.get_child_count():
			var child: Node=app.drawer_body.get_child(index)
			if child is Button and child.text.begins_with("開始：") and first_start<0:first_start=index
			if child is Button and child.text.begins_with("登記：") and first_enroll<0:first_enroll=index
		check(first_start>=0 and first_enroll>first_start,"actual duty buttons precede other job registrations")
		press(app.drawer_body,"職業玩法與任務指南");await settle()
		check(has_text(app.drawer_body,"守衛 · 玩法"),"duties link previews current job")
		app._tick_simulation();await settle();check(has_text(app.drawer_body,"職業玩法與任務指南"),"world update preserves guide")
		press(app.drawer_body,"前往目前職務與可做工作");await settle();check(app.career_page,"guide returns to real task screen")
		w.data.agents.player.jobKey="mayor";app.show_career_guide("doctor");await settle()
		check(has_text(app.drawer_body,"直接決定鎮務") and w.data.agents.player.jobKey=="mayor","mayor preview preserves authority and elected role")
		viewport.queue_free();await process_frame
	var report:={"checks":checks,"failures":failures,"scope":"11 job previews at mobile/desktop sizes, no mutation, real task ordering, current-job links, live ticks and mayor preview"}
	FileAccess.open("res://docs/CAREER_GUIDE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

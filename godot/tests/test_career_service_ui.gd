extends "res://tests/test_careers_expansion_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		app.load_demo(town);var w: SimWorld=app.simulation;var initial:=w.snapshot();var id:=SimGovernance.mayor(w)
		for job in ["doctor","priest"]:
			app._load_document(JSON.stringify(initial),"service UI fixture");SimCareers.enroll(w,job)
			var a: Dictionary=w.data.agents[id];a.needs.rest=25;a.mood=-50;a.currentLocation="town_square"
			stand(app,"town_square");var p: Dictionary=app.motion.positions.player
			app.motion.positions[id].x=p.x;app.motion.positions[id].y=p.y;app.motion.positions[id].doorPhase=null
			var task: Dictionary=SimCareers.available(w).filter(func(t): return t.target==id)[0]
			app.show_careers();await settle();check(has_text(app.drawer_body,"實際位置：") and has_text(app.drawer_body,"不代表已到場"),"task distinguishes actual position from destination "+town+job)
			var before:=w.snapshot();press(app.drawer_body,"查看"+str(a.name)+"的目前行程");await settle()
			check(app.resident_page=="agenda" and app.active_tab=="居民" and equal(before,w.snapshot()),"view actual service target agenda without mutation "+town+job)
			check(app.rig.position.distance_to(Vector3(float(app.motion.positions[id].x)/16,0,float(app.motion.positions[id].y)/16))<.001,"camera finds current physical target without moving actors "+town+job)
			press(app.drawer_body,"返回職業與值勤");await settle();check(app.career_page,"return to profession page "+town+job)
			# Click the retained task card after the resident's need has recovered.
			if job=="doctor": a.needs.rest=60
			else: a.mood=5
			before=w.snapshot();press(app.drawer_body,"開始："+str(task.label));await settle()
			check(equal(before,w.snapshot()) and has_text(app.drawer_body,"這次不需要服務"),"stale start explains recovered need and has no effects "+town+job)
			a.needs.rest=25;a.mood=-50;app.show_careers();press(app.drawer_body,"開始："+str(task.label))
			check(not SimCareers.book(w).active.is_empty(),"demand returns and current task can start "+town+job)
			if job=="doctor": a.needs.rest=60
			else: a.mood=5
			w.data.tickCount+=4;var xp: Dictionary=w.data.agents.player.skills.duplicate(true);SimCareers.tick(w)
			check(SimCareers.book(w).active.is_empty() and SimCareers.book(w).used==0 and equal(xp,w.data.agents.player.skills) and "這次不需要服務" in SimCareers.book(w).notice,"recovery at settlement cancels with specific reason "+town+job)
			a.needs.rest=25;a.mood=-50;app.show_careers();press(app.drawer_body,"開始："+str(task.label))
			a.currentLocation="tavern"
			check(SimCareers.available(w).any(func(t): return t.target==id and t.location=="town_square"),"available service follows actual venue rather than new destination "+town+job)
			w.data.tickCount+=4;SimCareers.tick(w)
			check(SimCareers.book(w).active.is_empty() and SimCareers.book(w).used==1,"changed destination alone does not cancel a physically present service "+town+job)
			app.show_careers();await settle();var fits:=true
			for c in app.drawer_body.get_children():
				if c is Control and c.size.x>app.drawer.size.x: fits=false
			check(fits,"375px service page fits "+town+job)
	var report:={"checks":checks,"failures":failures,"scope":"two towns doctor/priest live task-to-agenda navigation, separate actual/destination labels, stale recovered-need cards, demand returning, settlement cancellation without XP/quota and phone width; controlled needs and colocated positions"}
	FileAccess.open("res://docs/CAREER_SERVICE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

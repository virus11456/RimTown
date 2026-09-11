extends "res://tests/test_careers_expansion_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		app.load_demo(town);var w: SimWorld=app.simulation;var id:=SimGovernance.mayor(w)
		var a: Dictionary=w.data.agents[id];a.mood=-50;a.needs.rest=25;a.activity="wandering";a.currentLocation="town_square"
		stand(app,"town_square");var p: Dictionary=app.motion.positions.player
		app.motion.positions[id].x=p.x;app.motion.positions[id].y=p.y;app.motion.positions[id].doorPhase=null
		SimCareers.enroll(w,"priest")
		var task: Dictionary=SimCareers.available(w).filter(func(t): return t.target==id)[0]
		app.show_careers();await settle();a.activity="sleeping"
		var before:=w.snapshot();press(app.drawer_body,"開始："+str(task.label));await settle()
		check(equal(before,w.snapshot()) and has_text(app.drawer_body,"請等醒來"),"retained card rejects sleeping conversation without waking or rewards "+town)
		check(not SimCareers.available(w).any(func(t): return t.target==id) and not SimCareers.start(w,task.id).ok,"sleeping resident excluded and core cannot bypass "+town)
		a.activity="wandering"
		check(SimCareers.start(w,task.id).ok,"awake resident still low can receive support "+town)
		var xp: Dictionary=w.data.agents.player.skills.duplicate(true);a.activity="sleeping";app._validate_career_presence()
		check(SimCareers.book(w).active.is_empty() and SimCareers.book(w).used==0 and equal(xp,w.data.agents.player.skills) and a.activity=="sleeping","sleep during support cancels without waking or XP "+town)
		a.activity="wandering";SimCareers.start(w,task.id);a.activity="sleeping"
		app._load_document(JSON.stringify(app.progress_snapshot()),"sleeping support restored")
		app._validate_career_presence();SimCareers.tick(w)
		check(SimCareers.book(w).active.is_empty() and SimCareers.book(w).used==0 and equal(xp,w.data.agents.player.skills),"reload does not permit sleeping support "+town)
		a=w.data.agents[id];SimCareers.enroll(w,"doctor");a.needs.rest=25;a.activity="sleeping"
		task=SimCareers.available(w).filter(func(t): return t.target==id)[0]
		check("睡眠恢復體力" in SimCareerPresence.service_status(w,app.motion,task),"sleep recovery explained before starting medical service "+town)
		check(SimCareers.start(w,task.id).ok,"fatigued sleeping resident can receive quiet medical care "+town)
		xp=w.data.agents.player.skills.duplicate(true)
		for tick in 2:
			SimNeeds.decay(a.needs,"sleeping",23);w.data.tickCount+=1;SimCareers.tick(w)
		check(a.needs.rest==41 and SimCareers.book(w).active.is_empty() and SimCareers.book(w).used==0 and equal(xp,w.data.agents.player.skills),"normal sleep recovery removes care demand without completion reward "+town)
		app.show_service_target(id);await settle();check(has_text(app.drawer_body,"談心請等醒來"),"agenda explains sleeping resident interaction "+town)
	var report:={"checks":checks,"failures":failures,"scope":"two towns controlled sleepy and awake target, retained UI card, core eligibility, ongoing and restored support cancellation, unchanged sleep and skills, real SimNeeds sleep recovery cancelling doctor demand; no natural sleep scheduling claim"}
	FileAccess.open("res://docs/SLEEP_SERVICE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

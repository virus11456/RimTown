extends "res://tests/test_careers_expansion_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		app.load_demo(town);var w: SimWorld=app.simulation;var initial:=w.snapshot();var id:=SimGovernance.mayor(w)
		for job in ["doctor","priest"]:
			for fault in ["far_start","far_finish","door","reload","near"]:
				app._load_document(JSON.stringify(initial),"care proximity fixture");SimCareers.enroll(w,job)
				var a: Dictionary=w.data.agents[id];a.needs.rest=25;a.mood=-50;a.currentLocation="town_square"
				stand(app,"town_square");var p: Dictionary=app.motion.positions.player
				app.motion.positions[id].x=p.x+16;app.motion.positions[id].y=p.y;app.motion.positions[id].doorPhase=null;p.doorPhase=null
				var task: Dictionary=SimCareers.available(w).filter(func(t): return str(t.target)==id)[0]
				if fault=="far_start": app.motion.positions[id].x=p.x+64
				if fault=="door": app.motion.positions[id].doorPhase="entering"
				var before:=w.snapshot();var result:=SimCareers.start(w,task.id)
				if fault in ["far_start","door"]:
					check(not result.ok and SimCareers.book(w).active.is_empty(),"core rejects remote or doorway care "+town+job+fault)
					check(equal(before,w.snapshot()),"rejected start has no reward or state effects "+town+job+fault)
					continue
				check(result.ok,"close pair starts "+town+job+fault)
				if fault in ["far_finish","reload"]: app.motion.positions[id].x=p.x+64
				if fault=="reload": app._load_document(JSON.stringify(app.progress_snapshot()),"distant care restored")
				var b:=SimCareers.book(w);w.data.tickCount=int(b.active.finish) if not b.active.is_empty() else int(w.data.tickCount)+4
				before=w.snapshot();var skill: String=SimCareers.JOBS[job].skill;var xp: float=w.data.agents.player.skills.get(skill,{}).get("xp",0)
				SimCareers.tick(w)
				if fault=="near":
					check(b.used==1 and float(w.data.agents.player.skills[skill].xp)==xp+3,"actual nearby service rewards once "+town+job)
				else: check(b.used==0 and float(w.data.agents.player.skills.get(skill,{}).get("xp",0))==xp and b.active.is_empty(),"departed target cannot be serviced at settlement "+town+job+fault)
				var after:=w.snapshot();SimCareers.tick(w);check(equal(after,w.snapshot()),"terminal settlement cannot replay "+town+job+fault)
				app.show_careers();await settle();check(has_text(app.drawer_body,"三格以內"),"service radius explained in UI "+town+job)
	var report:={"checks":checks,"failures":failures,"scope":"two towns, doctor/priest core starts and settlements, actual same-venue distance and doorway checks, distant-target native reload, exact-once XP and daily quota, UI explanation; controlled needs, positions and settlement clock"}
	FileAccess.open("res://docs/CAREER_PROXIMITY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

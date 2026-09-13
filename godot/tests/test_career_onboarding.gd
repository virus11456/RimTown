extends "res://tests/test_indoor_service.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for job in SimWorkstation.JOBS:
			var task:=Fixture.prepare(app,town,job)
			if task.is_empty():continue
			var w: SimWorld=app.simulation;var m: SimMotion=app.motion
			var z: Dictionary=m.layout.buildings[task.location]
			put(m,"player",Vector2(z.doorPixelX,z.doorPixelY));m.move_player(Vector2.ZERO,0)
			app.show_careers();await settle()
			check(not "已到位" in app._career_next_step(task,0),"door is not operation station "+town+job)
			var stock: Dictionary=w.data.stockpile.duplicate(true);var initial:=point(m)
			press(app.drawer_body,"走到"+SimWorkstation.label(job))
			check(point(m)==initial,"requested approach never teleports")
			var safe:=true
			for frame in 3000:
				var before:=point(m);app._process_traveler(1.0/60)
				if before.distance_to(point(m))>1.201 or not m.layout._walkable(point(m)):safe=false
				if app.station_approach.job.is_empty():break
			check(safe and SimWorkstation.error(m,job).is_empty(),"actual collision walk reaches correct station")
			app.show_careers();await settle()
			check(has_text(app.drawer_body,"下一步：目前已到位"),"arrival provides explicit next action")
			check(SimCareers.book(w).active.is_empty() and equal(stock,w.data.stockpile),"arrival grants nothing and does not start")
			press(app.drawer_body,"開始："+str(task.label));await settle()
			check(not SimCareers.book(w).active.is_empty(),"explicit button starts actual duty")
			var save: Dictionary=app.progress_snapshot();var feet:=point(m)
			app._load_document(JSON.stringify(save),"onboarding active reload");w=app.simulation;m=app.motion
			check(point(m)==feet and not SimCareers.book(w).active.is_empty(),"active reload preserves physical position and duty")
			for tick in 4:w.tick()
			check(SimCareers.book(w).active.is_empty() and SimCareers.book(w).used==1 and SimCareerProgress.progress(w,job).completed==1,"real timed completion counts once")
			app.show_careers();await settle();check(has_text(app.drawer_body,"完成"),"completed outcome visible")
			check("明天再來" in app._career_next_step(task,3),"shared daily quota takes precedence")
	var task:=Fixture.prepare(app,"frontier","cook");var w: SimWorld=app.simulation
	w.quest_balance.governance.proposals=[]
	check("先申請" in app._career_next_step(task,0),"unapproved materials have clear next action")
	var stock: Dictionary=w.data.stockpile.duplicate(true)
	check(not SimCareers.start(w,task.id).ok and equal(stock,w.data.stockpile),"unapproved start cannot spend or start")
	task=Fixture.prepare(app,"frontier","cook");w=app.simulation
	check(SimCareers.material_permit(w,"cook"),"material shortage fixture starts with real approval")
	for key in SimCareers.recipe("cook").inputs:w.data.stockpile.resources[key]=0
	check("公共材料不足" in app._career_next_step(task,0),"approved but missing material never says ready")
	task=Fixture.prepare(app,"frontier","trader");w=app.simulation
	check(not task.is_empty(),"controlled merchant provides real quote")
	w.quest_balance.governance.proposals=[]
	check("交易報價" in app._career_next_step(task,0),"trader must approve exact quote")
	check("明天再來" in app._career_next_step(task,3),"daily limit precedes trade approval")
	var report:={"checks":checks,"failures":failures,"scope":"available station roles in both towns: controlled work demand and initial doorstep, real UI walk/start, collision, active reload and timed completion; public approval and shared cap"}
	FileAccess.open("res://docs/CAREER_ONBOARDING_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

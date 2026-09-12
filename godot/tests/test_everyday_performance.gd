extends "res://tests/test_service_performance.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
func visible_props(actor: Node3D) -> int:
	var count:=0
	for side in ["ServiceRight","ServiceLeft"]:
		for child in actor.get_node("Body/"+side).get_children():
			if child.has_meta("career_tool") and child.visible: count+=1
	return count
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for job in CareerProps.JOBS:
			for ending in ["complete","cancel","leave","load","demand"]:
				var task: Dictionary=Fixture.prepare(app,town,job)
				if town=="harbor" and job=="tailor":
					check(task.is_empty(),"no fabricated harbor workshop");continue
				check(not task.is_empty(),"controlled demand available "+town+job)
				if task.is_empty(): continue
				var w: SimWorld=app.simulation
				pose(app)
				check(not app.world_view.actors.player.get_node("ServiceStatus").visible,"title alone does not work")
				check(SimCareers.start(w,task.id).ok,"real approved work starts "+job)
				var before:=w.snapshot();var positions: Dictionary=app.motion.positions.duplicate(true)
				for i in 12: pose(app)
				var actor: Node3D=app.world_view.actors.player
				var arm: Node3D=actor.get_node("Body/ServiceRight")
				var expected_props:=0 if job=="guard" else 2 if job in ["cook","tailor"] else 1
				if job in ["cook","tailor"]:
					var prop: Node3D=actor.get_node("Body/ServiceLeft/Duty_"+job+"_left")
					check(prop.global_basis.y.is_equal_approx(Vector3.UP),"held dish and cloth stay level while arms move")
				check(visible_props(actor)==expected_props and arm.rotation.x<-.2 and "尚未完成" in actor.get_node("ServiceStatus").text,"active work presents tool and truthful status")
				check(equal(before,w.snapshot()) and equal(positions,app.motion.positions),"visual work cannot produce stock XP or movement")
				var angle: float=arm.rotation.x;pose(app,0);check(is_equal_approx(angle,arm.rotation.x),"pause freezes pose")
				app.motion.positions.player.walking=true;pose(app);check(visible_props(actor)==0 and arm.rotation==Vector3.ZERO,"walking hides tool");app.motion.positions.player.walking=false;pose(app)
				if ending=="load":
					SimWorkSchedule.refresh(w,app.motion);SimShiftSleep.refresh(w,app.motion)
					var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"work pose reload")
					for i in 10: pose(app)
					actor=app.world_view.actors.player;arm=actor.get_node("Body/ServiceRight")
					check(visible_props(actor)==expected_props and equal(save,app.progress_snapshot()),"active reload reconstructs tool without settlement")
					SimCareers.cancel(w)
				elif ending=="complete": finish_service(app)
				elif ending=="cancel": SimCareers.cancel(w)
				elif ending=="leave": stand(app,"quarry" if job=="guard" else "town_square");app._validate_career_presence()
				else:
					if job=="farmer": w.data.farm.plots[0].waterLevel=90
					elif job=="guard": SimCareers.book(w).visits.append(task.target)
					elif job=="trader": w.data.trade.merchant=null
					else:
						for key in SimCareers.recipe(job).outputs: w.data.stockpile.resources[key]=SimSupply.reserve(w,key)
					SimCareers.tick(w)
				pose(app)
				check(visible_props(actor)==0 and arm.rotation==Vector3.ZERO,"terminal state releases tool "+ending)
				check(actor.get_node("ServiceStatus").text==("值勤完成" if ending=="complete" else "值勤中止"),"outcome agrees with actual settlement "+job+ending)
				check(SimCareers.book(w).used==(1 if ending=="complete" else 0),"only actual completion uses quota")
				for i in 30: pose(app)
				check(actor.get_node("TravelerMarker").visible,"traveler marker restored")
	# Switch jobs without rebuilding the actor: cached props on BOTH arms must retire.
	var cook_task: Dictionary=Fixture.prepare(app,"frontier","cook")
	var w: SimWorld=app.simulation
	check(SimCareers.start(w,cook_task.id).ok,"transition cook begins")
	for i in 10: pose(app)
	var same_actor: Node3D=app.world_view.actors.player
	check(visible_props(same_actor)==2,"cook has both held props")
	SimCareers.cancel(w);pose(app);SimCareers.enroll(w,"guard");stand(app,"town_square")
	check(SimCareers.start(w,"patrol:town_square").ok,"transition guard begins")
	for i in 10: pose(app)
	check(app.world_view.actors.player==same_actor and visible_props(same_actor)==0,"guard does not retain cook props on either arm")
	SimCareers.cancel(w);pose(app);SimCareers.enroll(w,"farmer")
	w.data.farm.plots=[{"id":1,"state":"growing","waterLevel":50}];stand(app,"meadow")
	check(SimCareers.start(w,"water:1").ok,"transition farmer begins")
	for i in 10: pose(app)
	check(visible_props(same_actor)==1 and same_actor.get_node("Body/ServiceRight/Duty_farmer_right").visible,"only current role prop returns")
	var report:={"checks":checks,"failures":failures,"scope":"five everyday roles; actual approvals/start/settlement in original facilities, both towns with harbor tailor exclusion; controlled demand and position; cancel, leave, filled demand, reload, no visual rewards, pause and movement"}
	FileAccess.open("res://docs/EVERYDAY_PERFORMANCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

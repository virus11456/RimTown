extends "res://tests/test_service_performance.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for job in ServicePerformance.TOOLS:
			for ending in ["complete","cancel","leave","load","demand"]:
				var task: Dictionary=Fixture.prepare(app,town,job)
				if town=="harbor" and job in ["carpenter","blacksmith"]:
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
				var tool: Node3D=arm.get_node(str(ServicePerformance.TOOLS[job]))
				check(tool.rotation.x==0 if job=="researcher" else is_equal_approx(tool.rotation.x,PI/2),"tool shaft faces away from forearm")
				check(tool.visible and arm.rotation.x<-.2 and "尚未完成" in actor.get_node("ServiceStatus").text,"active work presents tool and truthful status")
				check(equal(before,w.snapshot()) and equal(positions,app.motion.positions),"visual work cannot produce stock XP or movement")
				var angle: float=arm.rotation.x;pose(app,0);check(is_equal_approx(angle,arm.rotation.x),"pause freezes pose")
				app.motion.positions.player.walking=true;pose(app);check(not tool.visible and arm.rotation==Vector3.ZERO,"walking hides tool");app.motion.positions.player.walking=false;pose(app)
				if ending=="load":
					SimWorkSchedule.refresh(w,app.motion);SimShiftSleep.refresh(w,app.motion)
					var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"work pose reload")
					for i in 10: pose(app)
					actor=app.world_view.actors.player;arm=actor.get_node("Body/ServiceRight");tool=arm.get_node(str(ServicePerformance.TOOLS[job]))
					check(tool.visible and equal(save,app.progress_snapshot()),"active reload reconstructs tool without settlement")
					SimCareers.cancel(w)
				elif ending=="complete": finish_service(app)
				elif ending=="cancel": SimCareers.cancel(w)
				elif ending=="leave": stand(app,"town_square");app._validate_career_presence()
				else:
					if job=="researcher": w.data.research.current=null
					elif job=="carpenter": w.data.buildings.projects[0].workDone=w.data.buildings.projects[0].workRequired
					else:
						for key in SimCareers.recipe(job).outputs: w.data.stockpile.resources[key]=SimSupply.reserve(w,key)
					SimCareers.tick(w)
				pose(app)
				check(not tool.visible and arm.rotation==Vector3.ZERO,"terminal state releases tool "+ending)
				check(actor.get_node("ServiceStatus").text==("值勤完成" if ending=="complete" else "值勤中止"),"outcome agrees with actual settlement "+job+ending)
				check(SimCareers.book(w).used==(1 if ending=="complete" else 0),"only actual completion uses quota")
				for i in 30: pose(app)
				check(actor.get_node("TravelerMarker").visible,"traveler marker restored")
	var report:={"checks":checks,"failures":failures,"scope":"four tool roles; actual approvals/start/settlement in original facilities, both towns with harbor workshop exclusions; controlled demand and position; cancel, leave, filled demand, reload, no visual rewards, pause and movement"}
	FileAccess.open("res://docs/WORK_PERFORMANCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_indoor_service.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for job in SimWorkstation.JOBS:
		for ending in ["complete","leave","cancel","load","threshold"]:
			var task:=Fixture.prepare(app,"frontier",job)
			var w: SimWorld=app.simulation;var m: SimMotion=app.motion
			var station:=SimWorkstation.resolve(m.layout,job)
			check(not station.is_empty(),"station exists "+job)
			var zone: Dictionary=m.layout.buildings.workshop
			put(m,"player",Vector2(zone.doorPixelX,zone.doorPixelY));w.data.agents.player.currentLocation="workshop"
			var stock: Dictionary=w.data.stockpile.duplicate(true)
			check(not SimCareers.start(w,task.id).ok,"logical destination cannot start bench work")
			check(walk(app,m.layout._center("workshop")),"walk inside")
			check(not SimCareers.start(w,task.id).ok,"room center cannot work remotely")
			check(equal(stock,w.data.stockpile) and SimCareers.book(w).used==0,"rejected attempts consume nothing")
			check(walk(app,station.stand),"walk to bench without snapping")
			for i in 120:
				var offset: Vector2=station.stand-point(m)
				if offset.length()<.1: break
				m.move_player(offset.limit_length(),minf(1.0/60,offset.length()/72))
			m.move_player(Vector2.ZERO,1.0/60);w.data.agents.player.currentLocation="workshop"
			app.show_careers();await settle()
			var feet_before:=point(m)
			press(app.drawer_body,"查看工房工作台")
			check(point(m)==feet_before,"view station button does not teleport")
			var started:=SimCareers.start(w,task.id)
			check(started.ok,"arrived work starts "+str(started))
			if not started.ok: print(JSON.stringify({"failures":failures}));quit(1);return
			app.show_careers();await settle()
			var before: Dictionary=app.progress_snapshot()
			var minimum:=INF
			for i in 160:
				app.world_view.animate_agents(m.positions);app.world_view.service_performance.update(app.world_view,w,m,1.0/60)
				var tool: MeshInstance3D=app.world_view.actors.player.get_node("Body/ServiceRight/acc_tool_hammer")
				var height:=ServicePerformance.hammer_bottom(tool)
				minimum=minf(minimum,height)
				check(height>=.919,"hammer head never penetrates work slab")
				if height<.923:
					var center:=tool.global_transform*Vector3(0,.7,0)
					check(absf(center.x-station.bench.x)<.39 and absf(center.z-station.bench.y)<.47,"contact is above table footprint")
			check(minimum<.923,"swing reaches work surface")
			check(equal(before,app.progress_snapshot()),"pose does not move feet or produce rewards")
			check(is_equal_approx(app.world_view.actors.player.rotation.y,PI),"faces fixed bench")
			if ending=="load":
				SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m);before=app.progress_snapshot()
				app._load_document(JSON.stringify(before),"bench reload")
				check(SimWorkstation.error(m,job).is_empty() and not SimCareers.book(w).active.is_empty(),"reload at station keeps work")
			elif ending=="complete":
				w.data.tickCount=SimCareers.book(w).active.finish;SimCareers.tick(w)
				check(SimCareers.book(w).used==1,"only completion consumes quota")
			elif ending=="leave":
				check(walk(app,m.layout._center("workshop")),"walk away within room")
				app._validate_career_presence()
				check(SimCareers.book(w).active.is_empty() and SimCareers.book(w).used==0,"leaving station cancels inside same room")
			elif ending=="threshold":
				m.positions.player.doorPhase="entering";SimCareers.tick(w)
				check(SimCareers.book(w).active.is_empty() and SimCareers.book(w).used==0,"unfinished doorway invalidates work")
			else:
				SimCareers.cancel(w);check(SimCareers.book(w).used==0,"cancel no quota")
	app.load_demo("harbor")
	for job in SimWorkstation.JOBS: check(SimWorkstation.resolve(app.motion.layout,job).is_empty(),"missing harbor workshop cannot get phantom bench")
	check(bad_cells==0 and maximum_step<=1.201,"walks remain collision safe")
	var report:={"checks":checks,"failures":failures,"walked_frames":walked_frames,"bad_cells":bad_cells,"maximum_step":maximum_step,"scope":"two bench roles in frontier; actual entry and station walk, remote refusal, pure pose, complete, leave, cancel, reload, doorway, missing harbor workshop; controlled demand"}
	FileAccess.open("res://docs/WORKSTATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

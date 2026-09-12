extends "res://tests/test_indoor_service.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
var samples:=0
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for job in SimWorkstation.JOBS:
			for ending in ["arrive","manual","reload","change","stop"]:
				var task:=Fixture.prepare(app,town,job)
				if task.is_empty(): check(town=="harbor" and job in ["carpenter","blacksmith","tailor"],"only missing facilities skipped");continue
				var w: SimWorld=app.simulation;var m: SimMotion=app.motion
				var z: Dictionary=m.layout.buildings[task.location]
				put(m,"player",Vector2(z.doorPixelX,z.doorPixelY));m.move_player(Vector2.ZERO,0)
				app.show_careers();await settle();var initial:=point(m)
				press(app.drawer_body,"走到"+SimWorkstation.label(job))
				check(point(m)==initial and not app.station_approach.job.is_empty(),"button schedules walk without teleport")
				var stock: Dictionary=w.data.stockpile.duplicate(true)
				for frame in 3000:
					var before:=point(m);app._process_traveler(1.0/60);samples+=1
					check(before.distance_to(point(m))<=1.201 and m.layout._walkable(point(m)),"arrival route uses bounded collision steps")
					if frame==3 and ending!="arrive": break
					if app.station_approach.job.is_empty(): break
				if ending=="arrive":
					check(app.station_approach.job.is_empty() and SimWorkstation.error(m,job).is_empty(),"route finishes at valid exact station")
					check(SimCareers.book(w).active.is_empty() and equal(stock,w.data.stockpile),"arrival neither starts nor consumes resources")
					press(app.drawer_body,"開始："+str(task.label))
					check(not SimCareers.book(w).active.is_empty(),"arrival page can explicitly start")
				elif ending=="manual":
					app.station_approach.step(w,m,Vector2.RIGHT,1.0/60)
					check(app.station_approach.job.is_empty(),"manual input cancels route")
				elif ending=="reload":
					m.move_player(Vector2.ZERO,0);SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
					var save: Dictionary=app.progress_snapshot();var feet:=point(m)
					app._load_document(JSON.stringify(save),"approach reload")
					check(app.station_approach.job.is_empty() and point(m)==feet,"reload keeps actual feet and drops queued approach")
				elif ending=="change":
					if job=="researcher": w.data.research.current=null
					else: w.data.agents.player.jobKey=""
					var feet:=point(m);app._process_traveler(1.0/60)
					check(app.station_approach.job.is_empty() and point(m)==feet,"changed need or role stops before moving")
				else:
					app.show_careers();await settle();press(app.drawer_body,"停止前往操作台")
					check(app.station_approach.job.is_empty() and not m.positions.player.walking,"stop button releases walking")
	var at_task:=Fixture.prepare(app,"frontier","cook")
	app.motion.manual_player=false;app.motion.positions.player.walking=true
	check(app.station_approach.begin(app.simulation,app.motion,at_task.id,"cook"),"already at goal accepts explicit control")
	app.station_approach.step(app.simulation,app.motion,Vector2.ZERO,1.0/60)
	check(app.motion.manual_player and not app.motion.positions.player.walking and app.station_approach.job.is_empty(),"already arrived stops prior automatic walking")
	# Controlled day-boundary coverage for every available station role.
	for town in ["frontier","harbor"]:
		for job in SimWorkstation.JOBS:
			var task:=Fixture.prepare(app,town,job)
			if task.is_empty(): continue
			var w: SimWorld=app.simulation
			w.data.clock.hour=23;w.data.clock.minute=45
			check(SimCareers.start(w,task.id).ok,"late-night task starts at station")
			app._tick_simulation()
			check(SimCareers.book(w).active.is_empty() and SimCareers.book(w).used==0 and SimCareerProgress.progress(w,job).completed==0,"midnight cancels without completion and resets shared quota")
	var report:={"checks":checks,"failures":failures,"motion_samples":samples,"scope":"five station roles across both towns where facilities exist; actual UI request, collision bounded route, explicit start only, keyboard takeover, mid-route reload, changed research need/job, stop button, already-at-goal control transfer and all-role midnight cancellation"}
	FileAccess.open("res://docs/STATION_APPROACH_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

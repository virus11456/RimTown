extends "res://tests/test_dual_town_frontier.gd"
var cases: Array=[]
func render(app: Node,delta: float=1.0/60) -> void:
	app.world_view.animate_agents(app.motion.positions)
	app.world_view.animate_resident_gaits(app.motion.positions,delta)
	app.world_view.resident_work.update(app.world_view,app.simulation,app.motion,delta)
func tools_visible(actor: Node3D) -> int:
	var count:=0
	for side in ["ServiceRight","ServiceLeft"]:
		for tool in actor.get_node("Body/"+side).get_children():
			if tool.has_meta("career_tool") and tool.visible: count+=1
	return count
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for job in SimWorkstation.JOBS:
			app.load_demo(town)
			var w: SimWorld=app.simulation;var m: SimMotion=app.motion;m.manual_player=true
			var station:=SimWorkstation.resolve(m.layout,job)
			if station.is_empty(): check(town=="harbor" and job in ["carpenter","blacksmith","tailor"],"missing workshop gracefully unavailable");continue
			var ids: Array=w.data.agents.keys().filter(func(id):return id!="player");ids.sort()
			var id: String=ids[0];var other: String=ids[1]
			for a in w.data.agents.values(): a.activity="idle"
			var a: Dictionary=w.data.agents[id];a.jobKey=job;a.activity="working";a.currentLocation=SimWorkstation.LOCATIONS[job];a.age=28
			app.world_view.display_save(w.snapshot())
			var p: Dictionary=m.positions[id];last_points.clear();audit(m)
			var arrived:=false;var frames:=0
			for frame in 12000:
				m.update(w.data.agents);audit(m);frames+=1
				if frame%10==0: render(app);check(tools_visible(app.world_view.actors[id])==0 or not p.walking,"tools hidden while commuting")
				if not p.walking and p.get("doorPhase")==null and Vector2(p.x,p.y).distance_to(station.stand)<=2: arrived=true;break
			if not arrived: print(JSON.stringify({"stalled":p,"station":str(station),"player":m.positions.player}))
			check(arrived,"worker follows collision route to "+town+" "+job)
			var before: Dictionary=w.snapshot();var motion_before: Dictionary=m.positions.duplicate(true)
			for frame in 90:
				render(app)
				check(tools_visible(app.world_view.actors[id])>0,"tools visible only after arrival")
				var right: Node3D=app.world_view.actors[id].get_node("Body/ServiceRight")
				if job in ["cook","tailor","researcher"]:
					var prop: Node3D=right.get_node("acc_tool_book") if job=="researcher" else CareerProps.get_prop(app.world_view.actors[id].get_node("Body/ServiceLeft"),job,"left")
					check(DeskPerformance.bounds(prop).position.y>=.834,"work material remains above desk")
				if job in SimWorkstation.HAMMER_JOBS: check(ServicePerformance.hammer_bottom(right.get_node("acc_tool_hammer"))>=.919,"hammer remains above slab")
			check(equal(before,w.snapshot()) and equal(motion_before,m.positions),"presentation cannot spend or produce resources or move people")
			# Paused app freezes residents, including station phase.
			var phases: Dictionary=app.world_view.resident_work.phases.duplicate(true)
			app.running=false;app._process(.2)
			check(equal(phases,app.world_view.resident_work.phases),"pause freezes resident work animation")
			# Shared station deterministically admits only one worker.
			var b: Dictionary=w.data.agents[other];b.jobKey="blacksmith" if job=="carpenter" else job;b.currentLocation=a.currentLocation;b.activity="working"
			var assignment:=SimResidentWorkstation.assignments(m.layout,w.data.agents,m.positions)
			check(assignment[id].working and not assignment[other].working,"one worker per shared bench")
			for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
				a[key]=a.currentLocation
				check(not SimResidentWorkstation.assignments(m.layout,w.data.agents,m.positions).has(id),"social plans override work station")
				a.erase(key)
			a._serviceStay=true;check(not SimResidentWorkstation.assignments(m.layout,w.data.agents,m.positions).has(id),"service overrides station");a.erase("_serviceStay")
			# Player approaches; worker walks to waiting point rather than teleporting.
			m.positions.player.x=station.stand.x;m.positions.player.y=station.stand.y
			last_points.clear();audit(m)
			assignment=SimResidentWorkstation.assignments(m.layout,w.data.agents,m.positions)
			check(not assignment[id].working and assignment[id].target.distance_to(station.stand)>=24,"player proximity reserves station")
			var wait_target: Vector2=assignment[id].target
			for frame in 600: m.update(w.data.agents);audit(m)
			render(app)
			check(Vector2(p.x,p.y).distance_to(wait_target)<=2 and tools_visible(app.world_view.actors[id])==0,"worker walks aside and hides tools")
			a.activity="heading_home";a.currentLocation=a.homeLocation
			m.update(w.data.agents);render(app)
			check(not str(p._directedGoal.route_key).begins_with("station:") and tools_visible(app.world_view.actors[id])==0,"off shift returns to ordinary home routing")
			var save: Dictionary=app.progress_snapshot()
			app._load_document(JSON.stringify(save),"resident station reload")
			check(app.world_view.resident_work.phases.is_empty(),"reload clears transient station poses")
			check(Vector2(app.motion.positions[id].x,app.motion.positions[id].y).distance_to(Vector2(p.x,p.y))<.001,"reload preserves actual worker location")
			cases.append({"town":town,"job":job,"commute_frames":frames,"arrived":arrived})
	check(invalid_steps.is_empty() and maximum_npc<1.001,"all transitions collision safe with bounded walking steps")
	var report:={"checks":checks,"failures":failures,"cases":cases,"maximum_npc_step":maximum_npc,"invalid_steps":invalid_steps,"scope":"controlled job assignments; real collision routes; no render rewards; social/service priority, contention, player yielding, off-shift"}
	FileAccess.open("res://docs/RESIDENT_WORKSTATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

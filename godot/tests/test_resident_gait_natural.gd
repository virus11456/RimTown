extends "res://tests/test_dual_town_frontier.gd"
func run() -> void:
	var town:="harbor" if "--harbor" in OS.get_cmdline_user_args() else "frontier"
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.load_demo(town)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion;m.manual_player=true
	var original: Array=w.data.agents.keys();var slept: Dictionary={};var walked: Dictionary={};var homes: Dictionary={};var work: Dictionary={}
	var bad_sleep: Array=[];var ground_errors: Array=[];var jobs: Dictionary={};var rendered:=0
	for id in original: jobs[id]=w.data.agents[id].jobKey
	for tick in 96:
		app._tick_simulation();audit(m)
		for frame in 480:
			m.update(w.data.agents);audit(m)
			SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
			if frame%4==0:
				app.world_view.animate_agents(m.positions);app.world_view.animate_resident_gaits(m.positions,4.0/60);rendered+=1
		for id in original:
			if id=="player": continue
			var p: Dictionary=m.positions[id];var a: Dictionary=w.data.agents[id]
			if p.get("walking",false): walked[id]=true
			if p.get("activity","")=="heading_home": homes[id]=true
			if a.activity=="working": work[id]=true
			if a.activity=="sleeping":
				if SimHomeRest.arrived(w,a): slept[id]=true
				elif bad_sleep.size()<8: bad_sleep.append({"id":id,"tick":tick})
			if not p.get("walking",false): continue
			var actor: Node3D=app.world_view.actors[id]
			var gait: TravelerGait=app.world_view.resident_gaits[id]
			for side in 2:
				if gait.feet.is_empty(): continue
				var shoe: MeshInstance3D=actor.get_node("Body/GaitRight" if side==0 else "Body/GaitLeft")
				var bottom:=INF
				for v in shoe.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]: bottom=minf(bottom,(shoe.global_transform*v).y)
				if bottom<.1198 and ground_errors.size()<8: ground_errors.append({"id":id,"tick":tick,"bottom":bottom})
		if tick==47:
			m.move_player(Vector2.ZERO,0);SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
			var before: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(before),"resident gait half-day reload")
			var restored: Dictionary=app.progress_snapshot()._godot4a.motion
			if not equal(before._godot4a.motion,restored):
				for id in restored:
					for key in restored[id]:
						if not equal(before._godot4a.motion[id].get(key),restored[id][key]): print({"reload_difference":id,"field":key,"before":before._godot4a.motion[id].get(key),"after":restored[id][key]})
			check(equal(before._godot4a.motion,restored),"reload preserves natural positions")
		if tick%24==23: print(JSON.stringify({"town":town,"tick":tick+1,"walkers":walked.size(),"sleepers":slept.size()}))
	check(original.all(func(id):return id=="player" or walked.has(id)),"all original residents observed walking")
	check(original.all(func(id):return id=="player" or slept.has(id)) and bad_sleep.is_empty(),"all original residents sleep at actual home")
	check(not homes.is_empty() and not work.is_empty(),"return-home and work states observed naturally")
	check(ground_errors.is_empty() and invalid_steps.is_empty() and maximum_npc<1.001,"rendered shoes stay above floor and simulation steps remain bounded")
	check(original.all(func(id):return jobs[id]==w.data.agents[id].jobKey),"animation does not reassign jobs or guards")
	var report:={"checks":checks,"failures":failures,"town":town,"ticks":96,"motion_frames":46080,"render_samples":rendered,"walked":walked.keys(),"slept":slept.keys(),"heading_home":homes.keys(),"worked":work.keys(),"bad_sleep":bad_sleep,"ground_errors":ground_errors,"invalid_steps":invalid_steps,"maximum_npc_step":maximum_npc,"scope":"original town resources, jobs, shifts and needs; one natural day, every collision frame audited, resident poses updated at 15Hz, shoe geometry checked each tick, half-day reload; no forced resident positions/needs"}
	FileAccess.open("res://docs/RESIDENT_GAIT_NATURAL_"+town.to_upper()+".json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

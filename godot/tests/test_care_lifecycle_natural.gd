extends "res://tests/test_dual_town_frontier.gd"
func run() -> void:
	var town:="harbor" if "--harbor" in OS.get_cmdline_user_args() else "frontier"
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.load_demo(town)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion;m.manual_player=true
	var original: Array=w.data.agents.keys();var slept: Dictionary={};var walked: Dictionary={};var homes: Dictionary={};var work: Dictionary={}
	var station_work: Dictionary={}
	var civic_hours: Dictionary={}
	var care_pairs: Dictionary={}
	var requests: Dictionary={}
	var results: Dictionary={}
	var quota_errors: Array=[]
	var care_errors: Array=[]
	var invalid_duty: Array=[]
	var stacked_farmers: Array=[]
	var bad_sleep: Array=[];var ground_errors: Array=[];var jobs: Dictionary={};var rendered:=0
	for id in original: jobs[id]=w.data.agents[id].jobKey
	for tick in 384:
		app._tick_simulation();audit(m)
		for id in w.data.agents:
			var resident: Dictionary=w.data.agents[id]
			if resident.has("_careVisit"): requests[id]=true
			if int(resident.get("_careProvided",{}).get("used",0))>3 and id not in quota_errors: quota_errors.append(id)
			for result in resident.get("_careResults",[]): results[str(id)+":"+str(int(result.tick))+":"+str(result.state)]=result
		for frame in 480:
			m.update(w.data.agents);audit(m)
			SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
			if frame%4==0:
				app.world_view.animate_agents(m.positions);app.world_view.animate_resident_gaits(m.positions,4.0/60);rendered+=1
				app.world_view.resident_work.update(app.world_view,w,m,4.0/60)
				app.world_view.resident_care.update(app.world_view,w,m,4.0/60)
				for provider in app.world_view.resident_care.pairs:
					var recipient: String=app.world_view.resident_care.pairs[provider].target
					care_pairs[provider+":"+recipient]=true
					if ResidentCarePerformance.target(w,m,provider)!=recipient and care_errors.size()<5: care_errors.append(provider)
				var farm_points: Array=[]
				for worker in app.world_view.resident_work.phases:
					station_work[worker]=w.data.agents[worker].jobKey
					if station_work[worker] in CivicWorkPerformance.JOBS:
						if not civic_hours.has(worker): civic_hours[worker]=[]
						if w.data.clock.hour not in civic_hours[worker]: civic_hours[worker].append(w.data.clock.hour)
						if not CivicWorkPerformance.ready(w,m,worker) and invalid_duty.size()<8: invalid_duty.append(worker)
					if w.data.agents[worker].jobKey=="farmer":
						var point:=Vector2(m.positions[worker].x,m.positions[worker].y)
						if point in farm_points and stacked_farmers.size()<5: stacked_farmers.append(worker)
						farm_points.append(point)
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
		if tick==191:
			m.move_player(Vector2.ZERO,0);SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
			var before: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(before),"resident gait mid-run reload")
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
	check(not station_work.is_empty(),"original workers actually reach and use stations")
	var outdoor_ids: Array=station_work.keys().filter(func(id):return station_work[id] in OutdoorWorkPerformance.JOBS)
	if town=="frontier": check(not outdoor_ids.is_empty(),"original miners actually perform outdoor work")
	if not w.data.townMap.locations.has("farm"): check(station_work.values().all(func(job):return job!="farmer"),"missing farm grants no farmer work animation")
	check(stacked_farmers.is_empty(),"working farmers do not overlap at the same bed")
	check(invalid_duty.is_empty() and civic_hours.keys().any(func(id):return jobs[id]=="guard") and civic_hours.keys().any(func(id):return jobs[id]=="trader"),"original guards and traders actually perform duty within schedule")
	if town=="frontier": check(civic_hours.has("gao_lang") and civic_hours.gao_lang.any(func(hour):return hour>=18 or hour<6),"night guard performs real night duty")
	check(care_errors.is_empty(),"care display never targets an invalid conversation or recipient")
	check(quota_errors.is_empty(),"provider daily cap holds across four days")
	var report:={"care_results":results,"quota_errors":quota_errors,"requests_observed":requests.keys(),"care_pairs_observed":care_pairs.keys(),"care_errors":care_errors,"civic_hours":civic_hours,"invalid_duty":invalid_duty,"stacked_farmers":stacked_farmers,"outdoor_workers":outdoor_ids,"station_work":station_work,"checks":checks,"failures":failures,"town":town,"ticks":384,"motion_frames":184320,"render_samples":rendered,"walked":walked.keys(),"slept":slept.keys(),"heading_home":homes.keys(),"worked":work.keys(),"bad_sleep":bad_sleep,"ground_errors":ground_errors,"invalid_steps":invalid_steps,"maximum_npc_step":maximum_npc,"scope":"original town resources, jobs, shifts and needs; four natural days, every collision frame audited, resident poses updated at 15Hz, shoe geometry checked each tick, mid-run reload; no forced resident positions/needs"}
	FileAccess.open("res://docs/CARE_LIFECYCLE_NATURAL_"+town.to_upper()+".json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var traces: Array=[]
	var w: SimWorld=app.simulation;var shifts: Array=[];var maximum_step:=0.0;var sleep_ticks:=0;var return_ticks:=0;var sleepers: Dictionary={};var false_sleep: Array=[];var daily: Dictionary={}
	for t in 192:
		app._tick_simulation()
		for id in w.data.agents:
			var resident: Dictionary=w.data.agents[id]
			if resident.get("isPlayer",false) or resident.get("isDead",false): continue
			var pos: Dictionary=app.motion.positions.get(id,{})
			traces.append({"id":id,"tick":w.data.tickCount,"hour":w.data.clock.hour,"minute":w.data.clock.minute,"activity":resident.activity,"location":resident.currentLocation,"actual":SimCareerPresence.place(app.motion,id),"hunger":resident.needs.hunger,"rest":resident.needs.rest,"sleep":resident.get("_shiftSleep",{}).duplicate(true),"x":pos.get("x"),"y":pos.get("y"),"phase":pos.get("doorPhase"),"walking":pos.get("walking")})
			var day:=str(SimClock.total_days(w.data.clock));var key:=day+":"+str(id)
			if not daily.has(key): daily[key]={"id":id,"day":day,"observed_ticks":0,"sleep_ticks":0,"scheduled_ticks":0,"sleep_in_window":0,"return_ticks":0,"work_ticks":0,"eating_ticks":0}
			var row: Dictionary=daily[key];row.observed_ticks+=1
			var scheduled:=SimShiftSleep.asleep(resident,w.rules.jobs,int(w.data.clock.hour))
			if scheduled: row.scheduled_ticks+=1
			if resident.activity=="heading_home": row.return_ticks+=1
			if resident.activity=="working": row.work_ticks+=1
			if resident.activity=="eating": row.eating_ticks+=1
			if resident.activity=="sleeping":
				row.sleep_ticks+=1
				if scheduled: row.sleep_in_window+=1
				sleep_ticks+=1;sleepers[id]=true
				if not SimHomeRest.arrived(w,resident): false_sleep.append({"id":id,"tick":w.data.tickCount})
			elif resident.activity=="heading_home": return_ticks+=1
		if int(w.data.clock.minute)==0:
			for id in w.data.agents:
				var a: Dictionary=w.data.agents[id];var job: Dictionary=SimWorkSchedule.job(a,w.rules.jobs)
				if a.get("isPlayer",false) or a.get("isDead",false) or job.is_empty() or int(w.data.clock.hour)!=int(job.work_hours[0]): continue
				shifts.append({"id":id,"tick":w.data.tickCount,"workplace":job.workplace,"facility_available":w.data.townMap.locations.has(job.workplace),"actual_place":SimCareerPresence.place(app.motion,id),"on_time":SimCareerPresence.place(app.motion,id)==job.workplace,"activity":a.activity})
		for frame in app.motion.frames_per_tick():
			var before: Dictionary={}
			for id in app.motion.positions: before[id]=Vector2(app.motion.positions[id].x,app.motion.positions[id].y)
			app.motion.update(w.data.agents);SimAppointments.observe(w,app.motion);SimLeisurePlan.observe(w,app.motion);SimHangoutVisits.observe(w,app.motion)
			for id in before:
				if app.motion.positions.has(id): maximum_step=maxf(maximum_step,before[id].distance_to(Vector2(app.motion.positions[id].x,app.motion.positions[id].y)))

	var eligible:=shifts.filter(func(row): return row.facility_available)
	var on_time:=shifts.filter(func(row): return row.on_time).size()
	check(not shifts.is_empty(),"natural scheduled shifts observed")
	check(maximum_step<2,"commuting never teleports")
	check(false_sleep.is_empty(),"sleeping always corresponds to stopped own-home position")
	check(sleep_ticks>0 and return_ticks>0,"natural return and real home sleep both observed")
	check(daily.values().filter(func(row): return row.observed_ticks==96).size()==20,"all twenty residents have a complete calendar-day observation")
	var sum_sleep:=0
	for row in daily.values(): sum_sleep+=int(row.sleep_ticks)
	check(sum_sleep==sleep_ticks,"per-person sleep totals reconcile with aggregate")
	var report:={"eligible_shifts":eligible.size(),"unavailable_shifts":shifts.size()-eligible.size(),"traces":traces,"checks":checks,"failures":failures,"shifts":shifts,"resident_calendar_days":daily.values(),"sleep_ticks":sleep_ticks,"return_ticks":return_ticks,"sleepers":sleepers.keys(),"false_sleep":false_sleep,"on_time":on_time,"total":shifts.size(),"maximum_step":maximum_step,"scope":"two original app days with real movement, measured actual venue at scheduled work start before movement of that tick; no changed jobs/needs/positions/resources, not proof of every worker arriving on time"}
	FileAccess.open("res://docs/ROUTINE_AUDIT_CURRENT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

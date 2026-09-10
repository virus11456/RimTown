extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var shifts: Array=[];var maximum_step:=0.0;var sleep_ticks:=0;var return_ticks:=0;var sleepers: Dictionary={};var false_sleep: Array=[];var daily: Dictionary={};var diagnostic: Array=[];var sleep_commutes: Array=[]
	for t in 192:
		app._tick_simulation()
		for id in w.data.agents:
			var resident: Dictionary=w.data.agents[id]
			if resident.get("isPlayer",false) or resident.get("isDead",false): continue
			var day:=str(SimClock.total_days(w.data.clock));var key:=day+":"+str(id)
			if not daily.has(key): daily[key]={"id":id,"day":day,"observed_ticks":0,"sleep_ticks":0,"scheduled_ticks":0,"sleep_in_window":0,"return_ticks":0,"work_ticks":0,"eating_ticks":0}
			var row: Dictionary=daily[key];row.observed_ticks+=1
			var scheduled:=SimShiftSleep.asleep(resident,w.rules.jobs,int(w.data.clock.hour))
			if scheduled:
				row.scheduled_ticks+=1
				if resident.activity=="commuting": sleep_commutes.append({"id":id,"tick":w.data.tickCount})
			if resident.activity=="heading_home": row.return_ticks+=1
			if resident.activity=="working": row.work_ticks+=1
			if resident.activity=="eating": row.eating_ticks+=1
			if resident.activity=="sleeping":
				row.sleep_ticks+=1
				if scheduled: row.sleep_in_window+=1
				sleep_ticks+=1;sleepers[id]=true
				if not SimHomeRest.arrived(w,resident): false_sleep.append({"id":id,"tick":w.data.tickCount})
			elif resident.activity=="heading_home": return_ticks+=1
		for id in ["zhao_xia","lin_mei","he_chang"]:
			var a: Dictionary=w.data.agents[id]
			diagnostic.append({"id":id,"tick":w.data.tickCount,"hour":w.data.clock.hour,"minute":w.data.clock.minute,"activity":a.activity,"destination":a.currentLocation,"home":a.homeLocation,"house":app.motion.layout._house_id(id,a.homeLocation),"needs":a.needs.duplicate(),"sleep_window":{"start":SimShiftSleep.window(a,w.rules.jobs).start,"end":SimShiftSleep.window(a,w.rules.jobs).end},"motion":{"x":app.motion.positions[id].x,"y":app.motion.positions[id].y,"walking":app.motion.positions[id].walking,"doorPhase":app.motion.positions[id].get("doorPhase"),"targetX":app.motion.positions[id].targetX,"targetY":app.motion.positions[id].targetY}})
		if int(w.data.clock.minute)==0:
			for id in w.data.agents:
				var a: Dictionary=w.data.agents[id];var job: Dictionary=w.rules.jobs.get(str(a.get("jobKey","")),{})
				if a.get("isPlayer",false) or a.get("isDead",false) or job.is_empty() or int(w.data.clock.hour)!=int(job.work_hours[0]): continue
				shifts.append({"id":id,"tick":w.data.tickCount,"workplace":job.workplace,"actual_place":SimCareerPresence.place(app.motion,id),"on_time":SimCareerPresence.place(app.motion,id)==job.workplace,"activity":a.activity})
		for frame in 120:
			var before: Dictionary={}
			for id in app.motion.positions: before[id]=Vector2(app.motion.positions[id].x,app.motion.positions[id].y)
			app.motion.update(w.data.agents);SimAppointments.observe(w,app.motion);SimLeisurePlan.observe(w,app.motion);SimHangoutVisits.observe(w,app.motion)
			for id in before:
				if app.motion.positions.has(id): maximum_step=maxf(maximum_step,before[id].distance_to(Vector2(app.motion.positions[id].x,app.motion.positions[id].y)))

	var on_time:=shifts.filter(func(row): return row.on_time).size()
	check(not shifts.is_empty(),"natural scheduled shifts observed")
	check(maximum_step<2,"commuting never teleports")
	check(false_sleep.is_empty(),"sleeping always corresponds to stopped own-home position")
	check(sleep_ticks>0 and return_ticks>0,"natural return and real home sleep both observed")
	check(daily.values().filter(func(row): return row.observed_ticks==96).size()==20,"all twenty residents have a complete calendar-day observation")
	for id in ["zhao_xia","lin_mei","he_chang"]:
		check(daily.values().any(func(row): return row.id==id and row.observed_ticks==96 and row.sleep_ticks>0),"tracked resident sleeps on full observed day: "+id)
	check(sleep_commutes.is_empty(),"no legacy commuting activity interrupts a scheduled sleep window")
	var sum_sleep:=0
	for row in daily.values(): sum_sleep+=int(row.sleep_ticks)
	check(sum_sleep==sleep_ticks,"per-person sleep totals reconcile with aggregate")
	var report:={"checks":checks,"failures":failures,"diagnostic":diagnostic,"sleep_commutes":sleep_commutes,"shifts":shifts,"resident_calendar_days":daily.values(),"sleep_ticks":sleep_ticks,"return_ticks":return_ticks,"sleepers":sleepers.keys(),"false_sleep":false_sleep,"on_time":on_time,"total":shifts.size(),"maximum_step":maximum_step,"scope":"two original app days with real movement, measured actual venue at scheduled work start before movement of that tick; no changed jobs/needs/positions/resources, not proof of every worker arriving on time"}
	FileAccess.open("res://docs/SLEEP_INTERRUPTION_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

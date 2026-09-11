extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	SimShiftSleep.refresh(w,m)
	var day: Dictionary=w.data.agents.yang_feng;var night: Dictionary=w.data.agents.gao_lang
	check(day._guardShift=="day" and night._guardShift=="night","existing frontier guards split into day and night")
	check(day.jobKey=="guard" and night.jobKey=="guard","guard profession is preserved")
	var day_job:=SimWorkSchedule.job(day,w.rules.jobs);var night_job:=SimWorkSchedule.job(night,w.rules.jobs)
	check(day_job.work_hours==[6,18] and night_job.work_hours==[18,6],"twelve-hour shifts meet at six and eighteen")
	var covered:=true
	for hour in 24:
		var count:=int(SimWorkSchedule.working(day_job,hour))+int(SimWorkSchedule.working(night_job,hour))
		if count!=1: covered=false
	check(covered,"two-person nominal roster covers each hour exactly once, not a physical attendance guarantee")
	check(not SimLeisurePlan.person_available(night,w.rules.jobs,23) and not SimLeisurePlan.person_available(night,w.rules.jobs,2),"night duty blocks leisure on both sides of midnight")
	check(not SimAppointments.free_hour(w,night.id,18),"night duty cannot accept an overlapping player appointment")
	var sleep:=SimShiftSleep.window(night,w.rules.jobs)
	check(int(sleep.duration)==8 and int(sleep.start)>=6 and int(sleep.end)<=18,"night guard retains eight-hour daytime sleep window")
	check(sleep.get("return_lead",0)>0,"daytime sleep reserves homeward travel after duty")
	w.data.clock.hour=23;night.needs.hunger=80;night.needs.rest=80;w._update(night.id)
	check(night.activity=="working" and night.currentLocation=="town_square","healthy night guard actually works at existing square")
	check(not w.data.townMap.locations.has("guardpost"),"fallback does not grant a free guardpost")
	app.show_tab("居民",true);app.show_agenda(night.id);await settle()
	check(has_text(app.drawer_body,"夜班") and has_text(app.drawer_body,"廣場值勤"),"phone agenda explains night shift and temporary post")
	var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"guard roster reload")
	check(w.data.agents.gao_lang._guardShift=="night" and w.data.agents.yang_feng._guardShift=="day","native app reload preserves assignments")
	for id in ["lin_mei","liu_jun"]:
		var resident: Dictionary=w.data.agents[id];w.data.clock.hour=12;resident.needs.hunger=80;resident.needs.rest=80
		w._update(id)
		check(resident.activity=="waiting_workplace" and w.data.townMap.locations.has(resident.currentLocation),"missing facility uses valid-place standby: "+id)
		check("工作設施未就緒" in str(SimAgenda.routine(w,id)),"agenda identifies missing facility: "+id)
	var original:=w.snapshot();var total: int=w.data.agents.size()
	w.data.agents.yang_feng.jobKey="";SimWorkSchedule.refresh(w,m)
	check(w.data.agents.gao_lang._guardShift=="night" and w.data.agents.size()==total,"single existing night guard keeps their shift without creating day coverage")
	w.load_snapshot(original);w.social.observe_positions(m)
	w.data.agents.gao_lang.jobKey="";w.data.agents.yang_feng.erase("_guardShift");SimWorkSchedule.refresh(w,m)
	check(w.data.agents.yang_feng._guardShift=="day" and not w.data.agents.gao_lang.has("_guardShift") and w.data.agents.size()==total,"one guard keeps one shift without creating a second person")
	w.data.agents.yang_feng.jobKey="";SimWorkSchedule.refresh(w,m)
	check(not w.data.agents.yang_feng.has("_guardShift") and w.data.agents.size()==total,"zero guards creates no roster or people")
	w.load_snapshot(original);w.social.observe_positions(m)
	w.data.townMap.locations.guardpost=w.data.townMap.locations.town_square.duplicate(true);SimWorkSchedule.refresh(w,m)
	check(w.data.agents.gao_lang._guardWorkplace=="guardpost","available guardpost replaces temporary square assignment")
	var report:={"checks":checks,"failures":failures,"night_sleep":sleep,"scope":"original two guards, job identity, cyclic hours, daytime sleep and homeward margin, actual night update, mobile agenda, save reload; controlled one/zero guard and new facility cases, no hiring or resource production"}
	FileAccess.open("res://docs/GUARD_ROSTER_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

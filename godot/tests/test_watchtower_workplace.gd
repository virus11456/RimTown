extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	check(SimWorkSchedule.job(w.data.agents.yang_feng,w.rules.jobs).workplace=="town_square","guards initially use existing square")
	var stock: Dictionary=w.data.stockpile.duplicate(true);var site: Vector2i=BuildingSites.candidates(w.data)[0]
	check(SimBuildings.start(w,"watchtower",false,site).is_empty() and equal(stock,w.data.stockpile),"traveler needs mayor approval before spending public resources")
	for a in w.data.agents.values():
		if a.jobKey=="mayor": a.jobKey=""
	w.data.agents.player.jobKey="mayor"
	w.data.stockpile.resources.wood=100;w.data.stockpile.resources.stone=100
	var count: int=w.data.agents.size()
	var project:=SimBuildings.start(w,"watchtower",false,site)
	check(not project.is_empty() and project.workRequired==20,"original tower work requirement")
	check(SimEconomy.amount(w,"wood")==60 and SimEconomy.amount(w,"stone")==70,"original tower material costs paid once")
	app._refresh_building_world();SimWorkplaces.sync(w)
	check(not w.data.townMap.locations.has("guardpost"),"unfinished tower is not a working guardpost")
	for day in 10:
		w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
		if w.data.buildings.projects.is_empty(): break
	check(project.status=="complete" and project.workDone>=20,"ordinary daily construction completes tower")
	check(m.layout.work_sites.has("guardpost") and int(m.layout.work_sites.guardpost.x)==site.x and int(m.layout.work_sites.guardpost.y)==site.y+2,"actual selected tower entrance becomes guardpost")
	check(not m.layout.buildings.has("guardpost"),"no duplicate guardpost spawned at old fixed location")
	check(w.data.agents.size()==count,"tower never hires or clones guards")
	for id in ["yang_feng","gao_lang"]:
		check(SimWorkSchedule.job(w.data.agents[id],w.rules.jobs).workplace=="guardpost","effective work destination changes: "+id)
	check(w.data.agents.yang_feng._guardShift=="day" and w.data.agents.gao_lang._guardShift=="night","construction preserves day/night assignments")
	check(not BuildingSites.allowed(w.data,Vector2i(site.x,site.y+2)),"tower entrance is reserved against later construction")
	check(not w.data.townMap.locations.has("clinic") and not w.data.townMap.locations.has("farm"),"tower does not grant other facilities")
	stock=w.data.stockpile.duplicate(true);var effects: Dictionary=w.data.buildings.activeEffects.duplicate(true)
	SimWorkplaces.sync(w);SimWorkplaces.sync(w)
	check(equal(stock,w.data.stockpile) and equal(effects,w.data.buildings.activeEffects),"sync cannot duplicate costs or defense bonuses")
	var arrived: Dictionary={};var slept: Dictionary={};var bad_sleep: Array=[];var shifts: Array=[];var maximum_step:=0.0
	# Normal cadence from completion: do not alter needs, positions or shift hours.
	for tick in 192:
		app._tick_simulation()
		for id in ["yang_feng","gao_lang"]:
			var a: Dictionary=w.data.agents[id];var job:=SimWorkSchedule.job(a,w.rules.jobs)
			if a.activity=="sleeping":
				if SimHomeRest.arrived(w,a): slept[id]=true
				else: bad_sleep.append({"id":id,"tick":w.data.tickCount})
			if int(w.data.clock.minute)==0 and int(w.data.clock.hour)==int(job.work_hours[0]): shifts.append({"id":id,"tick":w.data.tickCount,"actual":SimCareerPresence.place(m,id),"on_time":SimCareerPresence.place(m,id)=="guardpost"})
		for frame in m.frames_per_tick():
			var before: Dictionary={}
			for id in ["yang_feng","gao_lang"]: before[id]=Vector2(m.positions[id].x,m.positions[id].y)
			m.update(w.data.agents);SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
			for id in before:
				var p: Dictionary=m.positions[id];maximum_step=maxf(maximum_step,before[id].distance_to(Vector2(p.x,p.y)))
				if SimCareerPresence.place(m,id)=="guardpost" and not p.walking and p.get("doorPhase")==null and w.data.agents[id].activity=="working": arrived[id]=true
	check(arrived.size()==2,"both real guards walk to and work at tower")
	check(slept.size()==2 and bad_sleep.is_empty(),"both guards return to own rooms to sleep")
	check(maximum_step<2,"post-construction walking never teleports")
	check(shifts.size()==4,"two full days record four actual guard shift starts")
	app.show_tab("居民",true);app.show_agenda("gao_lang");await settle()
	check(has_text(app.drawer_body,"瞭望塔值勤處") and not has_text(app.drawer_body,"先在現有廣場值勤"),"phone agenda stops advertising temporary square post")
	check("瞭望塔值勤處" in SimPlayerChat.prompt(w,"gao_lang","你在哪裡值勤？"),"chat receives real tower workplace without AI calls")
	var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"tower work reload")
	check(m.layout.work_sites.has("guardpost") and w.data.agents.gao_lang._guardShift=="night","native reload preserves site and night assignment")
	w.data.agents.yang_feng.jobKey="";SimWorkSchedule.refresh(w,m)
	check(w.data.agents.size()==count and w.data.agents.gao_lang._guardShift=="night" and SimWorkSchedule.job(w.data.agents.gao_lang,w.rules.jobs).workplace=="guardpost","single remaining guard keeps own shift at tower without replacement")
	var report:={"checks":checks,"failures":failures,"maximum_step":maximum_step,"shifts":shifts,"arrived":arrived.keys(),"slept":slept.keys(),"scope":"controlled mayor/material fixture and compressed midnight construction with original costs/work; then two full days with 480 frames/tick and unchanged needs/positions, phone agenda, prompt only, reload and single-guard roster; no climbing or indoor tower claim"}
	FileAccess.open("res://docs/WATCHTOWER_WORKPLACE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

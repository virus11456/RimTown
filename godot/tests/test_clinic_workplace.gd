extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion;var doctor: Dictionary=w.data.agents.lin_mei
	w.data.clock.hour=12;doctor.needs.hunger=80;doctor.needs.rest=80;w._update(doctor.id)
	check(doctor.activity=="waiting_workplace" and not w.data.townMap.locations.has("clinic"),"doctor waits while no clinic exists")
	var stock: Dictionary=w.data.stockpile.duplicate(true);var site: Vector2i=BuildingSites.candidates(w.data)[0]
	check(SimBuildings.start(w,"clinic_upgrade",false,site).is_empty() and equal(stock,w.data.stockpile),"traveler cannot spend public materials without mayor approval")
	for a in w.data.agents.values():
		if a.jobKey=="mayor": a.jobKey=""
	w.data.agents.player.jobKey="mayor"
	# Controlled elected-player/material fixture; production rules and work requirement are unchanged.
	for key in ["wood","cloth","silver"]: w.data.stockpile.resources[key]=100
	stock=w.data.stockpile.duplicate(true)
	var project:=SimBuildings.start(w,"clinic_upgrade",false,site)
	check(not project.is_empty() and int(project.workRequired)==14,"ward starts through real construction API with original work requirement")
	check(SimEconomy.amount(w,"wood")==85 and SimEconomy.amount(w,"cloth")==90 and SimEconomy.amount(w,"silver")==75,"original material costs charged once")
	app._refresh_building_world();SimWorkplaces.sync(w)
	check(not w.data.townMap.locations.has("clinic"),"unfinished project cannot activate workplace")
	var required: float=project.workRequired
	var activation_step:=0.0
	for day in 10:
		var before_activation:=Vector2(m.positions[doctor.id].x,m.positions[doctor.id].y)
		w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
		activation_step=maxf(activation_step,before_activation.distance_to(Vector2(m.positions[doctor.id].x,m.positions[doctor.id].y)))
		if w.data.buildings.projects.is_empty(): break
	check(activation_step<2,"construction refresh does not teleport doctor")
	check(project.status=="complete" and project.workDone>=required,"ordinary daily builder work completes the project")
	check(w.data.townMap.locations.has("clinic") and m.layout.work_sites.has("clinic"),"completion activates the clinic at the selected site")
	var zone: Dictionary=m.layout.work_sites.get("clinic",{})
	check(int(zone.get("x",-1))==site.x and int(zone.get("y",-1))==site.y+2,"work point is directly at the constructed ward entrance")
	check(not m.layout.buildings.has("clinic"),"activation does not spawn a duplicate clinic at the legacy location")
	check(not BuildingSites.allowed(w.data,Vector2i(site.x,site.y+2)),"future construction cannot occupy active entrance")
	check(not w.data.townMap.locations.has("farm") and not w.data.townMap.locations.has("guardpost"),"ward completion does not grant unrelated facilities")
	stock=w.data.stockpile.duplicate(true);var effects: Dictionary=w.data.buildings.activeEffects.duplicate(true)
	SimWorkplaces.sync(w);SimWorkplaces.sync(w)
	check(equal(stock,w.data.stockpile) and equal(effects,w.data.buildings.activeEffects),"repeated workplace sync neither charges nor duplicates building effects")
	var reached:=false;var maximum_step:=0.0;var rows: Array=[]
	w.data.clock.hour=7;w.data.clock.minute=45;doctor.needs.hunger=80;doctor.needs.rest=80
	for tick in 32:
		app._tick_simulation()
		for frame in m.frames_per_tick():
			var p: Dictionary=m.positions[doctor.id];var before:=Vector2(p.x,p.y)
			m.update(w.data.agents);SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
			maximum_step=maxf(maximum_step,before.distance_to(Vector2(p.x,p.y)))
			if SimCareerPresence.place(m,doctor.id)=="clinic" and not p.walking and p.get("doorPhase")==null: reached=true
		rows.append({"tick":w.data.tickCount,"activity":doctor.activity,"actual":SimCareerPresence.place(m,doctor.id)})
		if reached: break
	check(reached and maximum_step<2,"doctor really walks to the completed entrance without teleporting")
	check(doctor.activity!="waiting_workplace","doctor leaves missing-workplace standby after completion")
	app.show_tab("居民",true);app.show_agenda(doctor.id);await settle()
	check(has_text(app.drawer_body,"醫療病房入口") and not has_text(app.drawer_body,"工作場所尚未建成"),"phone agenda reports completed location")
	check("醫療病房入口" in SimPlayerChat.prompt(w,doctor.id,"你在哪裡上班？"),"chat prompt receives actual workplace facts without calling AI")
	var home_asleep:=false;var false_sleep:=false
	for tick in 96:
		app._tick_simulation()
		if doctor.activity=="sleeping" and not SimHomeRest.arrived(w,doctor): false_sleep=true
		for frame in m.frames_per_tick():
			var p: Dictionary=m.positions[doctor.id];var before:=Vector2(p.x,p.y)
			m.update(w.data.agents);SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
			maximum_step=maxf(maximum_step,before.distance_to(Vector2(p.x,p.y)))
		if doctor.activity=="sleeping" and SimHomeRest.arrived(w,doctor): home_asleep=true;break
	check(home_asleep and not false_sleep and maximum_step<2,"doctor walks home from new clinic and sleeps only in own room")
	var location: Dictionary=w.data.townMap.locations.clinic.duplicate(true);var pos: Dictionary=m.positions[doctor.id].duplicate(true)
	app._load_document(JSON.stringify(app.progress_snapshot()),"completed clinic reload")
	check(equal(location,w.data.townMap.locations.clinic) and m.layout.work_sites.has("clinic"),"native reload preserves completed workplace")
	check(is_equal_approx(float(pos.x),float(m.positions[doctor.id].x)) and is_equal_approx(float(pos.y),float(m.positions[doctor.id].y)),"reload retains doctor's actual position")
	var existing:=w.snapshot();var clinic: Dictionary=existing.townMap.locations.clinic.duplicate(true)
	clinic.erase("_workSite");clinic.name="原有診所";w.data.townMap.locations.clinic=clinic
	SimWorkplaces.sync(w)
	check(equal(clinic,w.data.townMap.locations.clinic),"an existing clinic is never replaced by ward entrance")
	w.data.townMap.locations.erase("clinic")
	for p2 in w.data.buildings.completed: p2.erase("siteX");p2.erase("siteY")
	SimWorkplaces.sync(w)
	check(not w.data.townMap.locations.has("clinic"),"legacy unplaced completion cannot invent a physical site")
	var report:={"checks":checks,"failures":failures,"site":[site.x,site.y],"work_done":project.workDone,"maximum_step":maximum_step,"trace":rows,"scope":"controlled elected-player and material fixture, compressed midnight construction ticks with original costs/work, then normal physical walking; actual app completion geometry, mobile agenda, AI prompt only and native reload; no full economic balance or indoor treatment claim"}
	FileAccess.open("res://docs/CLINIC_WORKPLACE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

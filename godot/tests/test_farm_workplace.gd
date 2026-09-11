extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion;var farmer: Dictionary=w.data.agents.liu_jun
	w.data.clock.hour=12;farmer.needs.hunger=80;farmer.needs.rest=80;w._update(farmer.id)
	check(farmer.activity=="waiting_workplace" and not w.data.townMap.locations.has("farm"),"farmer waits while no farm exists")
	var stock: Dictionary=w.data.stockpile.duplicate(true);var site: Vector2i=BuildingSites.candidates(w.data)[0]
	check(SimBuildings.start(w,"farm_irrigation",false,site).is_empty() and equal(stock,w.data.stockpile),"traveler cannot spend public materials without mayor approval")
	for a in w.data.agents.values():
		if a.jobKey=="mayor": a.jobKey=""
	w.data.agents.player.jobKey="mayor"
	# Controlled elected-player/material fixture; production rules and work requirement are unchanged.
	for key in ["wood","stone","tools"]: w.data.stockpile.resources[key]=100
	stock=w.data.stockpile.duplicate(true)
	var project:=SimBuildings.start(w,"farm_irrigation",false,site)
	check(not project.is_empty() and int(project.workRequired)==12,"irrigation starts through real construction API with original work requirement")
	check(SimEconomy.amount(w,"wood")==90 and SimEconomy.amount(w,"stone")==85 and SimEconomy.amount(w,"tools")==98,"original material costs charged once")
	app._refresh_building_world();SimWorkplaces.sync(w)
	check(not w.data.townMap.locations.has("farm"),"unfinished project cannot activate workplace")
	var required: float=project.workRequired
	var activation_step:=0.0
	for day in 10:
		var before_activation:=Vector2(m.positions[farmer.id].x,m.positions[farmer.id].y)
		w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation()
		activation_step=maxf(activation_step,before_activation.distance_to(Vector2(m.positions[farmer.id].x,m.positions[farmer.id].y)))
		if w.data.buildings.projects.is_empty(): break
	check(activation_step<2,"construction refresh does not teleport farmer")
	check(project.status=="complete" and project.workDone>=required,"ordinary daily builder work completes the project")
	check(w.data.townMap.locations.has("farm") and m.layout.work_sites.has("farm"),"completion activates the farm at the selected site")
	var zone: Dictionary=m.layout.work_sites.get("farm",{})
	check(int(zone.get("x",-1))==site.x and int(zone.get("y",-1))==site.y+2,"work point is directly at the constructed irrigation entrance")
	check(not m.layout.buildings.has("farm"),"activation does not spawn a duplicate farm at the legacy location")
	check(not BuildingSites.allowed(w.data,Vector2i(site.x,site.y+2)),"future construction cannot occupy active entrance")
	check(not w.data.townMap.locations.has("clinic") and not w.data.townMap.locations.has("guardpost"),"irrigation completion does not grant unrelated facilities")
	stock=w.data.stockpile.duplicate(true);var effects: Dictionary=w.data.buildings.activeEffects.duplicate(true)
	var crops: Dictionary=w.data.farm.duplicate(true)
	SimWorkplaces.sync(w);SimWorkplaces.sync(w)
	check(equal(crops,w.data.farm),"registering work point adds no plots, growth or harvest")
	check(equal(stock,w.data.stockpile) and equal(effects,w.data.buildings.activeEffects),"repeated workplace sync neither charges nor duplicates building effects")
	var with_site:=SimWorld.new();with_site.load_snapshot(w.snapshot())
	var without_site:=SimWorld.new();without_site.load_snapshot(w.snapshot());without_site.data.townMap.locations.erase("farm")
	SimEconomy.daily(with_site);SimEconomy.daily(without_site);SimFarm.daily(with_site);SimFarm.daily(without_site)
	check(equal(with_site.data.stockpile,without_site.data.stockpile) and equal(with_site.data.farm,without_site.data.farm),"same economy/crop inputs produce identical results with and without visual workplace")
	var reached:=false;var maximum_step:=0.0;var rows: Array=[]
	w.data.clock.hour=7;w.data.clock.minute=45;farmer.needs.hunger=80;farmer.needs.rest=80
	for tick in 32:
		app._tick_simulation()
		for frame in m.frames_per_tick():
			var p: Dictionary=m.positions[farmer.id];var before:=Vector2(p.x,p.y)
			m.update(w.data.agents);SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
			maximum_step=maxf(maximum_step,before.distance_to(Vector2(p.x,p.y)))
			if SimCareerPresence.place(m,farmer.id)=="farm" and not p.walking and p.get("doorPhase")==null: reached=true
		rows.append({"tick":w.data.tickCount,"activity":farmer.activity,"actual":SimCareerPresence.place(m,farmer.id)})
		if reached: break
	check(reached and maximum_step<2,"farmer really walks to the completed entrance without teleporting")
	check(farmer.activity!="waiting_workplace","farmer leaves missing-workplace standby after completion")
	app.show_tab("居民",true);app.show_agenda(farmer.id);await settle()
	check(has_text(app.drawer_body,"農田灌溉作業點") and not has_text(app.drawer_body,"工作場所尚未建成"),"phone agenda reports completed location")
	check("農田灌溉作業點" in SimPlayerChat.prompt(w,farmer.id,"你在哪裡上班？"),"chat prompt receives actual workplace facts without calling AI")
	var home_asleep:=false;var false_sleep:=false
	for tick in 96:
		app._tick_simulation()
		if farmer.activity=="sleeping" and not SimHomeRest.arrived(w,farmer): false_sleep=true
		for frame in m.frames_per_tick():
			var p: Dictionary=m.positions[farmer.id];var before:=Vector2(p.x,p.y)
			m.update(w.data.agents);SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
			maximum_step=maxf(maximum_step,before.distance_to(Vector2(p.x,p.y)))
		if farmer.activity=="sleeping" and SimHomeRest.arrived(w,farmer): home_asleep=true;break
	check(home_asleep and not false_sleep and maximum_step<2,"farmer walks home from new farm and sleeps only in own room")
	var location: Dictionary=w.data.townMap.locations.farm.duplicate(true);var pos: Dictionary=m.positions[farmer.id].duplicate(true)
	app._load_document(JSON.stringify(app.progress_snapshot()),"completed farm reload")
	check(equal(location,w.data.townMap.locations.farm) and m.layout.work_sites.has("farm"),"native reload preserves completed workplace")
	check(is_equal_approx(float(pos.x),float(m.positions[farmer.id].x)) and is_equal_approx(float(pos.y),float(m.positions[farmer.id].y)),"reload retains farmer's actual position")
	var existing:=w.snapshot();var farm: Dictionary=existing.townMap.locations.farm.duplicate(true)
	farm.erase("_workSite");farm.name="原有農場";w.data.townMap.locations.farm=farm
	SimWorkplaces.sync(w)
	check(equal(farm,w.data.townMap.locations.farm),"an existing farm is never replaced by irrigation entrance")
	w.data.townMap.locations.erase("farm")
	for p2 in w.data.buildings.completed: p2.erase("siteX");p2.erase("siteY")
	SimWorkplaces.sync(w)
	check(not w.data.townMap.locations.has("farm"),"legacy unplaced completion cannot invent a physical site")
	var report:={"checks":checks,"failures":failures,"site":[site.x,site.y],"work_done":project.workDone,"maximum_step":maximum_step,"trace":rows,"scope":"controlled elected-player and material fixture, compressed midnight construction ticks with original costs/work, then normal physical walking; actual app completion geometry, mobile agenda, AI prompt only and native reload; no full economic balance or crop-tending animation claim"}
	FileAccess.open("res://docs/FARM_WORKPLACE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

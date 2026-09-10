extends "res://tests/test_careers_expansion_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;w.data.clock.hour=12;w.data.clock.minute=0
	SimCareers.enroll(w,"doctor");var id:=SimGovernance.mayor(w);var a: Dictionary=w.data.agents[id]
	a.needs.rest=25;a.needs.hunger=90;a.currentLocation="town_hall";a._pendingHangout=null;w.runtime[id].targetLocation=null
	stand(app,"tavern");app.motion.positions[id].x=app.motion.positions.player.x;app.motion.positions[id].y=app.motion.positions.player.y
	stand(app,"town_hall");app.show_careers();await settle();var label: String="開始：照護疲憊的"+str(a.name)
	press(app.drawer_body,label);await settle();check(SimCareers.book(w).active.is_empty(),"care cannot begin before NPC visual arrival")
	app.motion.positions[id].x=app.motion.positions.player.x;app.motion.positions[id].y=app.motion.positions.player.y
	press(app.drawer_body,label);await settle();check(not SimCareers.book(w).active.is_empty(),"arrived pair starts care")
	app._tick_simulation();await settle();check(has_text(app.drawer_body,"剩餘 45 分鐘"),"countdown refreshes on real app tick")
	var xp: float=w.data.agents.player.skills["醫療"].xp
	app.motion.positions[id].x=0;app.motion.positions[id].y=0;app._tick_simulation();await settle()
	check(SimCareers.book(w).active.is_empty() and w.data.agents.player.skills["醫療"].xp==xp,"physical departure cancels before reward")
	check(has_text(app.drawer_body,"值勤已取消"),"cancel reason displayed automatically")
	app.motion.positions[id].x=app.motion.positions.player.x;app.motion.positions[id].y=app.motion.positions.player.y
	a.currentLocation="town_hall";a.needs.rest=25;a._pendingHangout=null;app.show_careers();await settle();press(app.drawer_body,label);await settle()
	for i in 4: app._tick_simulation();await settle()
	check(SimCareers.book(w).used==1 and has_text(app.drawer_body,"今日完成 1 / 3"),"actual app tick completes and refreshes count")
	check(has_text(app.drawer_body,"照護疲憊的"+str(a.name)+"完成。"),"completion feedback shown")
	# Homes are distinct venues, even within a shared residential district.
	var houses: Array=app.motion.layout.houses.keys()
	check(houses.size()>=2,"home fixture available")
	var first: Dictionary=app.motion.layout.houses[houses[0]]
	app.motion.positions.player.x=first.interiorX;app.motion.positions.player.y=first.interiorY
	app.motion.positions[id].x=first.interiorX;app.motion.positions[id].y=first.interiorY
	check(SimCareerPresence.place(app.motion,"player")==first.parentLocId,"home maps to logical district")
	check(SimCareerPresence.together(app.motion,"player",id,first.parentLocId),"same home is reachable venue")
	var second: Dictionary=app.motion.layout.houses[houses[1]];app.motion.positions[id].x=second.interiorX;app.motion.positions[id].y=second.interiorY
	check(not SimCareerPresence.together(app.motion,"player",id,first.parentLocId),"different homes cannot count as present together")
	SimCareers.enroll(w,"guard");stand(app,"quarry");app.show_careers();await settle();press(app.drawer_body,"開始：巡查"+str(w.data.townMap.locations.quarry.name));await settle()
	app.drawer.hide();app.active_tab=""
	app._tick_simulation();await settle();check(not app.drawer.visible,"background ticks do not reopen dismissed panel")
	w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation();check("午夜" in SimCareers.book(w).notice,"midnight cancellation explained")
	var report:={"checks":checks,"failures":failures,"scope":"real app ticks, physical NPC attendance at start and during work, automatic countdown/completion/cancellation, residential mapping and distinct homes, dismissed panel and midnight; configured needs/positions, not whole-game natural progression"}
	FileAccess.open("res://docs/CAREER_PRESENCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

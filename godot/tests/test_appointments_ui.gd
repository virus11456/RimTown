extends "res://tests/test_player_chat_ui.gd"
func walk_player(app: Node,target: Vector2) -> bool:
	var p: Dictionary=app.motion.positions.player
	var path: Array=app.motion.pathfinder.find_path(Vector2(p.x,p.y),target)
	if path.is_empty(): return false
	for waypoint in path:
		var goal:=Vector2(waypoint.x,waypoint.y)
		for frame in 3000:
			var delta:=goal-Vector2(p.x,p.y)
			if delta.length()<2: break
			app.motion.move_player(delta.normalized(),minf(.05,delta.length()/72.0))
			if frame==2999: return false
	return Vector2(p.x,p.y).distance_to(target)<20
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	w.data.agents.chen_wei.jobKey="" # Controlled free-day fixture for the stricter return-time check.
	app.chat_transport=mock;reply={"ok":true,"data":{"reply":"要不要明天找時間見面？\nEFFECTS: {\"affinity_change\":0,\"romantic_change\":0,\"summary\":\"想與旅人見面\",\"invitation\":true}"}}
	app.show_tab("居民",true);app.show_player_chat("chen_wei");app.send_player_chat("chen_wei","你明天有空嗎？");release_reply.emit();await settle()
	var a:=SimAppointments.current(w)
	check(a.get("state")=="offered","mock AI chat creates offered appointment")
	press(app.drawer_body,"見面約定");await settle();press(app.drawer_body,"接受邀約");await settle()
	check(a.state=="accepted" and has_text(app.drawer_body,"已接受"),"UI accepts into schedule")
	check(has_text(app.drawer_body,"慢走返家"),"card explains waiting and ordinary return allowance")
	var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"375px appointment panel fits")
	var snapshot: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(snapshot),"appointment reload");await settle();a=SimAppointments.current(w)
	check(a.state=="accepted","actual app load preserves accepted appointment")
	app.motion.manual_player=true
	var arrived:=false;var max_step:=0.0
	for tick in 200:
		app._tick_simulation()
		for frame in 120:
			var previous:=Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)
			app.motion.update(w.data.agents)
			if SimAppointments.directing(w,"chen_wei"): max_step=maxf(max_step,previous.distance_to(Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)))
			SimAppointments.observe(w,app.motion)
		if a.state=="waiting": arrived=true;break
		if not SimAppointments.LIVE.has(a.state): break
	check(arrived,"NPC physically arrives after actual clock and motion: "+str(a.reason))
	check(a.state!="met","stationary player elsewhere does not meet NPC remotely")
	if arrived:
		var archive:=SaveArchive.encode(JSON.stringify(app.progress_snapshot()))
		var path:=ProjectSettings.globalize_path("res://../../../outputs/廣場赴約前.rimtown")
		var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(archive);file.close()
		app.dialog.file_selected.emit(path);await settle();a=SimAppointments.current(w)
		check(a.state=="waiting" and SimCareerPresence.place(app.motion,"chen_wei")=="town_square","delivered archive retains NPC actual arrival")
		var target:=Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)
		check(walk_player(app,target),"player reaches NPC using movement and collision path")
		SimAppointments.observe(w,app.motion)
		check(a.state=="met","actual player and NPC proximity completes meeting")
		check(w.data.agents.player.chatHistory.back().text=="你來了！很高興我們都記得這次約定。","arrival reply enters chat history")
		var count: int=w.quest_balance.appointments.history.size();SimAppointments.observe(w,app.motion)
		check(w.quest_balance.appointments.history.size()==count,"repeated frames do not repeat meeting")
	check(max_step<=1,"NPC appointment travel never teleports: "+str(max_step))
	app.show_appointment("chen_wei");await settle()
	check(has_text(app.drawer_body,str(a.reason)),"final reason visible")
	var report:={"checks":checks,"failures":failures,"npc_max_step_pixels":max_step,"state":a,"scope":"controlled free-day NPC for return availability; mock AI response through actual chat UI, accept, app save reload, natural clock/needs/work, real SimMotion NPC path and collision-based player movement, proximity meeting, mobile panel; headless rendering, no production AI service"}
	FileAccess.open("res://docs/APPOINTMENTS_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

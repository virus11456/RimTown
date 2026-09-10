extends "res://tests/test_appointments_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	app.dialog.file_selected.emit(ProjectSettings.globalize_path("res://../../../outputs/廣場赴約前.rimtown"));await settle()
	w.quest_balance.daily_talk_enabled=false
	var a:=SimAppointments.current(w)
	check(a.state=="waiting","real existing waiting checkpoint loaded")
	check(walk_player(app,Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)),"player physically reaches original meeting")
	SimAppointments.observe(w,app.motion)
	check(a.state=="met" and a.has("resolved_tick"),"actual physical meeting creates timestamped evidence")
	# Age the real outcome with normal world ticks. Disable incidental greetings while aging.
	for tick in 96:
		app._tick_simulation()
		for frame in 120: app.motion.update(w.data.agents)
	check(int(w.data.tickCount)-int(a.resolved_tick)==96,"real game day passes before reminder")
	# Isolate the follow-up opportunity, without inventing the remembered event.
	w.event_comments.clear();w.data.clock.hour=20
	var npc: Dictionary=w.data.agents.chen_wei;npc.jobKey="";npc.activity="wandering";npc.currentLocation="town_square";npc.needs.hunger=80;npc.needs.rest=80;npc.needs.social=30
	w.data.agents.player.activity="wandering"
	for other in w.data.agents.values():
		if other.id not in ["chen_wei","player"]: other.activity="sleeping"
	for frame in 2400: app.motion.update(w.data.agents)
	check(walk_player(app,Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)),"player approaches again on later day")
	w.quest_balance.daily_talk_enabled=true;app.drawer.hide();app.active_tab="";app._process_daily_talk()
	var line: Dictionary=w.data.agents.player.chatHistory.back()
	check(line.get("_godotRecall",{}).get("state")=="met" and "碰面的事" in line.text,"local follow-up references actual previous meeting")
	app.show_tab("居民",true);press(app.drawer_body,"最近搭話："+str(npc.name));await settle()
	check(has_text(app.drawer_body,line.text),"remembered greeting visible via normal chat UI")
	var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"375px recalled greeting fits")
	var path:=ProjectSettings.globalize_path("res://../../../outputs/居民記得上次見面.rimtown")
	var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())));file.close()
	app.dialog.file_selected.emit(path);await settle()
	check(SimTalkRecall.pick(w,"chen_wei",w.quest_balance.daily_talk).is_empty(),"delivered native archive preserves consumed reminder")
	var report:={"checks":checks,"failures":failures,"scope":"actual prior waiting save, player collision movement and physical meeting, 96 natural ticks, then controlled idle scene for follow-up; normal chat UI and native archive; no invented meeting or AI service"}
	FileAccess.open("res://docs/TALK_RECALL_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

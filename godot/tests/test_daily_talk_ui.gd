extends "res://tests/test_appointments_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;w.data.clock.hour=20;w.event_comments.clear()
	for a in w.data.agents.values(): a.activity="sleeping"
	var npc: Dictionary=w.data.agents.chen_wei;npc.activity="wandering";npc.currentLocation="town_square";npc.jobKey="";npc.needs.hunger=80;npc.needs.rest=80;npc.needs.social=30
	w.data.agents.player.activity="wandering";app.motion.manual_player=true
	for i in 2400: app.motion.update(w.data.agents)
	app.drawer.hide();app.active_tab="";app._process_daily_talk()
	check(not w.quest_balance.has("daily_talk"),"far player does not receive greeting")
	check(walk_player(app,Vector2(app.motion.positions.chen_wei.x,app.motion.positions.chen_wei.y)),"player approaches through actual collision movement")
	# Draft and modal guards take precedence even when physically eligible.
	app.show_tab("居民",true);app.show_player_chat("chen_wei");app.chat_drafts.chen_wei="正在打字"
	app._process_daily_talk();check(not w.quest_balance.has("daily_talk") and app.chat_drafts.chen_wei=="正在打字","draft is not interrupted")
	app.drawer.hide();app.chat_busy=true;app._process_daily_talk();app.chat_busy=false
	check(not w.quest_balance.has("daily_talk"),"in-flight chat blocks spontaneous greeting")
	app.dialog.popup();app._process_daily_talk();app.dialog.hide()
	check(not w.quest_balance.has("daily_talk"),"file dialog blocks greeting")
	app.active_tab="";app._tick_simulation();await settle()
	check(w.quest_balance.get("daily_talk",{}).get("last_npc")=="chen_wei","near idle NPC starts local greeting")
	check(not app.drawer.visible and "向你搭話" in app.status.text,"notice does not force open drawer")
	app.show_tab("居民",true);await settle();press(app.drawer_body,"最近搭話："+str(npc.name));await settle()
	check(has_text(app.drawer_body,w.quest_balance.get("daily_talk",{}).get("last_text","MISSING")),"recent speaker entry opens real conversation")
	var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"375px local greeting fits")
	var path:=ProjectSettings.globalize_path("res://../../../outputs/居民日常搭話.rimtown")
	var f:=FileAccess.open(path,FileAccess.WRITE);f.store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())));f.close()
	app.dialog.file_selected.emit(path);await settle()
	var before: int=w.data.agents.player.chatHistory.size();app.drawer.hide();app._process_daily_talk()
	check(w.data.agents.player.chatHistory.size()==before,"native reload preserves cooldown")
	app.show_tab("設定",true);press(app.drawer_body,"日常主動搭話：開啟");await settle()
	check(not SimDailyTalk.enabled(w),"player can disable local spontaneous talk")
	var report:={"checks":checks,"failures":failures,"scope":"controlled idle NPC scene, player collision movement, actual app tick local greeting, draft/in-flight/modal guards, no forced panel, recent-speaker button, 375px view, archive and off switch; no AI service"}
	FileAccess.open("res://docs/DAILY_TALK_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

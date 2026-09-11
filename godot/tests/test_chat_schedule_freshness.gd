extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.chat_transport=mock
	var w: SimWorld=app.simulation;var initial:=w.snapshot()
	reply={"ok":true,"data":{"reply":"我的休閒安排還在，改天要不要一起見面？\nEFFECTS: {\"affinity_change\":5,\"romantic_change\":3,\"summary\":\"測試舊回覆\",\"invitation\":true}"}}
	for fault in ["cancelled","day","disabled","appointment","workplace"]:
		app._load_document(JSON.stringify(initial),"freshness fixture reload");w.quest_balance.leisure_plans_enabled=true;SimLeisurePlan.tick(w)
		app.show_tab("居民",true);app.show_player_chat("chen_wei");app.send_player_chat("chen_wei","今天的安排呢？","threaten")
		check(app.chat_busy,"request awaiting response: "+fault)
		match fault:
			"cancelled": SimLeisurePlan.finish(w,"chen_wei","cancelled","工作改變")
			"day": w.data.clock.day+=1
			"disabled": w.quest_balance.leisure_plans_enabled=false
			"appointment": SimAppointments.offer(w,"lin_mei")
			"workplace": w.data.townMap.locations.town_hall.name="改建後公所"
		var before:=w.snapshot();release_reply.emit();await settle()
		check(equal(before,w.snapshot()),"stale response cannot change history memory affinity intent quests resources or invitation: "+fault)
		check(not app.chat_busy and app.chat_drafts.get("chen_wei")=="今天的安排呢？","draft retained and busy released: "+fault)
		check(has_text(app.drawer_body,"舊回覆及效果未套用"),"retry notice visible: "+fault)
	app._load_document(JSON.stringify(initial),"freshness fixture reload");SimLeisurePlan.tick(w);app.show_player_chat("chen_wei");app.send_player_chat("chen_wei","再確認一次")
	var count:=requests;w.data.tickCount+=1
	release_reply.emit();await settle()
	check(not app.chat_busy and SimAppointments.current(w).get("state")=="offered","time passing alone with same facts accepts current reply")
	check(requests==count and not app.chat_drafts.has("chen_wei"),"one explicit retry no automatic API loop")
	var fits:=true
	for c in app.drawer_body.get_children():
		if c is Control and c.size.x>app.drawer.size.x: fits=false
	check(fits,"375px chat fits")
	var report:={"checks":checks,"failures":failures,"scope":"mock free-chat app callback, cancellation/day/settings/appointment/workplace changes, whole-world no-op including intent, draft/retry notice, stable facts accept reply, no automatic retry and phone width; no production AI"}
	FileAccess.open("res://docs/CHAT_SCHEDULE_FRESHNESS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

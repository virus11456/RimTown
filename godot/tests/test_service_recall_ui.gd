extends "res://tests/test_appointments_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.chat_transport=mock
	for scenario in [["frontier","cancelled"],["harbor","completed"],["harbor","cancelled"]]:
		var town: String=scenario[0];var state: String=scenario[1]
		app.dialog.file_selected.emit(ProjectSettings.globalize_path("res://../../../outputs/服務對話四日_"+town+".rimtown"));await settle()
		var w: SimWorld=app.simulation;var latest: Dictionary={}
		for row in w.quest_balance.service_outcomes: latest[row.npc]=row
		var choices: Array=latest.values().filter(func(row): return row.state==state and int(w.data.tickCount)-int(row.tick)<=188)
		check(not choices.is_empty(),"verified natural archive has matching latest result "+town+state)
		if choices.is_empty(): continue
		var row: Dictionary=choices.back();var id:=str(row.npc)
		w.data.tickCount+=4;w.data.clock.hour=20;w.quest_balance.daily_talk={};w.event_comments.clear()
		for a in w.data.agents.values(): a.activity="sleeping"
		var npc: Dictionary=w.data.agents[id];npc.activity="wandering";npc.jobKey="";npc.needs.hunger=80;npc.needs.rest=80;npc.needs.social=30;npc.relationships.player={"affinity":0}
		w.data.agents.player.activity="wandering"
		SimWorkSchedule.refresh(w,app.motion);SimShiftSleep.refresh(w,app.motion)
		var source:=SimServiceChat.recall(w,id,{})
		# A saved resident may still be on a road. Let the existing route finish first.
		var safe:=true
		for frame in 6000:
			if not SimCareerPresence.place(app.motion,id).is_empty() and not app.motion.positions[id].walking: break
			var previous:=Vector2(app.motion.positions[id].x,app.motion.positions[id].y)
			app.motion.update(w.data.agents)
			var next:=Vector2(app.motion.positions[id].x,app.motion.positions[id].y)
			if previous.distance_to(next)>1.001 or not app.motion.layout._walkable(next): safe=false
		check(safe and not SimCareerPresence.place(app.motion,id).is_empty(),"resident completes existing route without snapping "+town+state)
		var points: Dictionary=app.motion.positions.duplicate(true)
		check(walk_player(app,Vector2(points[id].x,points[id].y)),"collision walking reaches actual resident position "+town+state)
		check(Vector2(points[id].x,points[id].y)==Vector2(app.motion.positions[id].x,app.motion.positions[id].y),"resident never relocated for encounter "+town+state)
		app.motion.move_player(Vector2.ZERO,.016)
		var stock: Dictionary=w.data.stockpile.duplicate(true);var skills: Dictionary=w.data.agents.player.skills.duplicate(true)
		app.show_tab("居民",true);app.show_player_chat(id)
		var quiet:=w.snapshot();app._process_daily_talk();check(equal(quiet,w.snapshot()),"open conversation defers autonomous recall "+town+state)
		app.show_agenda(id);app.chat_busy=true;app._process_daily_talk();app.chat_busy=false
		check(equal(quiet,w.snapshot()),"pending free reply defers recall "+town+state)
		app.event_comment_busy=true;app._process_daily_talk();app.event_comment_busy=false
		check(equal(quiet,w.snapshot()),"pending event reply defers recall "+town+state)
		app._process_daily_talk();await settle()
		var entry: Dictionary=w.data.agents.player.chatHistory.back()
		check(entry.get("_godotRecall",{}).get("kind")=="service" and entry._godotRecall.state==state and entry._godotRecall.resolved_tick==row.tick,"app recalls the actual natural result "+town+state)
		check(equal(stock,w.data.stockpile) and equal(skills,w.data.agents.player.skills) and requests==0,"encounter has no reward or API request "+town+state)
		app.show_player_chat(id);await settle();check(has_text(app.drawer_body,"剛好碰到你") and has_text(app.drawer_body,"已經完成" if state=="completed" else "沒有完成"),"honest recollection visible in chat "+town+state)
		var fits:=true
		for c in app.drawer_body.get_children():
			if c is Control and c.size.x>app.drawer.size.x: fits=false
		check(fits,"375px recall page fits "+town+state)
		var path:=ProjectSettings.globalize_path("res://../../../outputs/回憶測試場景_"+town+"_"+state+".rimtown")
		var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())));file.close()
		app.dialog.file_selected.emit(path);await settle()
		check(SimServiceChat.recall(w,id,w.quest_balance.daily_talk).is_empty(),"native import keeps recall consumed "+town+state)
		var before:=w.snapshot();app.show_agenda(id);app._process_daily_talk()
		check(equal(before,w.snapshot()),"reload cannot replay nearby greeting "+town+state)
	var report:={"checks":checks,"failures":failures,"scope":"actual prior four-day outcome archives, frontier latest cancellation and harbor completion/cancellation; controlled awake unemployed needs/time encounter, NPC finishes its existing route without direct coordinate edits, then collision player approach; real app hook, chat/source/no rewards or API, mobile and native compressed reload; scenario archives are controlled tests, not natural new playthroughs"}
	FileAccess.open("res://docs/SERVICE_RECALL_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func seed_schedule(w: SimWorld,id: String,peer: String) -> void:
	w.event_comments.clear()
	w.quest_balance.hangout_safety_enabled=true
	var p:={"withId":peer,"location":"tavern","issued_tick":10,"not_before":20,"expires_at":100,"agenda_until":108,"tick":5}
	w.data.agents[id]._pendingHangout=p
	w.data.agents[peer]._pendingHangout=p.duplicate(true);w.data.agents[peer]._pendingHangout.withId=id
	SimHangoutVisits.depart(w,id,p)
func mutate(w: SimWorld,id: String,peer: String,fault: String) -> void:
	var r: Dictionary=SimHangoutVisits.records(w)[w.data.agents[id]._activeHangout]
	match fault:
		"cancel": SimHangoutSafety.cancel(w,id,"對方需要返家，取消同行。")
		"pause": r.paused=true;r.reason="先進食，再確認是否恢復。"
		"resume": r.paused=false;r.reason="恢復同行。"
		"arrive": r.arrived=[id]
		"reschedule": r.until+=8
		"hungry": w.data.agents[peer].needs.hunger=1
		"shelter": w.data.agents[peer]._raidShelterUntil=100
		"appointment": SimAppointments.offer(w,id)
		"workplace":
			for location in w.data.townMap.locations.values(): location.name="改建後"+str(location.name)
		"stable":
			w.data.tickCount+=1;w.data.agents[id]._pendingHangout.tick-=1
			w.data.agents[id]._pendingHangout.countdown_tick=w.data.tickCount
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	app.chat_transport=mock;app.event_comment_transport=mock
	reply={"ok":true,"data":{"reply":"舊行程仍可一起見面。\nEFFECTS: {\"affinity_change\":5,\"romantic_change\":3,\"summary\":\"舊約定\",\"invitation\":true}"}}
	for town in ["frontier","harbor"]:
		app.load_demo(town)
		var w: SimWorld=app.simulation
		var id: String="chen_wei" if town=="frontier" else "hb_achao"
		var peer: String="lin_mei" if town=="frontier" else "hb_haibo"
		var initial:=w.snapshot()
		for channel in ["free","event","heart"]:
			for fault in ["cancel","pause","resume","arrive","reschedule","hungry","shelter","appointment","workplace","stable"]:
				app._load_document(JSON.stringify(initial),"conversation fixture");seed_schedule(w,id,peer)
				if fault=="resume": SimHangoutVisits.records(w)[w.data.agents[id]._activeHangout].paused=true
				var baseline:=SimConversationSchedule.capture(w,id)
				if channel=="free":
					app.show_tab("居民",true);app.show_player_chat(id);app.send_player_chat(id,"安排還有效嗎？","threaten")
				else:
					w.event_comments_online=true;w.heart_events_online=true;app.chat_offline=false
					var item:={"npc":id,"player":"player","event":"灌溉工程完工","fallback":"很高興工程完成了。"}
					if channel=="heart": item.kind="heart";item.definition={"name":"初識之誼","icon":"♥"}
					w.event_comments.append(item);app.process_event_comment()
				check("單方 arrived 不等於碰面" in last_prompt,"structured NPC promise reaches "+town+channel+fault)
				mutate(w,id,peer,fault)
				check((baseline==SimConversationSchedule.capture(w,id))==(fault=="stable"),"detached semantic context "+town+channel+fault)
				var before:=w.snapshot();var appointment:=SimAppointments.current(w).duplicate(true);var count:=requests
				release_reply.emit();await settle()
				if fault=="stable":
					check("舊行程" in JSON.stringify(w.data.agents.player.get("chatHistory",[])),"unchanged facts accepted "+town+channel)
				elif channel=="free":
					check(equal(before,w.snapshot()),"stale free response no world effects "+town+fault)
					check(app.chat_drafts.get(id)=="安排還有效嗎？" and has_text(app.drawer_body,"舊回覆及效果未套用"),"draft and notice "+town+fault)
				else:
					check(w.data.agents.player.chatHistory.back().text=="很高興工程完成了。","safe original event fallback "+town+channel+fault)
					check(equal(appointment,SimAppointments.current(w)) and not ("舊行程" in JSON.stringify(w.data.agents.player.chatHistory)),"no stale invitation or text "+town+channel+fault)
				var after:=w.snapshot();app.process_event_comment();await settle()
				check(requests==count and not app.chat_busy and not app.event_comment_busy and equal(after,w.snapshot()),"no retry or duplicate "+town+channel+fault)
		# Native reload and town replacement must invalidate pending replies in every channel.
		for channel in ["free","event","heart"]:
			for replacement in ["reload","town"]:
				app._load_document(JSON.stringify(initial),"epoch fixture");seed_schedule(w,id,peer)
				if channel=="free": app.send_player_chat(id,"稍後回覆")
				else:
					w.event_comments_online=true;w.heart_events_online=true
					var item:={"npc":id,"player":"player","event":"工程完工","fallback":"工程完成。"}
					if channel=="heart": item.kind="heart";item.definition={"name":"初識之誼","icon":"♥"}
					w.event_comments.append(item);app.process_event_comment()
				if replacement=="reload": app._load_document(JSON.stringify(initial),"while awaiting")
				else: app.load_demo("harbor" if town=="frontier" else "frontier")
				var before:=w.snapshot();release_reply.emit();await settle()
				check(equal(before,w.snapshot()) and not app.chat_busy and not app.event_comment_busy,"epoch isolation "+town+channel+replacement)
	var report:={"checks":checks,"failures":failures,"scope":"two town fixtures; real app await callbacks with mock AI in free chat, event and heart channels; cancel/pause/resume/arrival/reschedule/peer needs/shelter/player invitation/workplace changes, stable countdown, reload and town switch; no production AI or natural motion endurance"}
	FileAccess.open("res://docs/CONVERSATION_SCHEDULE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

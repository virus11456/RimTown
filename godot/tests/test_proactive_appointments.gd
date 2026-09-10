extends "res://tests/test_player_chat_ui.gd"
func event(w: SimWorld,heart: bool,id: String="chen_wei") -> Dictionary:
	if heart:
		for npc in w.data.agents.values(): npc.relationships={}
		SimSocial.relationship(w.data.agents[id],w.data.agents.player).affinity=25
		SimHeartEvents.check_new(w)
	else: SimEventComments.enqueue(w,"小鎮的新工程完工了",[],[id])
	return w.event_comments.back()
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var initial:=w.snapshot();app.event_comment_transport=mock
	for heart in [false,true]:
		w.load_snapshot(initial);w.event_comments_online=true;w.heart_events_online=true;app.chat_offline=false
		var item:=event(w,heart);var rels: Dictionary=w.data.agents.chen_wei.relationships.duplicate(true)
		var stock: Dictionary=w.data.stockpile.duplicate(true)
		reply={"ok":true,"data":{"reply":"改天要不要在空檔見面聊聊？\nEFFECTS: {\"invitation\":true,\"affinity_change\":100,\"romantic_change\":100}"}}
		app.show_tab("居民",true);app.process_event_comment();app.process_event_comment()
		check(app.event_comment_busy and "invitation" in last_prompt,"spontaneous channel offers structured option")
		release_reply.emit();await settle()
		var a:=SimAppointments.current(w)
		check(a.get("state")=="offered" and a.npc=="chen_wei","proactive speaker creates pending invitation")
		check(equal(stock,w.data.stockpile),"proactive message cannot spend resources")
		check(w.data.agents.chen_wei.relationships.get("player",{}).get("affinity",0)==rels.get("player",{}).get("affinity",0),"extra effect fields cannot grant affinity")
		check(w.data.agents.player.chatHistory.back().speaker=="約定通知","system result separate from NPC speech")
		check(not w.data.agents.player.chatHistory.any(func(m): return "EFFECTS:" in m.text),"metadata not displayed in conversation")
		var saved:=w.snapshot()
		check(not (SimHeartEvents.apply(w,item,reply.data.reply) if heart else SimEventComments.apply(w,item,reply.data.reply)) and equal(saved,w.snapshot()),"same spontaneous event cannot apply twice")
		press(app.drawer_body,"見面約定 · 待回覆");await settle();press(app.drawer_body,"接受邀約");await settle()
		check(a.state=="accepted","list entry reaches actual accept callback")
		var snapshot: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(snapshot),"proactive invitation resume");await settle()
		check(SimAppointments.current(w).state=="accepted","proactive appointment survives app reload")
		var fits:=true
		app.show_appointment("chen_wei");await settle()
		for child in app.drawer_body.get_children():
			if child is Control and child.size.x>app.drawer.size.x: fits=false
		check(fits,"mobile proactive appointment fits")
	# A mixed-case structured header follows the same path and never appears as speech.
	w.load_snapshot(initial);var mixed:=event(w,false)
	SimEventComments.apply(w,mixed,"有空要不要見面？\neFfEcTs: {\"invitation\":true}")
	check(SimAppointments.current(w).get("state")=="offered","mixed-case metadata normalized")
	check(not w.data.agents.player.chatHistory.any(func(m): return "effects:" in str(m.text).to_lower()),"mixed-case metadata hidden")
	var playable: Dictionary=app.progress_snapshot()
	# Keep this inspection save offline so opening it does not enable background API calls.
	var ready:=SimWorld.new();ready.load_snapshot(playable);ready.event_comments_online=false;ready.heart_events_online=false
	var archive:=SaveArchive.encode(JSON.stringify(ready.snapshot()))
	var path:=ProjectSettings.globalize_path("res://../../../outputs/主動邀約待回覆.rimtown")
	var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(archive);file.close()
	app.dialog.file_selected.emit(path);await settle()
	check(SimAppointments.current(w).get("state")=="offered" and not w.event_comments_online and not w.heart_events_online,"delivered proactive card restores offline")
	# Metadata-only, invalid JSON/type and plain promises cannot schedule a meeting.
	for text in ["EFFECTS: {\"invitation\":true}","明天見。\nEFFECTS: broken", "明天見。\nEFFECTS: {\"invitation\":\"true\"}","明天見。"]:
		w.load_snapshot(initial);var item:=event(w,false)
		SimEventComments.apply(w,item,text)
		check(SimAppointments.current(w).is_empty(),"invalid or absent invitation metadata leaves no schedule")
		check(not "EFFECTS:" in w.data.agents.player.chatHistory.back().text,"bad metadata never leaks")
	# A callback arriving after an existing invitation must not replace it.
	w.load_snapshot(initial);w.event_comments_online=true;app.chat_offline=false
	var item:=event(w,false,"lin_mei");reply={"ok":true,"data":{"reply":"有空要不要見面？\nEFFECTS: {\"invitation\":true}"}}
	app.process_event_comment();SimAppointments.offer(w,"chen_wei");SimAppointments.respond(w,true)
	var active:=SimAppointments.current(w).duplicate(true);release_reply.emit();await settle()
	check(equal(active,SimAppointments.current(w)) and "已有" in w.data.agents.player.chatHistory.back().text,"late invitation cannot displace accepted plan")
	w.load_snapshot(initial);w.event_comments_online=true;item=event(w,false);app.process_event_comment();app.load_demo("harbor")
	var harbor:=w.snapshot();release_reply.emit();await settle()
	check(equal(harbor,w.snapshot()),"stale response cannot create appointment in new town")
	w.load_snapshot(initial);w.event_comments_online=true;item=event(w,false);app.process_event_comment();app.chat_offline=true;release_reply.emit();await settle()
	check(SimAppointments.current(w).is_empty() and w.data.agents.player.chatHistory.back().text==item.fallback,"switching offline discards pending AI invitation")
	var report:={"checks":checks,"failures":failures,"scope":"mock event-comment and heart-event callbacks, actual list/accept UI and reload; malformed metadata, exact-once, late conflict, town switch and offline fallback; no production AI request"}
	FileAccess.open("res://docs/PROACTIVE_APPOINTMENTS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

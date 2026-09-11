extends "res://tests/test_player_chat_ui.gd"
signal old_ready
signal new_ready
var sequence:=0
func separated(_prompt: String) -> Dictionary:
	sequence+=1
	var number:=sequence
	if number%2==1: await old_ready
	else: await new_ready
	return {"ok":true,"data":{"reply":("舊" if number%2==1 else "新")+"回覆。\nEFFECTS: {\"affinity_change\":1,\"summary\":\"交談\",\"invitation\":true}"}}
func queued(w: SimWorld,id: String,channel: String) -> void:
	w.event_comments.clear();w.event_comments_online=true;w.heart_events_online=true
	var item:={"npc":id,"player":"player","event":"既有事件","fallback":"原事件本機台詞。"}
	if channel=="heart": item.kind="heart";item.definition={"name":"初識之誼","icon":"♥"}
	w.event_comments.append(item)
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	app.chat_transport=separated;app.event_comment_transport=separated
	for town in ["frontier","harbor"]:
		app.load_demo(town);var w: SimWorld=app.simulation;var initial:=w.snapshot()
		var id:="chen_wei" if town=="frontier" else "hb_achao"
		for channel in ["free","event","heart"]:
			app._load_document(JSON.stringify(initial),"old request");sequence=0
			if channel=="free": app.send_player_chat(id,"舊草稿")
			else: queued(w,id,channel);app.process_event_comment()
			app._load_document(JSON.stringify(initial),"replacement world")
			if channel=="free": app.send_player_chat(id,"新草稿")
			else: queued(w,id,channel);app.process_event_comment()
			var before:=w.snapshot();old_ready.emit();await settle()
			check(equal(before,w.snapshot()),"old callback cannot mutate replacement "+town+channel)
			check(app.chat_busy if channel=="free" else app.event_comment_busy,"old callback cannot release new busy state "+town+channel)
			if channel=="free": check(app.chat_drafts.get(id)=="新草稿","old callback preserves new draft "+town)
			new_ready.emit();await settle()
			check(not app.chat_busy and not app.event_comment_busy and "新回覆" in JSON.stringify(w.data.agents.player.chatHistory) and not ("舊回覆" in JSON.stringify(w.data.agents.player.chatHistory)),"new callback applies alone "+town+channel)
			check(SimAppointments.current(w).get("state")=="offered","only current request can offer invitation "+town+channel)
		# Free chat may start while a background event awaits; the event must
		# recheck the invitation created by that newer free reply.
		for channel in ["event","heart"]:
			app._load_document(JSON.stringify(initial),"mixed channels");sequence=0
			queued(w,id,channel);app.process_event_comment();app.send_player_chat(id,"先回答這個")
			check(app.chat_busy and app.event_comment_busy,"both independent channels await "+town+channel)
			new_ready.emit();await settle();var appointment:=SimAppointments.current(w).duplicate(true)
			old_ready.emit();await settle()
			check(equal(appointment,SimAppointments.current(w)) and w.data.agents.player.chatHistory.back().text=="原事件本機台詞。","background rechecks newer free invitation "+town+channel)
			var after:=w.snapshot();old_ready.emit();new_ready.emit();await settle()
			check(equal(after,w.snapshot()),"resolved callbacks cannot replay "+town+channel)
	var report:={"checks":checks,"failures":failures,"scope":"two towns, separate awaited callbacks, replacement-world new free/event/heart requests, old callback cannot clear new busy/draft; concurrent background and free replies preserve newer invitation and fallback exactly once; mock AI"}
	FileAccess.open("res://docs/CHAT_REQUEST_OVERLAP_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

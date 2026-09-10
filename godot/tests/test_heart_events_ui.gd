extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	check(w.heart_events_enabled and not w.heart_events_online,"local default")
	for npc in w.data.agents.values(): npc.relationships={}
	var initial: Dictionary=w.snapshot();var rel:=SimSocial.relationship(w.data.agents.chen_wei,w.data.agents.player);rel.affinity=24
	app.chat_offline=true;app.show_tab("居民",true);app.show_player_chat("chen_wei")
	app.send_player_chat("chen_wei","你好，很高興認識你")
	check(w.event_comments.size()==1 and w.event_comments[0].definition.id=="friend","offline chat threshold callback")
	var item: Dictionary=w.event_comments[0]
	var saved: Dictionary=w.snapshot();var restored:=SimWorld.new();restored.load_snapshot(saved)
	SimHeartEvents.apply(restored,restored.event_comments[0]);app.process_event_comment()
	check(equal(w.snapshot(),restored.snapshot()),"pending save resume same speech")
	check("真心話" in app.status.text,"visible arrival notice")
	app.show_heart_events("chen_wei");await settle()
	check(has_text(app.drawer_body,"初識之誼 · 已觸發"),"milestone shown")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"mobile milestone fits")
	SimHeartEvents.check_new(w);check(w.event_comments.is_empty(),"same threshold no repeat")
	w.load_snapshot(initial);rel=SimSocial.relationship(w.data.agents.chen_wei,w.data.agents.player);rel.affinity=24
	SimPlayerChat.apply(w,"chen_wei","測試",{"text":"很高興認識你。","effects":{"affinity_change":1,"romantic_change":0,"summary":"問候"}})
	check(w.event_comments.size()==1,"online chat effects callback")
	w.heart_events_online=true;app.chat_offline=false;app.event_comment_transport=mock
	reply={"ok":true,"data":{"reply":"陳偉：謝謝你一直陪著我。"}}
	app.process_event_comment();app.process_event_comment();check(requests==1,"heart one flight")
	check("共同回憶" in last_prompt and "2–4 句" in last_prompt,"heart prompt")
	release_reply.emit();await settle()
	check(w.data.agents.player.chatHistory.back().text=="謝謝你一直陪著我。","AI heart text")
	check(w.data.agents.chen_wei.memory.back().importance==9,"important memory")
	check(w.event_comments.is_empty(),"queue drained")
	rel.affinity=55;SimHeartEvents.check_new(w);item=w.event_comments[0];reply={"ok":false,"status":429}
	app.process_event_comment();release_reply.emit();await settle()
	check(w.data.agents.player.chatHistory.back().text==item.fallback,"quota fallback")
	rel.affinity=80;SimHeartEvents.check_new(w);app.process_event_comment();app.load_demo("harbor")
	var harbor: Dictionary=w.snapshot();release_reply.emit();await settle()
	check(equal(harbor,w.snapshot()),"late heart reply rejected after town change")
	w.load_snapshot(initial);rel=SimSocial.relationship(w.data.agents.chen_wei,w.data.agents.player);rel.affinity=80;rel.romanticInterest=50
	w.data.clock.hour=23;w.data.clock.minute=45;w.tick()
	check(w.event_comments.size()==1,"daily threshold callback")
	for ev in ["friend","close","soulmate","crush"]:
		check(w.event_comments.size()==1 and w.event_comments[0].definition.id==ev,"one-at-time order "+ev)
		SimHeartEvents.apply(w,w.event_comments[0]);SimHeartEvents.check_new(w)
	check(w.event_comments.is_empty(),"all four only once")
	FileAccess.open("res://tests/heart_events/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(w.snapshot(),"",false,true))
	var after: Dictionary=w.snapshot();restored.load_snapshot(after);SimHeartEvents.check_new(restored)
	check(equal(after,restored.snapshot()),"fired state reload no repeat")
	w.load_snapshot(initial);w.data.agents.chen_wei.isDead=true;rel=SimSocial.relationship(w.data.agents.chen_wei,w.data.agents.player);rel.affinity=100
	SimHeartEvents.check_new(w);check(w.event_comments.is_empty(),"dead npc no heart")
	var report:={"checks":checks,"failures":failures,"scope":"offline and online chat callbacks, daily scanning, queue resume, milestone mobile UI, mock AI success/quota, stale town, death, four sequential events and fired reload; no production service"}
	FileAccess.open("res://docs/HEART_EVENT_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

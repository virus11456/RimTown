extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false);app.chat_transport=mock
	var raw: String=app.document.serialize()
	var w: SimWorld=app.simulation
	for key in SimPlayerInteraction.INTENTS:
		app._load_document(raw,"intent test");app.show_tab("居民",true);app.show_player_chat("chen_wei")
		var npc: Dictionary=w.data.agents.chen_wei
		var rel:=SimSocial.relationship(npc,w.data.agents.player);rel.affinity=24;rel.trust=10
		w.data.gossip=[{"about":"林美","content":"今天有人看到了流星。","spreadCount":0,"source":"鎮民","tickCreated":0,"isTrue":true}]
		var before:=w.snapshot()
		var count:=requests
		press(app.drawer_body,SimPlayerInteraction.INTENTS[key][0])
		check(requests==count+1 and app.chat_busy,key+" button sends once")
		check(SimPlayerInteraction.INTENTS[key][1] in last_prompt,key+" correct opener")
		app.send_player_chat("chen_wei","duplicate",key)
		check(requests==count+1 and equal(before,w.snapshot()),key+" pending no effects or duplicate")
		var expected:=SimWorld.new();expected.load_snapshot(before)
		SimPlayerChat.apply(expected,"chen_wei",SimPlayerInteraction.INTENTS[key][1],SimPlayerChat.parse(reply.data.reply))
		SimPlayerInteraction.apply_intent(expected.data.agents.chen_wei,expected,key)
		release_reply.emit();await settle()
		check(equal(w.snapshot(),expected.snapshot()),key+" chat then intent exactly once")
		check(has_text(app.drawer_body,"意圖效果"),key+" effect visible")
		if key=="flirt": check(rel.affinity==28 and rel.romanticInterest>=3,"flirt uses affinity after chat")
		if key=="gossip": check(has_text(app.drawer_body,"今天有人看到了流星"),"gossip visible in conversation")
		var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
		for i in 96: w.tick();restored.tick()
		check(equal(w.snapshot(),restored.snapshot()),key+" save resume")
	app.show_player_chat("chen_wei")
	reply={"ok":false,"error":"測試額度不足"}
	var before:=w.snapshot()
	app.send_player_chat("chen_wei",SimPlayerInteraction.INTENTS.threaten[1],"threaten")
	release_reply.emit();await settle()
	check(equal(before,w.snapshot()),"failed threat has no penalties or action")
	check(app.chat_drafts.chen_wei==SimPlayerInteraction.INTENTS.threaten[1],"failed intent retains text")
	reply={"ok":true,"data":{"reply":"EFFECTS: {}"}}
	app.send_player_chat("chen_wei","試試示好","flirt");release_reply.emit();await settle()
	check(equal(before,w.snapshot()),"invalid reply has no intent effects")
	reply={"ok":true,"data":{"reply":"你好。\nEFFECTS: {\"affinity_change\":0}"}}
	app.send_player_chat("chen_wei","等待時換鎮","threaten");app.load_demo("harbor")
	var harbor:=w.snapshot();release_reply.emit();await settle()
	check(equal(harbor,w.snapshot()),"stale intent cannot mutate new town")
	var report:={"checks":checks,"failures":failures,"scope":"mock API: four UI buttons, opener, chat-before-intent thresholds, duplicate/failure/invalid/stale response protection, effect display, 96-tick save resume"}
	FileAccess.open("res://docs/PLAYER_INTENTS_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)
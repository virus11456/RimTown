extends "res://tests/test_player_chat_ui.gd"
func mode_toggle(app: Node) -> CheckButton:
	for child in app.drawer_body.get_children():
		if child is CheckButton: return child
	return null
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false);app.chat_transport=mock
	var raw: String=app.document.serialize()
	var w: SimWorld=app.simulation
	app.show_tab("居民",true);app.show_player_chat("chen_wei")
	check(SimPlayerChat.job(w,w.data.agents.chen_wei).get("title")=="鎮長","real save jobKey resolves mayor")
	var prompt_context: Dictionary=JSON.parse_string(SimPlayerChat.prompt(w,"chen_wei","你好").split("\n")[1])
	check(prompt_context.npc.job=="鎮長" and prompt_context.mayor==w.data.agents.chen_wei.name,"online context includes real job and mayor")
	check(not app.chat_offline,"online default explicit")
	app.chat_drafts.chen_wei="工作如何？"
	mode_toggle(app).button_pressed=true
	check(app.chat_offline and has_text(app.drawer_body,"不連線"),"offline mode visibly selected")
	check(app.chat_drafts.chen_wei=="工作如何？","mode switch preserves draft")
	press(app.drawer_body,"傳送");await settle()
	check(requests==0 and not app.chat_busy,"offline send makes no API request")
	check(w.data.agents.player.chatHistory.size()==2,"offline creates exactly one pair")
	check(has_text(app.drawer_body,"離線台詞") and w.data.agents.player.chatHistory.back()._godotOffline,"offline provenance visible and stored")
	check(not app.chat_drafts.has("chen_wei"),"offline clears sent draft")
	FileAccess.open("res://tests/player_offline/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px offline controls fit")
	for key in SimPlayerInteraction.INTENTS:
		app._load_document(raw,"offline intent");app.show_tab("居民",true);app.show_player_chat("chen_wei")
		var expected:=SimWorld.new();expected.load_snapshot(w.snapshot())
		SimPlayerOffline.apply(expected,"chen_wei",SimPlayerInteraction.INTENTS[key][1])
		expected.data.agents.player.chatHistory.back()["_godotOffline"]=true
		SimPlayerInteraction.apply_intent(expected.data.agents.chen_wei,expected,key)
		press(app.drawer_body,SimPlayerInteraction.INTENTS[key][0]);await settle()
		check(requests==0 and equal(w.snapshot(),expected.snapshot()),key+" local reply then intent exactly once")
	var before:=w.snapshot()
	app.send_player_chat("chen_wei","  ");app.send_player_chat("chen_wei","x".repeat(1201));app.send_player_chat("player","你好")
	check(equal(before,w.snapshot()),"invalid inputs no effects")
	w.data.agents.chen_wei.isDead=true;before=w.snapshot()
	app.send_player_chat("chen_wei","你好");check(equal(before,w.snapshot()),"dead target no effects");w.data.agents.chen_wei.isDead=false
	check(SimPlayerOffline.utf16_left("a".repeat(29)+"😀",30)=="a".repeat(29),"Unicode truncation avoids half surrogate")
	mode_toggle(app).button_pressed=false
	reply={"ok":false,"error":"測試連線失敗"}
	before=w.snapshot();app.send_player_chat("chen_wei","心情如何？")
	check(mode_toggle(app).disabled,"mode locked during pending online request")
	release_reply.emit();await settle()
	check(equal(before,w.snapshot()) and has_text(app.drawer_body,"切換離線"),"online failure preserves world and offers offline")
	check(app.chat_drafts.chen_wei=="心情如何？","failure preserves message")
	mode_toggle(app).button_pressed=true
	var count:=requests;press(app.drawer_body,"傳送");await settle()
	check(requests==count and has_text(app.drawer_body,"離線交談完成"),"failed message retried locally without API")
	var saved: String=FileAccess.get_file_as_string("res://tests/player_offline/compatibility-save.json.tmp")
	app._load_document(saved,"offline resume");app.show_player_chat("chen_wei")
	check(has_text(app.drawer_body,"離線台詞"),"provenance survives load")
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 96: w.tick();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"offline all-mode save resume")
	var report:={"checks":checks,"failures":failures,"scope":"offline toggle and no HTTP, four intents, source provenance, invalid input, failure-to-offline retry, mode lock, 375px UI and 96-tick save resume; no production API"}
	FileAccess.open("res://docs/PLAYER_OFFLINE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

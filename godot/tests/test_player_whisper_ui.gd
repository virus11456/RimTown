extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false);app.chat_transport=mock
	var w: SimWorld=app.simulation
	app.show_tab("居民",true);app.show_player_interaction("chen_wei");press(app.drawer_body,"耳語")
	check(app.resident_page=="whisper" and has_text(app.drawer_body,"不連線"),"entry and local disclosure")
	app.whisper_drafts.chen_wei="林美很可靠。";app.show_player_whisper("chen_wei")
	app._tick_simulation();check(app.whisper_drafts.chen_wei=="林美很可靠。" and app.resident_page=="whisper","tick preserves draft")
	press(app.drawer_body,"留下耳語");await settle()
	check(requests==0,"whisper makes no API call")
	check(not app.whisper_drafts.has("chen_wei") and has_text(app.drawer_body,"已留下耳語"),"success feedback and draft clear")
	check(w.data.agents.chen_wei.memory.back().category=="whisper" and w.data.agents.chen_wei.memory.back().importance==8,"whisper memory persisted")
	check(w.data.playerActions.back().type=="whisper","action logged")
	check(w.data.agents.player.chatHistory.back()._godotOffline,"local provenance stored")
	var before:=w.snapshot();press(app.drawer_body,"留下耳語")
	check(equal(before,w.snapshot()),"empty resend no mutation")
	app.send_player_whisper("player","你好");app.send_player_whisper("missing","你好");app.send_player_whisper("chen_wei","x".repeat(1201))
	check(equal(before,w.snapshot()),"invalid targets and oversized input blocked")
	press(app.drawer_body,"查看耳語記憶");check(has_text(app.drawer_body,"耳語") and has_text(app.drawer_body,"林美很可靠"),"memory inspection")
	FileAccess.open("res://tests/player_whisper/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_player_whisper("chen_wei");await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px whisper layout")
	app.send_player_chat("chen_wei","你好");app.show_player_whisper("chen_wei")
	before=w.snapshot();app.send_player_whisper("chen_wei","等待中")
	check(equal(before,w.snapshot()),"pending online chat blocks whisper")
	release_reply.emit();await settle()
	var enabled:=false
	for child in app.drawer_body.get_children():
		if child is Button and child.text=="留下耳語": enabled=not child.disabled
	check(enabled,"whisper button reenabled after online reply")
	app.whisper_drafts.chen_wei="舊草稿";app.load_demo("harbor")
	check(app.whisper_drafts.is_empty(),"world load clears whisper draft")
	app._load_document(FileAccess.get_file_as_string("res://tests/player_whisper/compatibility-save.json.tmp"),"whisper resume")
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 96: w.tick();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"96-tick save resume")
	var report:={"checks":checks,"failures":failures,"scope":"whisper UI entry, no HTTP, drafts, invalid input, memory/history/provenance, pending chat and reenable, 375px layout, world load and resume"}
	FileAccess.open("res://docs/PLAYER_WHISPER_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

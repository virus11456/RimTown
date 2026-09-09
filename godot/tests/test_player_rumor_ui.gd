extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false);app.chat_transport=mock
	var w: SimWorld=app.simulation;var raw: String=app.document.serialize()
	app.show_tab("居民",true);app.show_player_interaction("chen_wei");press(app.drawer_body,"偷偷爆料")
	check(app.resident_page=="rumor","rumor entry")
	check(not SimPlayerRumor.candidates(w,"chen_wei").any(func(a): return a.id in ["player","chen_wei"]),"exclude listener and player")
	press(app.drawer_body,w.data.agents.lin_mei.name);await settle()
	check(has_text(app.drawer_body,"關於"+w.data.agents.lin_mei.name),"target selected")
	app._tick_simulation();check(app.resident_page=="rumor" and has_text(app.drawer_body,"關於"),"ticks preserve choice")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px controls fit")
	press(app.drawer_body,"誇讚他");await settle()
	check(requests==0 and has_text(app.drawer_body,"你偷偷說"),"local send and feedback")
	check(w.data.gossip.back().tone=="praise" and w.data.agents.player.chatHistory.size()==2,"gossip and history committed")
	var saved:=w.snapshot();app.send_player_rumor("chen_wei","lin_mei","diss")
	check(equal(saved,w.snapshot()),"stale second send blocked")
	FileAccess.open("res://tests/player_rumor/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(saved,"",false,true)))
	for i in 192: w.tick();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"two-day all-mode resume")
	check(SimPlayerRumor.available(w),"daily allowance resets")
	app._load_document(raw,"invalid cases")
	for args in [["player","lin_mei","praise"],["chen_wei","chen_wei","praise"],["chen_wei","missing","ship"],["chen_wei","lin_mei","invalid"]]:
		var before:=w.snapshot();var result:=SimPlayerRumor.send(w,args[0],args[1],args[2]);check(not result.ok and equal(before,w.snapshot()),"invalid request no mutation")
	for a in w.data.agents.values():
		if a.id not in ["player","chen_wei","lin_mei"]: a.isDead=true
	var before:=w.snapshot();check(not SimPlayerRumor.send(w,"chen_wei","lin_mei","ship").ok and equal(before,w.snapshot()),"no pairing candidate no RNG or daily use")
	w.data.agents.lin_mei.isDead=true;before=w.snapshot()
	check(not SimPlayerRumor.send(w,"chen_wei","lin_mei","praise").ok and equal(before,w.snapshot()),"stale dead target blocked")
	app._load_document(raw,"spread test")
	SimPlayerRumor.send(w,"chen_wei","lin_mei","diss")
	w.data.agents.chen_wei.personality.traits.append("gossip")
	var listener: Dictionary=w.data.agents.wang_li
	var spread:=SimGossip.spread(w.data.agents.chen_wei,listener,w.data,w.rng)
	check(not spread.is_empty() and int(spread.spreadCount)==2,"player rumor enters existing spread engine")
	check(listener.memory.back().category=="social" and "告訴我" in listener.memory.back().content,"spread listener remembers rumor")
	var report:={"checks":checks,"failures":failures,"scope":"UI targets and tones, no HTTP, daily guard, invalid/dead/no-partner cases, 375px layout, 192-tick resume and existing spread integration"}
	FileAccess.open("res://docs/PLAYER_RUMOR_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

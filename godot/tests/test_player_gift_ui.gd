extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false);app.chat_transport=mock
	var w: SimWorld=app.simulation;var raw: String=app.document.serialize()
	app.show_tab("居民",true);app.show_player_interaction("chen_wei");press(app.drawer_body,"送禮")
	check(app.resident_page=="gift" and has_text(app.drawer_body,"公共庫存"),"gift entry and cost disclosure")
	var start:=SimPlayerGift.stock(w,"food")
	press(app.drawer_body,"送出 · 花費 10／庫存 %d"%int(start));await settle()
	check(requests==0 and SimPlayerGift.stock(w,"food")==start-10,"local gift deducts exact stock")
	check(has_text(app.drawer_body,"今天已經送過"),"daily limit visible")
	check(w.data.agents.player.chatHistory.size()==2,"one gift message pair")
	var before:=w.snapshot();app.send_player_gift("chen_wei","food")
	check(equal(before,w.snapshot()),"duplicate no charge or effect")
	check(SimPlayerGift.available(w,"lin_mei"),"daily limit per resident")
	FileAccess.open("res://tests/player_gift/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_player_gift("chen_wei");await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px gift layout")
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 96: w.tick();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"all-mode resume")
	check(SimPlayerGift.available(w,"chen_wei"),"next day gift unlocked")
	var count: int=w.data.agents.chen_wei.thoughts.size();SimPlayerGift.send(w,"chen_wei","food")
	check(w.data.agents.chen_wei.thoughts.size()==count,"same gift refreshes existing thought")
	app._load_document(raw,"invalid cases")
	w.data.stockpile.resources.food=9.9;before=w.snapshot()
	check(not SimPlayerGift.send(w,"chen_wei","food").ok and equal(before,w.snapshot()),"insufficient fractional stock atomic")
	for args in [["player","food"],["missing","food"],["chen_wei","unknown"]]:
		check(not SimPlayerGift.send(w,args[0],args[1]).ok and equal(before,w.snapshot()),"invalid gift rejected")
	w.data.agents.chen_wei.isDead=true;before=w.snapshot()
	check(not SimPlayerGift.send(w,"chen_wei","tools").ok and equal(before,w.snapshot()),"dead target no charge")
	var report:={"checks":checks,"failures":failures,"scope":"UI cost and stock, no HTTP, duplicate/per-resident guard, invalid/dead/fractional stock, repeated thought, 375px layout and 96-tick save resume"}
	FileAccess.open("res://docs/PLAYER_GIFT_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

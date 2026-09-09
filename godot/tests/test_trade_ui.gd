extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false);var w: SimWorld=app.simulation
	app.show_tab("小鎮",true);press(app.drawer_body,"商人交易")
	check(has_text(app.drawer_body,"目前沒有商人") and w.trade_enabled,"empty merchant and default")
	w.data.trade.merchant={"name":"測試商人","specialty":"general","daysRemaining":3,"offers":[{"resource":"food","amount":10,"price":2.5,"isBuying":false},{"resource":"meals","amount":15,"price":3,"isBuying":true}]}
	app.show_trade();var food:=SimEconomy.amount(w,"food");var silver:=SimEconomy.amount(w,"silver")
	press(app.drawer_body,"買入");await settle();check(SimEconomy.amount(w,"food")==food+1 and SimEconomy.amount(w,"silver")==silver-2.5,"UI purchase exact fractional price")
	var meals:=SimEconomy.amount(w,"meals");silver=SimEconomy.amount(w,"silver")
	press(app.drawer_body,"賣出");await settle();check(SimEconomy.amount(w,"meals")==meals-1 and SimEconomy.amount(w,"silver")==silver+3,"UI sale")
	var offer: Dictionary=w.data.trade.merchant.offers[0]
	SimTrade.execute(w,0,100);var before:=w.snapshot()
	check(SimTrade.execute(w,0,1,offer).has("error") and equal(before,w.snapshot()),"stale offer cannot trade shifted index")
	for qty in [-1.0,0.0,NAN,INF]: check(SimTrade.execute(w,0,qty).has("error") and equal(before,w.snapshot()),"invalid quantity atomic")
	w.data.stockpile.resources.meals=0;before=w.snapshot()
	check(SimTrade.execute(w,0,1).has("error") and equal(before,w.snapshot()),"insufficient selling stock atomic")
	w.data.trade.merchant.offers[0].isBuying=false;w.data.stockpile.resources.silver=0;before=w.snapshot()
	check(SimTrade.execute(w,0,1).has("error") and equal(before,w.snapshot()),"insufficient silver atomic")
	w.data.trade.merchant.offers[0].price=-2;before=w.snapshot()
	check(SimTrade.execute(w,0,1).has("error") and equal(before,w.snapshot()),"negative imported price rejected")
	w.data.trade.merchant.offers[0].price=2;w.data.stockpile.resources.silver=100
	app.show_trade();await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px trade layout")
	FileAccess.open("res://tests/trade/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 960: w.tick();restored.tick()
	check(equal(w.snapshot(),restored.snapshot()),"ten-day all-mode resume")
	var report:={"checks":checks,"failures":failures,"scope":"trade UI buy/sell, fractional silver, empty merchant, invalid/insufficient/stale offer guards, 375px layout and ten-day integrated resume"}
	FileAccess.open("res://docs/TRADE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame
	app.set_process(false);var w: SimWorld=app.simulation
	app.show_tab("小鎮",true);press(app.drawer_body,"加工");check(w.processing_enabled and has_text(app.drawer_body,"工廠倉庫"),"processing entry")
	for r in w.data.stockpile.resources: w.data.stockpile.resources[r]=10000
	app.show_processing();press(app.drawer_body,"建造：麵包坊")
	check(w.data.processing.builtFactories.bakery.status=="building","UI build")
	var before:=w.snapshot();check(not SimProcessing.build(w,"bakery") and not SimProcessing.build(w,"unknown") and not SimProcessing.set_recipe(w,"bakery","bread") and equal(before,w.snapshot()),"duplicate invalid and unfinished guards atomic")
	w.data.stockpile.resources.silver=0;before=w.snapshot();check(not SimProcessing.build(w,"brewery") and equal(before,w.snapshot()),"unaffordable build atomic");w.data.stockpile.resources.silver=10000
	w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation();check(w.data.processing.builtFactories.bakery.buildProgress>0,"midnight construction")
	for i in 8: SimProcessing.daily(w)
	var f: Dictionary=w.data.processing.builtFactories.bakery
	check(f.status=="active" and f.workers.size()==1 and f.recipe=="bread","automatic staffing and recipe")
	f.productionProgress=.5;app.show_processing();press(app.drawer_body,"選用：小麥+糖→糕點")
	check(f.recipe=="pastry" and f.productionProgress==0,"UI switching resets progress")
	w.data.stockpile.resources.wheat=100;w.data.stockpile.resources.sugar=0;before=w.data.stockpile.duplicate(true);SimProcessing.daily(w)
	check(equal(before,w.data.stockpile) and f.productionProgress==0,"missing one input consumes none")
	w.data.stockpile.resources.sugar=100
	for i in 4: SimProcessing.daily(w)
	check(float(f.warehouse.get("pastry",0))>0,"produces into factory warehouse")
	app.show_processing();var amount: float=f.warehouse.pastry;var stock:=SimEconomy.amount(w,"pastry");press(app.drawer_body,"領取：糕點")
	check(f.warehouse.pastry==amount-1 and SimEconomy.amount(w,"pastry")==stock+1,"UI collect")
	var silver:=SimEconomy.amount(w,"silver");amount=f.warehouse.pastry;press(app.drawer_body,"出售：糕點 · 每件 8 銀")
	check(f.warehouse.pastry==amount-1 and SimEconomy.amount(w,"silver")==silver+8,"UI sale")
	before=w.snapshot();check(not SimProcessing.transfer(w,"bakery","pastry",NAN) and not SimProcessing.transfer(w,"bakery","pastry",INF) and not SimProcessing.transfer(w,"bakery","pastry",-2) and equal(before,w.snapshot()),"nonfinite and negative quantities atomic")
	w.data.processing.orders=[{"id":"order_test","product":"pastry","amount":2,"reward":30,"daysLeft":3,"factoryKey":"bakery","description":"需要 2 個pastry","status":"active"}]
	f.warehouse.pastry=3;app.show_processing();silver=SimEconomy.amount(w,"silver");press(app.drawer_body,"交付：order_test")
	check(f.warehouse.pastry==1 and SimEconomy.amount(w,"silver")==silver+30 and w.data.processing.orders[0].status=="completed","UI order")
	before=w.snapshot();check(not SimProcessing.fulfill(w,"order_test") and equal(before,w.snapshot()),"order once")
	var worker: String=f.workers[0];SimProcessing.build(w,"textile_mill");w.data.processing.builtFactories.textile_mill.status="active"
	check(SimProcessing.assign(w,"textile_mill",worker) and not worker in f.workers,"worker transfer removes previous assignment")
	before=w.snapshot();check(not SimProcessing.assign(w,"textile_mill","missing") and equal(before,w.snapshot()),"invalid worker atomic")
	app.show_tab("設定",true);press(app.drawer_body,"每日加工營運：開啟");before=w.data.processing.duplicate(true)
	w.data.clock.hour=23;w.data.clock.minute=45;app._tick_simulation();check(equal(before,w.data.processing),"disabled processing frozen")
	w.processing_enabled=true
	var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 960: w.tick();restored.tick()
	check(equal(w.snapshot(),restored.snapshot()),"ten-day all-system processing resume")
	FileAccess.open("res://tests/processing/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_processing();await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px processing layout")
	var report:={"checks":checks,"failures":failures,"scope":"UI construction/recipe/collect/sale/order, atomic guards, worker transfer, disabled midnight, ten-day all-system resume and mobile layout"}
	FileAccess.open("res://docs/PROCESSING_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

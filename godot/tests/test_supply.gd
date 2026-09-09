extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame
	app.set_process(false);var w: SimWorld=app.simulation
	check(w.supply_enabled,"balance enabled in playable mode")
	w.data.processing.builtFactories={};w.data.processing.orders=[]
	for r in w.data.stockpile.resources: w.data.stockpile.resources[r]=1000
	SimProcessing.build(w,"bakery");var f: Dictionary=w.data.processing.builtFactories.bakery;f.status="active";f.recipe="bread"
	w.data.stockpile.resources.bread=0;f.warehouse={"bread":24};var recipe: Dictionary=SimProcessing.rules().bakery.recipes[0]
	var wheat:=SimEconomy.amount(w,"wheat");var progress: float=f.productionProgress
	w.rng.state=987654
	SimProcessing.daily(w)
	check(SimSupply.blocked(w,recipe) and SimEconomy.amount(w,"wheat")==wheat and f.productionProgress==progress,"at cap pauses without inputs or progress")
	SimProcessing.transfer(w,"bakery","bread",24)
	check(SimSupply.blocked(w,recipe) and SimSupply.total(w,"bread")==24,"collection cannot bypass total stock cap")
	SimEconomy.consume(w,"bread",8,"test consumption");SimProcessing.daily(w)
	check(SimSupply.total(w,"bread")==24 and SimEconomy.amount(w,"wheat")==wheat-5,"consumption resumes one batch")
	w.data.processing.orders=[{"id":"test","product":"bread","amount":20,"reward":150,"daysLeft":5,"factoryKey":"bakery","description":"test","status":"active"}]
	check(not SimSupply.blocked(w,recipe) and SimSupply.target(w,"bread",8)==44,"active order adds reserve")
	w.data.processing.orders[0].status="completed";check(SimSupply.blocked(w,recipe),"completed order no longer increases target")
	f.warehouse.bread=30;var silver:=SimEconomy.amount(w,"silver")
	check(SimProcessing.transfer(w,"bakery","bread",100,true) and f.warehouse.bread==26 and SimEconomy.amount(w,"silver")==silver+16,"sale limited to four actual units")
	var before:=w.snapshot();check(not SimProcessing.transfer(w,"bakery","bread",1,true) and equal(before,w.snapshot()),"exhausted demand atomic")
	var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	check(SimSupply.remaining(restored,"bread")==0,"reload cannot reset demand")
	w.data.clock.season="夏季";w.data.clock.day=1
	check(SimSupply.remaining(w,"bread")==4,"season rollover renews demand")
	w.data.buildings.completed=[{"name":"市集"}];SimProcessing.daily(w)
	check(SimSupply.remaining(w,"bread")==2,"automatic market consumes same demand")
	SimProcessing.transfer(w,"bakery","bread",10,true);check(SimSupply.remaining(w,"bread")==0,"manual sale shares auto market limit")
	w.data.buildings.completed=[];w.data.stockpile.resources.bread=0;f.warehouse={};w.data.processing.orders=[]
	for day in 120:
		for i in 96: SimClock.tick(w.data.clock)
		SimProcessing.daily(w)
		check(SimSupply.total(w,"bread")<=84,"120-day upper bound including three orders")
	var saved:=SimWorld.new();saved.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 960: w.tick();saved.tick()
	check(equal(w.snapshot(),saved.snapshot()),"ten-day balance resume")
	app.show_processing();await settle();check(has_text(app.drawer_body,"產量控制") and has_text(app.drawer_body,"全鎮"),"UI explains reserve and demand")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"mobile supply layout")
	FileAccess.open("res://tests/processing/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	var report:={"checks":checks,"failures":failures,"scope":"reserve cap, no input waste, resume, orders, shared daily market cap, season/save persistence, 120-day bound and mobile UI"}
	FileAccess.open("res://docs/SUPPLY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

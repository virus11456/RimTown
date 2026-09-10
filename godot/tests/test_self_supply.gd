extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame
	app.set_process(false);var w: SimWorld=app.simulation
	check(w.relief_enabled and w.kitchen_crops_enabled,"existing saves retain explicit trial aid")
	app.show_tab("設定",true);press(app.drawer_body,"試玩原料補給：開啟");check(not w.relief_enabled,"UI switches to self supply")
	press(app.drawer_body,"廚房使用主食作物：開啟");check(not w.kitchen_crops_enabled,"UI protects crop stocks")
	var cook: Dictionary={}
	for a in w.data.agents.values():
		if a.jobKey=="cook": cook=a;break
	w.data.stockpile.resources.food=0;w.data.stockpile.resources.meals=0;w.data.stockpile.resources.wheat=10
	var before:=w.snapshot();check(SimEconomy.prepare_meals(w,cook,12)==0 and equal(before,w.snapshot()),"crop opt-out spends no crop")
	w.kitchen_crops_enabled=true
	for r in ["potato","rice","corn","mushroom"]: w.data.stockpile.resources[r]=0
	w.data.stockpile.resources.tea=20;w.data.stockpile.resources.herbs=20
	check(SimEconomy.prepare_meals(w,cook,12)==12 and absf(SimEconomy.amount(w,"wheat")-2)<.00001,"wheat converts with exact material cost")
	check(SimEconomy.amount(w,"tea")==20 and SimEconomy.amount(w,"herbs")==20,"nonfood crops untouched")
	w.data.stockpile.resources.food=1;w.data.stockpile.resources.meals=0;w.data.stockpile.resources.wheat=1
	check(SimEconomy.prepare_meals(w,cook,30)==3 and SimEconomy.amount(w,"food")==0 and SimEconomy.amount(w,"wheat")==0,"partial ingredients cannot create free meals")
	# Empty town test isolates absence of invisible raw refill.
	var input: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json"))
	var isolated:=SimWorld.new();isolated.load_snapshot(input);isolated.supply_enabled=true;isolated.relief_enabled=false;isolated.data.agents={};isolated.data.townMap.locations={}
	for r in isolated.data.stockpile.resources: isolated.data.stockpile.resources[r]=0
	SimEconomy.daily(isolated);check(isolated.data.stockpile.resources.values().all(func(v): return float(v)==0),"no actors/no sources means no free resources")
	isolated.relief_enabled=true;SimEconomy.daily(isolated);check(SimEconomy.amount(isolated,"wood")==40,"explicit trial aid restores raw minimum")
	# Real farming loop: only initial save stocks; no resource injections or merchant gifts.
	var scenarios: Array=[]
	for scenario in [{"crops":false,"industry":true},{"crops":true,"industry":true},{"crops":true,"industry":false}]:
		var crops_allowed: bool=scenario.crops
		isolated.load_snapshot(input);isolated.supply_enabled=true;isolated.relief_enabled=false;isolated.kitchen_crops_enabled=crops_allowed
		isolated.economy_enabled=true;isolated.industry_enabled=scenario.industry;isolated.farm_enabled=true
		SimIndustry.choose(isolated,"farming")
		var harvests:=0;var hunger:=0;var sowings:=0
		for day in 120:
			for p in isolated.data.farm.plots:
				if p.state=="ready" and SimFarm.harvest(isolated,int(p.id)): harvests+=1
				if p.state=="withered": SimFarm.clear(isolated,int(p.id))
				if p.state=="empty": SimFarm.till(isolated,int(p.id))
				if p.state=="tilled":
					for key in SimFarm.rules().crops:
						if key in ["wheat","potato","rice","corn","mushroom"] and SimFarm.plant(isolated,int(p.id),key): sowings+=1;break
				if p.state=="growing": SimFarm.water(isolated,int(p.id))
			var logs: int=isolated.data.messageLog.size()
			for i in 96: isolated.tick()
			if isolated.data.messageLog.slice(logs).any(func(e): return str(e.content).contains("挨餓")): hunger+=1
			check(not isolated.data.stockpile.history.any(func(e): return e.reason=="原料自動補給"),"120-day no automatic relief ledger")
			for r in isolated.data.stockpile.resources: check(is_finite(float(isolated.data.stockpile.resources[r])) and float(isolated.data.stockpile.resources[r])>=-.00001,"self supply finite/nonnegative")
		if not scenario.industry: check(isolated.data.stockpile.history.any(func(e): return e.resource in ["wheat","potato","rice","corn","mushroom"] and float(e.amount)<0 and str(e.reason).ends_with("的公共廚房")),"real harvested crops reach kitchen")
		check(harvests>0 and sowings>0,"actual crop lifecycle exercised")
		scenarios.append({"kitchen_crops":crops_allowed,"industry_output":scenario.industry,"harvests":harvests,"sowings":sowings,"hunger_days":hunger,"meals":SimEconomy.amount(isolated,"meals"),"silver":SimEconomy.amount(isolated,"silver")})
		var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(isolated.snapshot(),"",false,true)))
		for i in 960: isolated.tick();restored.tick()
		check(equal(isolated.snapshot(),restored.snapshot()),"self-supply settings and simulation resume")
	app.show_stockpile();await settle();check(has_text(app.drawer_body,"自給模式"),"stockpile explains source mode")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"mobile source layout")
	var report:={"checks":checks,"failures":failures,"scenarios":scenarios,"scope":"visible aid/crop controls, exact crop conversion and no creation, actual farm lifecycle over 120 days without injected raw resources, settings/resume and mobile UI; basic silver support still enabled"}
	FileAccess.open("res://docs/SELF_SUPPLY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

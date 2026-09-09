extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var input: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json"))
	var w:=SimWorld.new();w.load_snapshot(input);w.supply_enabled=true
	var cook: Dictionary={};var mayor: Dictionary={}
	for a in w.data.agents.values():
		if a.jobKey=="cook": cook=a
		if a.jobKey=="mayor": mayor=a
	w.data.agents={cook.id:cook};w.data.stockpile.resources.meals=0;w.data.stockpile.resources.food=80
	var food:=SimEconomy.amount(w,"food");SimEconomy.daily(w)
	var inputs:=0.0;var outputs:=0.0
	for entry in w.data.stockpile.history:
		if str(entry.reason).ends_with("的公共廚房"):
			if entry.resource=="food": inputs-=float(entry.amount)
			if entry.resource=="meals": outputs+=float(entry.amount)
	check(inputs>0 and absf(outputs-inputs*1.5)<.000001,"cooking conserves recipe quantities")
	check(SimEconomy.amount(w,"meals")>0,"one cook covers daily needs")
	w.data.workPolicy.meals="off";w.data.stockpile.resources.meals=20;var history: int=w.data.stockpile.history.size();SimEconomy.daily(w)
	check(not w.data.stockpile.history.slice(history).any(func(e): return str(e.reason).ends_with("的公共廚房")),"kitchen closure respected")
	w.data.workPolicy.meals="normal";cook.isDead=true;history=w.data.stockpile.history.size();SimEconomy.daily(w)
	check(not w.data.stockpile.history.slice(history).any(func(e): return str(e.reason).ends_with("的公共廚房") or e.reason=="daily consumption"),"dead cook neither cooks nor consumes")
	w.data.agents={mayor.id:mayor};w.data.stockpile.resources.silver=199.9;SimEconomy.daily(w)
	check(SimEconomy.amount(w,"silver")==200,"basic support fills exact gap")
	SimEconomy.change(w,"silver",500,"test earned income");SimEconomy.daily(w)
	check(SimEconomy.amount(w,"silver")==700,"earned money above support target retained")
	SimEconomy.consume(w,"silver",550,"test investment");SimEconomy.daily(w)
	check(SimEconomy.amount(w,"silver")>150 and SimEconomy.amount(w,"silver")<=200,"spending reopens limited support")
	# Two years of actual SimWorld ticks, including resident mood/skills and daily systems.
	var scenarios: Array=[]
	for with_industry in [false,true]:
		w.load_snapshot(input);w.supply_enabled=true;w.economy_enabled=true;w.industry_enabled=with_industry
		if with_industry: SimIndustry.choose(w,"farming")
		var min_meals:=INF;var max_silver:=0.0;var starving_days:=0
		for day in 120:
			var prior_logs: int=w.data.messageLog.size()
			for i in 96: w.tick()
			min_meals=minf(min_meals,SimEconomy.amount(w,"meals"));max_silver=maxf(max_silver,SimEconomy.amount(w,"silver"))
			if w.data.messageLog.slice(prior_logs).any(func(e): return str(e.content).contains("挨餓")): starving_days+=1
			check(SimEconomy.amount(w,"silver")<=SimEconomy.passive_target(w)+.000001,"120-day passive budget bound")
		check(starving_days==0,"120-day no hunger event")
		scenarios.append({"farming":with_industry,"min_meals":min_meals,"max_silver":max_silver,"starving_days":starving_days})
		var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
		for i in 960: w.tick();restored.tick()
		check(equal(w.snapshot(),restored.snapshot()),"food budget ten-day resume")
	var report:={"checks":checks,"failures":failures,"scenarios":scenarios,"scope":"food conversion, closed/dead kitchen, bounded passive support vs earned revenue, 120-day real ticks with/without farming, resume; no discretionary sales/purchases"}
	FileAccess.open("res://docs/FOOD_BUDGET_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

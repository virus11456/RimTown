extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var input: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json"))
	var w:=SimWorld.new();w.load_snapshot(input);w.supply_enabled=true
	var cook: Dictionary={}
	for a in w.data.agents.values():
		if a.jobKey=="cook": cook=a;break
	w.data.agents={cook.id:cook};cook.status="sick";w.data.stockpile.resources.meals=0
	var start: int=w.data.stockpile.history.size();SimEconomy.daily(w)
	check(not w.data.stockpile.history.slice(start).any(func(e): return str(e.reason).ends_with("的公共廚房")),"sick cook cannot produce")
	cook.status="normal";start=w.data.stockpile.history.size();SimEconomy.daily(w)
	check(w.data.stockpile.history.slice(start).any(func(e): return str(e.reason).ends_with("的公共廚房")),"recovered cook resumes")
	# Missing raw materials after daily relief: many tailors exhaust cloth; no free fallback output.
	w.load_snapshot(input);w.supply_enabled=true;w.data.agents={};w.runtime={}
	var tailor: Dictionary={}
	for a in input.agents.values():
		if a.jobKey=="tailor": tailor=a;break
	for i in 20:
		var a:=tailor.duplicate(true);a.id="tailor_"+str(i);a.name=a.id;a.mood=50;w.data.agents[a.id]=a;w.runtime[a.id]={"moodModifier":0.0}
	w.data.stockpile.resources.cloth=0;w.data.stockpile.resources.clothing=0;w.data.workPolicy.clothing="extra"
	start=w.data.stockpile.history.size();SimEconomy.daily(w)
	var paid_workers: Array=[];var inputs:=0.0;var zero_input_producers:=0
	for entry in w.data.stockpile.history.slice(start):
		if entry.resource=="cloth" and float(entry.amount)<0: inputs-=float(entry.amount);paid_workers.append(entry.source)
		if entry.resource=="clothing" and float(entry.amount)>0 and not entry.source in paid_workers: zero_input_producers+=1
	check(inputs<=40.00001 and zero_input_producers==0,"no free products once relief inputs exhausted")
	# Extreme imported bonuses must still produce nonzero, non-arbitrage quotations.
	w.load_snapshot(input);w.supply_enabled=true;w.data.buildings.activeEffects.trade_bonus=10
	w.data.news.activeModifiers={"buy_bonus":10,"sell_bonus":10};w.data.reputationSystem.reputation=150
	var prices: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/trade_rules.json")).prices
	for i in 100:
		SimTrade.spawn(w)
		for offer in w.data.trade.merchant.offers:
			var base:=float(prices.get(offer.resource,5))
			check(float(offer.price)>0,"positive quotes")
			check(float(offer.price)<=base*.95+.051 if offer.isBuying else float(offer.price)>=base*1.05-.051,"safe buy/sell spread")
	w.data.trade.merchant={"name":"Legacy","offers":[{"resource":"food","amount":10,"price":0,"isBuying":false}],"daysRemaining":2}
	var old:=w.snapshot();check(SimTrade.execute(w,0,1).has("error") and equal(old,w.snapshot()),"legacy zero-price quotation rejected atomically")
	# Mixed operation: farms' raw supply, factory staffing, merchants, orders and market.
	var scenarios: Array=[]
	for low_staff in [false,true]:
		w.load_snapshot(input);w.supply_enabled=true;w.economy_enabled=true;w.industry_enabled=true;w.processing_enabled=true;w.trade_enabled=true;w.farm_enabled=true
		if low_staff:
			for a in w.data.agents.values():
				if not a.get("isPlayer",false) and a.jobKey not in ["cook","farmer","trader"]: a.isDead=true
		w.data.stockpile.resources.silver=1000;SimProcessing.build(w,"bakery");SimProcessing.build(w,"brewery")
		SimIndustry.choose(w,"farming");w.data.buildings.completed=[{"name":"市集"}]
		var completed:=0;var sold:=0;var first_day_silver:=SimEconomy.amount(w,"silver")
		for day in 120:
			# Model farm harvests as explicit finite test inputs, no hidden production.
			if day%8==0: SimEconomy.change(w,"wheat",30,"測試定期收成")
			for i in 96: w.tick()
			for order in w.data.processing.orders:
				if SimProcessing.fulfill(w,order.id): completed+=1
			for key in w.data.processing.builtFactories:
				var factory: Dictionary=w.data.processing.builtFactories[key]
				for r in factory.warehouse.keys():
					if SimProcessing.transfer(w,key,r,1000,true): sold+=1
			if w.data.trade.merchant is Dictionary:
				for index in range(w.data.trade.merchant.offers.size()-1,-1,-1):
					var offer: Dictionary=w.data.trade.merchant.offers[index]
					if offer.isBuying and SimEconomy.amount(w,offer.resource)>50: SimTrade.execute(w,index,2)
			for r in w.data.stockpile.resources: check(is_finite(SimEconomy.amount(w,r)) and SimEconomy.amount(w,r)>=-.00001,"mixed nonnegative finite stocks")
			for key in w.data.processing.builtFactories:
				for r in w.data.processing.builtFactories[key].warehouse: check(float(w.data.processing.builtFactories[key].warehouse[r])>=0,"warehouse nonnegative")
		var earned:=0.0;var support:=0.0
		for entry in w.data.stockpile.history:
			if entry.resource=="silver" and float(entry.amount)>0:
				if entry.reason=="城鎮基本補助": support+=float(entry.amount)
				else: earned+=float(entry.amount)
		check(absf(SimEconomy.amount(w,"silver")-first_day_silver-earned-support)<.00001,"all silver increase explained by ledger")
		check(completed>0 and sold>0,"mixed scenario exercised sales and orders")
		scenarios.append({"low_staff":low_staff,"initial_after_build":first_day_silver,"silver":SimEconomy.amount(w,"silver"),"sale_operations":sold,"completed_orders":completed,"earned_income_in_retained_ledger":earned,"basic_support_in_retained_ledger":support})
		var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
		for i in 960: w.tick();restored.tick()
		check(equal(w.snapshot(),restored.snapshot()),"mixed 10-day resume")
	var report:={"checks":checks,"failures":failures,"scenarios":scenarios,"scope":"sick/recovered cook, exhausted raw inputs, extreme discounts, two 120-day mixed trade/factory/order/market scenarios with explicit wheat injections, nonnegative stocks and resume; not a closed economy"}
	FileAccess.open("res://docs/ECONOMY_STRESS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

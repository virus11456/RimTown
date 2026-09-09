extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var input: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json"))
	var w:=SimWorld.new();w.load_snapshot(input);w.supply_enabled=true
	for r in SimSupply.material_floor():
		if r!="silver": check(SimSupply.reserve(w,r)>=float(SimSupply.material_floor()[r]),"future construction reserve "+r)
	w.data.industry.maxIndustries=4
	for key in SimIndustry.rules().industries: SimIndustry.choose(w,key)
	for key in w.data.industry.industries: w.data.industry.industries[key].level=5
	for r in w.data.stockpile.resources:
		if r!="silver": w.data.stockpile.resources[r]=SimSupply.reserve(w,r)
	var wood:=SimEconomy.amount(w,"wood");SimIndustry.daily(w)
	check(SimEconomy.amount(w,"wood")==wood and w.data.industry.industries.lumber.dailyOutput.wood==0,"industry at cap reports zero")
	SimEconomy.consume(w,"wood",1,"test use");SimIndustry.daily(w)
	check(SimEconomy.amount(w,"wood")==wood and w.data.industry.industries.lumber.dailyOutput.wood==1,"industry fills exact gap")
	# Isolate a single crafter to verify proportional inputs and no full-stock overtime.
	var crafter: Dictionary={}
	for a in w.data.agents.values():
		if a.jobKey=="blacksmith": crafter=a;break
	w.data.agents={crafter.id:crafter};w.data.workPolicy.tools="extra"
	w.data.stockpile.resources.tools=SimSupply.reserve(w,"tools")
	var silver:=SimEconomy.amount(w,"silver");SimEconomy.daily(w)
	check(SimEconomy.amount(w,"silver")==silver,"no overtime pay at sufficient stock")
	w.data.workPolicy.tools="normal";w.data.stockpile.resources.tools=SimSupply.reserve(w,"tools")-.1
	w.data.stockpile.resources.metal=150;var metal:=SimEconomy.amount(w,"metal");SimEconomy.daily(w)
	check(SimEconomy.amount(w,"metal")<metal and SimEconomy.amount(w,"metal")>metal-1,"tiny gap uses proportional materials")
	check(SimEconomy.amount(w,"tools")<=SimSupply.reserve(w,"tools"),"resident output capped")
	# In-field commitments limit sowing; already grown crops are never confiscated.
	w.load_snapshot(input);w.supply_enabled=true;w.data.industry.maxIndustries=4;SimIndustry.choose(w,"farming");w.data.industry.industries.farming.level=5;SimFarm.daily(w)
	w.data.stockpile.resources.wheat=0;w.data.stockpile.resources.silver=1000
	SimFarm.till(w,1);check(SimFarm.plant(w,1,"wheat"),"first crop fits")
	SimFarm.till(w,2);var before:=w.snapshot();check(not SimFarm.plant(w,2,"wheat") and equal(before,w.snapshot()),"committed high-quality yield prevents overplanting atomically")
	var p:=SimFarm.plot(w,1);p.state="ready";p.fertilized=true;p.lastCrop="potato";p.waterLevel=100
	w.data.stockpile.resources.wheat=500;check(SimFarm.harvest(w,1) and SimEconomy.amount(w,"wheat")>500,"existing harvest retained above new target")
	# One year of all three daily supply sources with live dates; no player purchases/sales.
	w.load_snapshot(input);w.supply_enabled=true;w.data.industry.maxIndustries=4
	for key in SimIndustry.rules().industries: SimIndustry.choose(w,key);w.data.industry.industries[key].level=5
	for r in w.data.stockpile.resources:
		if r!="silver": w.data.stockpile.resources[r]=0
	var baseline:=SimWorld.new();baseline.load_snapshot(w.snapshot());baseline.supply_enabled=false
	var peak: Dictionary={};var balances: Array=[]
	for day in 180:
		for i in 96: SimClock.tick(w.data.clock);SimClock.tick(baseline.data.clock)
		SimEconomy.daily(w);SimIndustry.daily(w);SimFarm.daily(w)
		SimEconomy.daily(baseline);SimIndustry.daily(baseline);SimFarm.daily(baseline)
		for r in w.data.stockpile.resources:
			if r=="silver": continue
			peak[r]=maxf(float(peak.get(r,0)),SimSupply.total(w,r))
			check(SimSupply.total(w,r)<=SimSupply.reserve(w,r)+.00001,"180-day bound "+r)
		if day%30==29: balances.append({"day":day+1,"silver":SimEconomy.amount(w,"silver"),"food":SimEconomy.amount(w,"food"),"meals":SimEconomy.amount(w,"meals"),"original_silver":SimEconomy.amount(baseline,"silver"),"original_meals":SimEconomy.amount(baseline,"meals"),"original_wood":SimEconomy.amount(baseline,"wood")})
	w.economy_enabled=true;w.industry_enabled=true;w.farm_enabled=true
	var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 960: w.tick();restored.tick()
	check(equal(w.snapshot(),restored.snapshot()),"upstream ten-day resume")
	var report:={"checks":checks,"failures":failures,"peaks":peak,"monthly_balances":balances,"scope":"180-day bounded upstream stocks, construction floors, proportional inputs, no wasted overtime, crop commitments, grandfathered harvest, resume; silver audit is observational, not a complete balanced economy"}
	FileAccess.open("res://docs/UPSTREAM_SUPPLY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

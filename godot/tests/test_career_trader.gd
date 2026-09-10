extends "res://tests/test_careers.gd"
func merchant_world(selling: bool=false) -> SimWorld:
	var w:=world();w.governance_enabled=true;w.supply_enabled=true;w.quests_enabled=true;SimCareers.enroll(w,"trader");w.data.agents.player.currentLocation="general_store"
	w.data.stockpile.resources.wood=SimSupply.reserve(w,"wood") if selling else 0;w.data.stockpile.resources.silver=1000;w.data.stockpile.resources.food=200
	w.data.trade.merchant={"name":"委託商人","offers":[{"resource":"wood","amount":20,"price":2.5,"isBuying":selling}],"daysRemaining":3};return w
func _initialize() -> void:
	for selling in [false,true]:
		var w:=merchant_world(selling);var t: Dictionary=SimCareers.available(w)[0];var stock: Dictionary=w.data.stockpile.duplicate(true)
		check(t.qty==4,"daily batch four")
		check(not SimCareerTrade.request(w,t.id),"traveler requests approval")
		check(equal(stock,w.data.stockpile),"proposal has no transaction")
		SimGovernance.daily(w);check(SimCareerTrade.approved(w,t),"real mayor approves quote")
		check(not SimGovernance.execute(w,1) and SimCareers.book(w).active.is_empty(),"no remote completion through governance")
		w.data.agents.player.currentLocation="tavern";check(not SimCareers.start(w,t.id).ok,"must attend trade post")
		w.data.agents.player.currentLocation="general_store";check(SimCareers.start(w,t.id).ok,"approved onsite handover")
		var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());finish(w);finish(restored)
		check(equal(w.snapshot(),restored.snapshot()),"in-progress reload identical")
		check(SimEconomy.amount(w,"wood")==float(stock.resources.wood)+(-4 if selling else 4),"exact goods transfer")
		check(SimEconomy.amount(w,"silver")==1000+(10 if selling else -10),"exact public payment")
		check(w.data.trade.merchant.offers[0].amount==16,"merchant inventory depleted")
		check(SimCareers.book(w).used==1 and SimCareers.book(w).traded==4,"one duty and daily quantity consumed")
		check(SimCareers.available(w).is_empty(),"daily trade cap closes tasks")
		stock=w.data.stockpile.duplicate(true);finish(w);check(equal(stock,w.data.stockpile),"no duplicate settlement")
	for change in ["quote","merchant","funds","authority","demand"]:
		var w:=merchant_world();var t: Dictionary=SimCareers.available(w)[0];SimCareerTrade.request(w,t.id);SimGovernance.daily(w);SimCareers.start(w,t.id)
		match change:
			"quote": w.data.trade.merchant.offers[0].price=3
			"merchant": w.data.trade.merchant=null
			"funds": w.data.stockpile.resources.silver=0
			"authority": w.data.agents[SimGovernance.mayor(w)].jobKey="farmer"
			"demand": w.data.stockpile.resources.wood=SimSupply.reserve(w,"wood")
		var stock: Dictionary=w.data.stockpile.duplicate(true);finish(w)
		check(equal(stock,w.data.stockpile) and SimCareers.book(w).used==0,change+" cancels atomically")
	var w:=merchant_world(true);w.data.stockpile.resources.wood=SimSupply.reserve(w,"wood")*.75
	check(SimCareers.available(w).is_empty(),"keeps minimum sale reserve")
	w=merchant_world();w.data.stockpile.resources.wood=SimSupply.reserve(w,"wood")*.6
	check(SimCareers.available(w).is_empty(),"middle stock band does not trigger import")
	w=merchant_world(true);SimSupply.record_sale(w,"wood",3)
	check(SimCareers.available(w)[0].qty==1,"shares existing market demand")
	w=merchant_world(true);w.supply_enabled=false;var t: Dictionary=SimCareers.available(w)[0];SimCareerTrade.request(w,t.id);SimGovernance.daily(w);SimCareers.start(w,t.id);finish(w)
	check(SimCareers.available(w).is_empty(),"own quantity cap even with general balance off")
	SimCareers.enroll(w,"guard");SimCareers.enroll(w,"trader");check(SimCareerTrade.remaining(w)==0,"switching cannot reset volume")
	w.data.clock.day+=1;check(SimCareerTrade.remaining(w)==4,"next day volume refresh")
	var report:={"checks":checks,"failures":failures,"scope":"trader buy/sell real quote approval and public ledger, onsite timed work, save/reload, changed quote/merchant/authority/demand/funds, reserves and shared market cap"}
	FileAccess.open("res://docs/CAREER_TRADER_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

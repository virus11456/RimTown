extends "res://tests/test_player_interaction.gd"
func world() -> SimWorld:
	var w:=SimWorld.new();w.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json")));w.governance_enabled=true;return w
func advance(w: SimWorld) -> void:
	for i in 96: w.tick()
func _initialize() -> void:
	var w:=world();var site:=BuildingSites.candidates(w.data)[0];var stock: Dictionary=w.data.stockpile.duplicate(true)
	check(SimBuildings.start(w,"watchtower",false,site).is_empty(),"traveler cannot build directly")
	check(equal(stock,w.data.stockpile) and w.data.buildings.projects.is_empty(),"proposal takes no money or materials")
	SimBuildings.start(w,"watchtower",false,site);check(SimGovernance.book(w).proposals.size()==1,"duplicate proposal deduplicated")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());advance(w);advance(restored)
	check(equal(w.snapshot(),restored.snapshot()),"pending approval survives reload")
	var p: Dictionary=SimGovernance.book(w).proposals[0];check(p.status=="approved","mayor approves funded construction")
	check(SimGovernance.execute(w,int(p.id)),"approved construction executes")
	var once:=w.snapshot();check(not SimGovernance.execute(w,int(p.id)),"approval single use");check(equal(once,w.snapshot()),"replay atomic")
	check(w.data.buildings.projects.size()==1 and SimEconomy.amount(w,"wood")<float(stock.resources.wood),"approved execution charges public ledger")
	w=world();w.data.stockpile.resources.food=0;w.data.stockpile.resources.meals=0
	SimBuildings.start(w,"watchtower",false,BuildingSites.candidates(w.data)[0]);SimGovernance.daily(w)
	check(SimGovernance.book(w).proposals[0].status=="rejected","food crisis rejects nonessential construction")
	w=world();SimIndustry.choose(w,"farming");SimGovernance.daily(w);p=SimGovernance.book(w).proposals[0]
	check(p.status=="approved" and SimGovernance.execute(w,p.id),"approved industry choice")
	w=world();SimIndustry.choose(w,"farming");SimGovernance.daily(w);p=SimGovernance.book(w).proposals[0]
	var old:=SimGovernance.mayor(w);w.data.agents[old].jobKey="farmer";w.data.agents.lin_mei.jobKey="mayor"
	check(not SimGovernance.execute(w,p.id),"new mayor invalidates previous authorization")
	w=world();var m:={"name":"測試商人","offers":[{"resource":"food","amount":20,"price":2,"isBuying":false}],"daysRemaining":4};w.data.trade.merchant=m
	var result:=SimTrade.execute(w,0,5,m.offers[0]);check(not result.get("ok",false),"traveler purchase proposes only")
	SimGovernance.daily(w);p=SimGovernance.book(w).proposals[0]
	m.offers[0].price=3;check(not SimGovernance.execute(w,p.id),"changed quote cannot use old approval")
	m.offers[0].price=2;check(SimGovernance.execute(w,p.id),"exact approved quote succeeds")
	w=world();old=SimGovernance.mayor(w);w.data.agents[old].jobKey="farmer";w.data.agents.player.jobKey="mayor"
	check(not SimBuildings.start(w,"watchtower",false,BuildingSites.candidates(w.data)[0]).is_empty(),"elected player directly decides")
	check(not w.quest_balance.has("governance"),"mayor needs no proposal")
	w=world();var residents: Array=w.data.agents.keys().filter(func(id): return id!="player")
	var romantic: float=w.data.agents[residents[0]].relationships.get("player",{}).get("romanticInterest",0)
	check(SimPlayerGift.send(w,residents[0],"food").ok,"first public welfare visit")
	check(SimPlayerGift.send(w,residents[1],"food").ok,"second public welfare visit")
	once=w.snapshot();check(not SimPlayerGift.send(w,residents[2],"food").ok,"townwide daily limit");check(equal(once,w.snapshot()),"excess visit no mutation")
	restored=SimWorld.new();restored.load_snapshot(w.snapshot());check(SimGovernance.gift_remaining(restored)==0,"welfare budget persists")
	check(float(w.data.agents[residents[0]].relationships.player.romanticInterest)==romantic,"public gifts do not buy romance")
	advance(w);check(SimGovernance.gift_remaining(w)==2,"next day budget resets")
	once=w.snapshot();check(not SimPlayerGift.send(w,residents[2],"silver").ok,"no public cash gift");check(equal(once,w.snapshot()),"cash rejection atomic")
	check(not w.data.has("wallet") and not w.data.agents.player.has("wallet"),"no personal wallet")
	w=world();SimIndustry.choose(w,"farming");SimGovernance.daily(w);p=SimGovernance.book(w).proposals[0]
	for i in 4: advance(w)
	check(p.status=="expired" and not SimGovernance.execute(w,p.id),"authorization expires without spending")
	w=world();SimIndustry.choose(w,"farming");SimGovernance.cancel(w,1);SimGovernance.daily(w)
	check(SimGovernance.book(w).proposals[0].status=="cancelled" and not SimGovernance.execute(w,1),"withdrawn proposal cannot execute")
	w=world();old=SimGovernance.mayor(w);w.data.agents[old].jobKey="farmer";SimIndustry.choose(w,"farming");SimGovernance.daily(w)
	check(SimGovernance.book(w).proposals[0].status=="pending","no mayor cannot self authorize")
	w=world()
	for key in ["farming","lumber","mining","quarry"]: SimIndustry.choose(w,key)
	check(SimGovernance.book(w).proposals.size()==3,"bounded proposal queue")
	check("只能提案的旅人" in SimPlayerChat.prompt(w,"lin_mei","我想蓋酒館"),"AI context respects public authority")
	w=world();w.data.stockpile.resources.food=80;w.data.stockpile.resources.meals=0
	w.data.trade.merchant={"name":"糧商","offers":[{"resource":"food","amount":80,"price":2,"isBuying":true}],"daysRemaining":4}
	SimTrade.execute(w,0,80);SimGovernance.daily(w)
	check(SimGovernance.book(w).proposals[0].status=="rejected","mayor prevents sale of food reserve")
	w=world();w.data.processing.builtFactories.test_factory={"workers":["lin_mei"]}
	check(not SimProcessing.remove_worker(w,"lin_mei") and w.data.processing.builtFactories.test_factory.workers.size()==1,"traveler cannot directly remove staff")
	SimGovernance.daily(w);check(SimGovernance.execute(w,1) and w.data.processing.builtFactories.test_factory.workers.is_empty(),"approved staffing change executes")
	FileAccess.open("res://tests/governance-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(w.snapshot()))
	var report:={"checks":checks,"failures":failures,"scope":"public construction and purchase authorization, actual daily mayor review, food priority, proposal/quote/mayor binding, single execution, player-mayor direct control, public welfare cap and reload; no personal wallet"}
	FileAccess.open("res://docs/GOVERNANCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

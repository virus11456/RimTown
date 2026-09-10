extends "res://tests/test_player_interaction.gd"
func world() -> SimWorld:
	var w:=SimWorld.new();w.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json")));return w
func finish(w: SimWorld) -> void:
	w.data.tickCount+=4;SimCareers.tick(w)
func _initialize() -> void:
	var w:=world();var stock: Dictionary=w.data.stockpile.duplicate(true)
	check(SimCareers.enroll(w,"guard").ok,"guard registration")
	check(not SimCareers.start(w,"patrol:quarry").ok,"must physically attend")
	for loc in SimCareers.PATROL:
		w.data.agents.player.currentLocation=loc
		check(SimCareers.start(w,"patrol:"+loc).ok,"distinct patrol starts")
		var n: int=SimCareers.book(w).used;SimCareers.tick(w);check(SimCareers.book(w).used==n,"no instant reward")
		finish(w)
	check(SimCareers.defense_bonus(w)==2,"completed route strengthens defense")
	check(SimCareers.book(w).completed==3 and SimCareers.available(w).is_empty(),"route not repeatable")
	check(equal(stock,w.data.stockpile),"patrol creates no currency or resources")
	SimCareers.enroll(w,"doctor");w.data.agents.lin_mei.needs.rest=10;w.data.agents.lin_mei.currentLocation="quarry"
	check(not SimCareers.start(w,"care:lin_mei").ok,"switching jobs cannot reset daily budget")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());check(SimCareers.book(restored).used==3,"budget survives reload")
	w=world();SimCareers.enroll(w,"farmer");w.data.agents.player.currentLocation="meadow"
	w.data.farm.plots=[{"id":1,"state":"growing","waterLevel":50}]
	check(SimCareers.start(w,"water:1").ok,"existing dry crop request")
	restored=SimWorld.new();restored.load_snapshot(w.snapshot());finish(w);finish(restored)
	check(equal(w.snapshot(),restored.snapshot()),"in-progress task reload deterministic")
	check(w.data.farm.plots[0].waterLevel==80 and SimCareers.available(w).is_empty(),"watering changes crop and ends demand")
	check(w.data.agents.player.skills["種植"].xp==78,"actual work grants bounded skill xp")
	w.data.farm.plots[0].waterLevel=50;SimCareers.start(w,"water:1");w.data.agents.player.currentLocation="tavern";finish(w)
	check(w.data.farm.plots[0].waterLevel==50 and SimCareers.book(w).used==1,"leaving cancels with no reward")
	w=world();SimCareers.enroll(w,"doctor");w.data.agents.player.currentLocation="town_square";w.data.agents.lin_mei.currentLocation="town_square";w.data.agents.lin_mei.needs.rest=20
	check(SimCareers.start(w,"care:lin_mei").ok,"care at resident location")
	w.data.agents.lin_mei.currentLocation="tavern";finish(w);check(w.data.agents.lin_mei.needs.rest==20,"departed patient cannot be remotely treated")
	w.data.agents.lin_mei.currentLocation="town_square";SimCareers.start(w,"care:lin_mei");finish(w)
	check(w.data.agents.lin_mei.needs.rest==35,"care restores real need")
	check(not SimCareers.start(w,"care:lin_mei").ok,"same resident once daily")
	var old:=SimGovernance.mayor(w);w.data.agents[old].jobKey="farmer";w.data.agents.player.jobKey="mayor"
	check(not SimCareers.enroll(w,"guard").ok and SimGovernance.direct(w),"mayor preserves direct powers")
	w=world();w.raids_enabled=true;w.quests_enabled=true
	check(SimRaids.warn(w),"raid warning created")
	stock=w.data.stockpile.duplicate(true);var id: int=SimRaids.book(w).pending.id
	check(equal(stock,w.data.stockpile),"warning no upfront loss")
	old=SimGovernance.mayor(w);w.data.agents[old].jobKey="farmer";w.data.agents.player.jobKey="mayor"
	var r:=SimRaids.decide(w,id,"evacuate");check(r.ok and r.result.choice=="evacuate","player mayor chooses even when NPC recommends otherwise")
	check(not SimRaids.decide(w,id,"evacuate").ok,"raid resolves once")
	check(SimEconomy.amount(w,"food")<float(stock.resources.food),"evacuation real public loss")
	var report:={"checks":checks,"failures":failures,"scope":"three player jobs, attendance/time/reload/demand/shared cap, no new stock or wallet, direct mayor raid decision"}
	FileAccess.open("res://docs/CAREER_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

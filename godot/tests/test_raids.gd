extends "res://tests/test_player_interaction.gd"
func world() -> SimWorld:
	var w:=SimWorld.new();w.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json")));w.raids_enabled=true;w.quests_enabled=true;return w
func _initialize() -> void:
	var w:=world();SimRaids.warn(w);var b:=SimRaids.book(w);var saved:=w.snapshot();check(not SimRaids.warn(w),"single pending warning")
	var r:=SimRaids.decide(w,b.pending.id,"evacuate");check(r.ok and r.result.choice==SimRaids.recommendation(w,{"threat_level":r.result.threat}),"traveler follows mayor review")
	var restored:=SimWorld.new();restored.load_snapshot(saved);r=SimRaids.decide(restored,SimRaids.book(restored).pending.id,"evacuate");check(equal(w.snapshot(),restored.snapshot()),"decision reload deterministic")
	w=world();SimRaids.warn(w);b=SimRaids.book(w)
	for a in w.data.agents.values():
		if a.jobKey=="guard": a.jobKey="farmer"
	w.data.buildings.activeEffects={};b.pending.threat_level=4
	var old:=SimGovernance.mayor(w);w.data.agents[old].jobKey="farmer";w.data.agents.player.jobKey="mayor"
	r=SimRaids.decide(w,b.pending.id,"defend");check(r.ok and not r.result.victory,"unguarded high threat fails")
	check(w.data.agents.lin_mei.has("_raidShelterUntil") and not SimProcessing.can_work(w.data.agents.lin_mei),"shelter suppresses workforce")
	w.raids_enabled=false
	for i in 96: w.tick()
	check(not w.data.agents.lin_mei.has("_raidShelterUntil"),"shelter expires even when raids disabled")
	w=world();SimRaids.warn(w);b=SimRaids.book(w);old=SimGovernance.mayor(w);w.data.agents[old].jobKey="farmer";w.data.agents.player.jobKey="mayor";w.data.stockpile.resources.silver=0
	saved=w.snapshot();check(not SimRaids.decide(w,b.pending.id,"negotiate").ok and equal(saved,w.snapshot()),"unfunded negotiation atomic")
	w.data.stockpile.resources.silver=1000;var cost: float=b.pending.threat_level*15;r=SimRaids.decide(w,b.pending.id,"negotiate")
	check(r.ok and SimEconomy.amount(w,"silver")==1000-cost and not r.result.victory,"negotiation spends once without victory")
	w=world();SimRaids.warn(w)
	for i in 192: w.tick()
	check(SimRaids.book(w).pending.is_empty() and SimRaids.book(w).history.size()==1,"deadline resolves unattended and cooldown prevents repeat")
	var report:={"checks":checks,"failures":failures,"scope":"NPC authority, reload, failure/shelter/workforce recovery, budget atomicity, negotiation, automatic deadline"}
	FileAccess.open("res://docs/RAID_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

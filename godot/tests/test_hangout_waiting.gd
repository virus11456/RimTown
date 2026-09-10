extends "res://tests/test_hangout_visits.gd"
func _initialize() -> void:
	var w:=fixture();var token:=depart_pair(w);var r: Dictionary=SimHangoutVisits.records(w)[token]
	var deadline:=int(r.until)
	var stock: Dictionary=w.data.stockpile.duplicate(true)
	w.data.agents.lin_mei.needs.hunger=0;SimHangoutVisits.tick(w)
	check(r.get("paused",false) and r.pause_until==int(w.data.tickCount)+4,"urgent need pauses at most one hour")
	check(not SimHangoutVisits.directing(w,"chen_wei") and not w.data.agents.chen_wei.has("_hangoutDestination"),"both free to handle normal needs while paused")
	var layout:=TownLayout.new();layout.rebuild(w.data);var m:=SimMotion.new();m.configure(layout);m.update(w.data.agents)
	var center:=layout._nearest(layout._center("park"))
	for id in r.people: m.positions[id].x=center.x;m.positions[id].y=center.y
	SimHangoutVisits.observe(w,m);check(r.state=="traveling","even close pair cannot complete while paused")
	var resumed:=SimWorld.new();resumed.load_snapshot(w.snapshot());w=resumed;r=SimHangoutVisits.records(w)[token]
	check(r.paused and r.pause_used,"pause budget survives snapshot reload")
	w.data.tickCount+=1;w.data.agents.lin_mei.needs.hunger=80
	for id in r.people: w.data.agents[id].activity="wandering";w.data.agents[id].currentLocation="tavern"
	SimHangoutVisits.tick(w)
	check(not r.paused and r.until==deadline and SimHangoutVisits.directing(w,"chen_wei"),"both recover and resume original destination without extending deadline")
	check(w.data.agents.lin_mei.currentLocation=="park" and equal(stock,w.data.stockpile),"resume changes intended destination without goods")
	w.data.agents.lin_mei.needs.hunger=0;SimHangoutVisits.tick(w)
	check(r.state=="cancelled","second interruption cannot create endless retries")
	w=fixture();token=depart_pair(w);r=SimHangoutVisits.records(w)[token]
	w.data.agents.lin_mei.needs.rest=0;SimHangoutVisits.tick(w);w.data.tickCount=r.pause_until;SimHangoutVisits.tick(w)
	check(r.state=="cancelled" and not w.data.agents.chen_wei.has("_activeHangout"),"unrecovered pause expires and releases pair")
	w=fixture();token=depart_pair(w);r=SimHangoutVisits.records(w)[token]
	w.data.agents.lin_mei.needs.hunger=0;SimHangoutVisits.tick(w);w.data.agents.chen_wei.jobKey="priest";SimHangoutVisits.tick(w)
	check(r.state=="cancelled","work cancels even while paused")
	w=fixture();token=depart_pair(w);r=SimHangoutVisits.records(w)[token]
	m=SimMotion.new();m.configure(layout);m.update(w.data.agents)
	m.positions.chen_wei.x=center.x;m.positions.chen_wei.y=center.y;m.positions.lin_mei.x=0;m.positions.lin_mei.y=0
	SimHangoutVisits.observe(w,m)
	check(w.quest_balance.hangout_status.chen_wei.state=="waiting" and r.state=="traveling","actual first arrival gets waiting status without completing")
	for i in range(3):
		w.tick()
		check(r.state=="traveling" and w.data.agents.chen_wei.currentLocation=="park" and w.data.agents.lin_mei.currentLocation=="park","normal world tick preserves both routes %d"%i)
	w.data.tickCount=r.until;SimHangoutVisits.tick(w)
	check(r.state=="missed","waiting cannot extend final deadline")
	w=fixture();token=depart_pair(w);r=SimHangoutVisits.records(w)[token]
	w.data.agents.lin_mei.needs.hunger=0
	for i in range(4): w.tick()
	check(r.state=="traveling" and not r.get("paused",true) and float(w.data.agents.lin_mei.needs.hunger)>=15,"normal needs decay and activity recover without manually restoring hunger")
	var report:={"checks":checks,"failures":failures,"scope":"controlled pair, normal world tick route retention, actual first-arrival observation, one bounded needs pause and recovery, work priority, immutable deadline and snapshot persistence; no production AI"}
	FileAccess.open("res://docs/HANGOUT_WAITING_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

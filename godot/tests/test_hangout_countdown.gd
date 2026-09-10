extends "res://tests/test_hangout_safety.gd"
func _initialize() -> void:
	var w:=fixture()
	for id in ["chen_wei","lin_mei"]: w.data.agents[id]._pendingHangout.tick=3;w.data.agents[id]._locationStayRemaining=99
	SimHangoutSafety.tick(w);check(w.data.agents.chen_wei._pendingHangout.tick==3,"creation tick does not consume delay")
	w.data.tickCount+=1;SimHangoutSafety.tick(w)
	check(w.data.agents.chen_wei._pendingHangout.tick==2 and w.data.agents.lin_mei._pendingHangout.tick==2,"both free residents count once despite long location stay")
	SimHangoutSafety.tick(w);check(w.data.agents.chen_wei._pendingHangout.tick==2,"same-tick retry cannot count twice")
	var a: Dictionary=w.data.agents.chen_wei;var run:={"targetLocation":a.currentLocation}
	SimHangoutSafety.route(w,a,run);SimHangoutSafety.route(w,a,run)
	check(a._pendingHangout.tick==2,"route queries cannot consume time")
	w.data.agents.lin_mei.activity="eating";w.data.tickCount+=1;SimHangoutSafety.tick(w)
	check(a._pendingHangout.tick==2 and w.data.agents.lin_mei._pendingHangout.tick==2,"both timers pause when either is unavailable")
	w.data.agents.lin_mei.activity="wandering"
	var resumed:=SimWorld.new();resumed.load_snapshot(w.snapshot());w=resumed
	SimHangoutSafety.tick(w);check(w.data.agents.chen_wei._pendingHangout.tick==2,"reload in same tick cannot consume delay again")
	for i in 2: w.data.tickCount+=1;SimHangoutSafety.tick(w)
	check(w.data.agents.chen_wei._pendingHangout.tick==0,"available time eventually reaches zero")
	for id in ["chen_wei","lin_mei"]: w._update(id)
	check(w.data.agents.chen_wei._pendingHangout==null and w.data.agents.lin_mei._pendingHangout==null,"normal agent update departs without waiting for location-stay expiry")
	var records:=SimHangoutVisits.records(w)
	check(records.size()==1 and records.values()[0].departed.size()==2 and records.values()[0].state=="traveling","both departed still not a completed encounter")
	var report:={"checks":checks,"failures":failures,"scope":"controlled healthy pair, long location stay, same-tick and route idempotence, unavailable peer, save reload, normal agent update departure; no physical completion claim"}
	FileAccess.open("res://docs/HANGOUT_COUNTDOWN_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
	m.stable_routes=true;m.tick_seconds=8;w.data.clock.hour=15;w.data.clock.minute=0;w.quest_balance.hangout_safety_enabled=true
	var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents.lin_mei
	for resident in [a,b]:
		resident.jobKey="carpenter";resident.personality.traits=[];resident.activity="working";resident.currentLocation="park"
		var point:=m.layout._nearest(m.layout._center("park"));m.positions[resident.id].x=point.x;m.positions[resident.id].y=point.y
	w.social.observe_positions(m)
	var before:=w.snapshot();var positions:=m.positions.duplicate(true);var rng_state:=w.rng.state
	check(SimHangoutRoute.feasible(m,a,b,w.data.clock,w.rules.jobs,["park"]).is_empty(),"working pair cannot immediately leave")
	var p:=SimHangoutRoute.plan(m,a,b,w.data.clock,w.rules.jobs,["park"])
	check(not p.is_empty() and p.wait_ticks==4,"next shared free slot is after the shift at 16:00")
	check(equal(before,w.snapshot()) and equal(positions,m.positions) and rng_state==w.rng.state,"future search has no world, motion or RNG effects")
	var late: Dictionary=w.data.clock.duplicate();late.hour=23
	check(SimHangoutRoute.plan(m,a,b,late,w.rules.jobs,["park"]).is_empty(),"no invitation spanning sleep to a distant next-day slot")
	check(SimHangoutRoute.plan(m,a,b,w.data.clock,w.rules.jobs,["absent"]).is_empty(),"missing venue cannot be scheduled")
	for attempt in 100:
		w.data.tickCount+=8;SimSocial.relationship(a,b).affinity=70
		w.social.try_interaction(a,w.data,w.rng,w.rules.jobs)
		if a.get("_pendingHangout") is Dictionary: break
	check(a.get("_pendingHangout") is Dictionary,"actual social generator can reserve a later free slot")
	if a.get("_pendingHangout") is Dictionary:
		var pending: Dictionary=a._pendingHangout;var issue:=int(pending.issued_tick);var delay:=int(pending.tick)
		check(pending.not_before==issue+4 and pending.expires_at==issue+16,"new slot leaves original departure deadline unchanged")
		check(b._pendingHangout.not_before==pending.not_before,"both residents share reserved start")
		for resident in [a,b]: resident.activity="wandering";resident.jobKey=""
		w.data.tickCount=issue+1;SimHangoutSafety.tick(w)
		check(pending.tick==delay,"early free time does not consume future countdown")
		pending.tick=0
		var run:={"targetLocation":"tavern"};SimHangoutSafety.route(w,a,run)
		check(run.targetLocation=="tavern" and a._pendingHangout!=null,"even zero countdown cannot depart before reserved start")
		pending.tick=delay
		var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());w=restored;a=w.data.agents.chen_wei;b=w.data.agents.lin_mei;pending=a._pendingHangout
		check(pending.not_before==issue+4,"reserved start survives save reload")
		w.data.tickCount=issue+4;SimHangoutSafety.tick(w)
		check(pending.tick==delay-1 and b._pendingHangout.tick==delay-1,"shared countdown begins at reserved start")
		SimHangoutSafety.tick(w);check(pending.tick==delay-1,"same-tick retry remains idempotent")
		w.data.tickCount=issue+16;SimHangoutSafety.tick(w)
		check(a._pendingHangout==null and b._pendingHangout==null,"future reservation still expires for both at original deadline")
	var report:={"checks":checks,"failures":failures,"scope":"controlled close coworkers with boosted affinity; real route planner and social generator, future start guards, paired countdown, save reload, unextended expiry, absent venue and sleep rejection; not natural encounter proof"}
	FileAccess.open("res://docs/DEFERRED_HANGOUT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

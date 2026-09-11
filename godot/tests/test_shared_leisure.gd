extends "res://tests/test_daily_talk.gd"
func shared_fixture() -> Dictionary:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
	m.stable_routes=true;m.tick_seconds=8;w.data.clock.hour=12;w.data.clock.minute=0
	w.quest_balance.hangout_safety_enabled=true;w.quest_balance.leisure_plans_enabled=true;w.quest_balance.leisure_plans={}
	var now:=int(w.data.tickCount)
	for id in ["chen_wei","lin_mei"]:
		var a: Dictionary=w.data.agents[id];a.activity="planned_leisure";a.currentLocation="park";a.personality.traits=["night_owl"];a.needs.recreation=30
		w.quest_balance.leisure_plans[id]={"day":"fixture","place":"park","hour":12,"due":now,"until":now+8,"state":"scheduled","reason":"fixture","dwell":0}
		var point:=m.layout._nearest(m.layout._center("park"));m.positions[id].x=point.x;m.positions[id].y=point.y;m.positions[id].walking=false;m.positions[id].doorPhase=null
	w.social.observe_positions(m)
	var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents.lin_mei
	var schedule:=SimSharedLeisure.plan(w,m,a,b,["park"])
	for pair in [[a,b],[b,a]]:
		pair[0]._pendingHangout={"location":"park","activity":"socializing","tick":0,"withId":pair[1].id,"issued_tick":now,"expires_at":now+16,"not_before":now+int(schedule.get("wait_ticks",0)),"shared_leisure":schedule.get("shared_leisure",{})}
	return f
func _initialize() -> void:
	var f:=shared_fixture();var w: SimWorld=f.w;var m: SimMotion=f.m
	var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents.lin_mei
	var before:=w.snapshot();var schedule:=SimSharedLeisure.plan(w,m,a,b,["park"])
	check(not schedule.is_empty() and equal(before,w.snapshot()),"compatible same-place leisure can be shared without changing plans")
	w.quest_balance.leisure_plans.lin_mei.place="town_square"
	check(SimSharedLeisure.plan(w,m,a,b,["park","town_square"]).is_empty(),"different destinations are not silently rewritten")
	w.quest_balance.leisure_plans.lin_mei.place="park"
	var stock: Dictionary=w.data.stockpile.duplicate(true)
	SimHangoutSafety.tick(w);var run:={"targetLocation":"park"};SimHangoutSafety.route(w,a,run)
	check(a._pendingHangout!=null and a.activity=="planned_leisure" and run.targetLocation=="park","sharing does not replace original activity or route")
	SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
	check(SimHangoutVisits.records(w).is_empty() and not a.has("_hangoutHome"),"arrival alone cannot complete meeting or send anyone home")
	w.data.tickCount+=1;w.data.clock.minute=15;SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
	check(SimHangoutVisits.records(w).is_empty() and a.needs.recreation==30,"fifteen minutes does not earn completion")
	var saved:=w.snapshot();var restored:=SimWorld.new();restored.load_snapshot(saved);w=restored;a=w.data.agents.chen_wei;b=w.data.agents.lin_mei;w.social.observe_positions(m)
	check(SimSharedLeisure.valid(w,a._pendingHangout),"shared plan and in-progress stay survive reload")
	w.data.tickCount+=1;w.data.clock.minute=30;SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
	check(SimLeisurePlan.plans(w).values().all(func(p): return p.state=="completed"),"both independently finish their real thirty-minute stays")
	check(SimHangoutVisits.records(w).size()==1 and SimHangoutVisits.records(w).values()[0].state=="met","completed stays plus actual proximity record one meeting")
	check(a.needs.recreation==45 and b.needs.recreation==45 and equal(stock,w.data.stockpile),"only original leisure reward, no added goods")
	check(a.has("_hangoutHome") and b.has("_hangoutHome"),"home return begins only after both activities complete")
	var after:=w.snapshot();SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
	check(equal(after,w.snapshot()),"repeated frames cannot duplicate meeting, memories or leisure rewards")
	for fault in ["far","other_place","one_unfinished","hungry","changed_plan","expired"]:
		f=shared_fixture();w=f.w;m=f.m;a=w.data.agents.chen_wei;b=w.data.agents.lin_mei
		w.data.tickCount+=2;w.data.clock.minute=30
		for p in SimLeisurePlan.plans(w).values(): p.state="completed"
		match fault:
			"far": m.positions.lin_mei.x+=80
			"other_place": m.positions.lin_mei.x=0;m.positions.lin_mei.y=0
			"one_unfinished": w.quest_balance.leisure_plans.lin_mei.state="attending"
			"hungry": b.needs.hunger=0
			"changed_plan": w.quest_balance.leisure_plans.lin_mei.due+=1
			"expired": w.data.tickCount=int(a._pendingHangout.expires_at)
		SimHangoutVisits.observe(w,m)
		check(SimHangoutVisits.records(w).is_empty(),"no false meeting: "+fault)
		if fault in ["changed_plan","expired"]:
			SimHangoutSafety.tick(w)
			check(a._pendingHangout==null and b._pendingHangout==null,"paired cancellation: "+fault)
	for malformed in [null,{}, {"ghost":[]}]:
		check(not SimSharedLeisure.valid(w,{"withId":"lin_mei","shared_leisure":malformed}),"malformed shared reservation rejected: "+str(malformed))
	var report:={"checks":checks,"failures":failures,"scope":"controlled shared original plans, true observed dwell progression, mid-stay reload, proximity and urgency guards, paired cancellation, one-time original reward, deferred return; separate negative cases use completed-state fixtures, not natural evidence"}
	FileAccess.open("res://docs/SHARED_LEISURE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

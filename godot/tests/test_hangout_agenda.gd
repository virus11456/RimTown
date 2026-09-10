extends "res://tests/test_daily_talk.gd"
func leisure(w: SimWorld,id: String,due: int,until: int,state: String="scheduled") -> void:
	w.quest_balance.leisure_plans={id:{"day":"fixture","place":"park","hour":14,"due":due,"until":until,"state":state,"reason":"fixture","dwell":0}}
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
	m.stable_routes=true;m.tick_seconds=8;w.data.clock.hour=12;w.data.clock.minute=0;w.quest_balance.hangout_safety_enabled=true;w.quest_balance.leisure_plans_enabled=true
	var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents.lin_mei
	for resident in [a,b]:
		resident.activity="socializing";resident.currentLocation="park";resident.personality.traits=["night_owl"]
		var point:=m.layout._nearest(m.layout._center("park"));m.positions[resident.id].x=point.x;m.positions[resident.id].y=point.y
	w.social.observe_positions(m)
	var now:=int(w.data.tickCount)
	for id in [a.id,b.id]:
		leisure(w,id,now+4,now+12)
		var before:=w.snapshot();var motion_before:=m.positions.duplicate(true);var random_state:=w.rng.state
		check(SimHangoutRoute.plan(m,a,b,w.data.clock,w.rules.jobs,["park"],w).is_empty(),"either resident's live leisure blocks overlapping invitation: "+id)
		check(equal(before,w.snapshot()) and equal(motion_before,m.positions) and random_state==w.rng.state,"agenda check is read-only: "+id)
	leisure(w,a.id,now-4,now+4)
	var later:=SimHangoutRoute.plan(m,a,b,w.data.clock,w.rules.jobs,["park"],w)
	check(not later.is_empty() and later.wait_ticks==4,"search can choose a free slot after leisure ends")
	check(SimHangoutRoute.leisure_conflict(w,a.id,now,now+1),"leisure travel preparation is reserved")
	check(not SimHangoutRoute.leisure_conflict(w,a.id,now+4,now+8),"exact leisure end releases the slot")
	for state in ["completed","missed","cancelled","skipped"]:
		leisure(w,a.id,now+4,now+12,state)
		check(not SimHangoutRoute.plan(m,a,b,w.data.clock,w.rules.jobs,["park"],w).is_empty(),"terminal leisure does not block: "+state)
	leisure(w,a.id,now+4,now+12);w.quest_balance.leisure_plans_enabled=false
	check(not SimHangoutRoute.plan(m,a,b,w.data.clock,w.rules.jobs,["park"],w).is_empty(),"disabled leisure does not reserve time")
	w.quest_balance.leisure_plans_enabled=true;w.quest_balance.leisure_plans={}
	for attempt in 100:
		w.data.tickCount+=8;SimSocial.relationship(a,b).affinity=70
		w.social.try_interaction(a,w.data,w.rng,w.rules.jobs,false,w)
		if a.get("_pendingHangout") is Dictionary: break
	check(a.get("_pendingHangout") is Dictionary,"real social generator still makes unconflicted invitations")
	if a.get("_pendingHangout") is Dictionary:
		check(a._pendingHangout.has("agenda_until") and a._pendingHangout.agenda_until==b._pendingHangout.agenda_until,"both proposals retain same estimated reserved end")
		leisure(w,b.id,int(w.data.tickCount)+4,int(w.data.tickCount)+12)
		var saved:=w.snapshot();var restored:=SimWorld.new();restored.load_snapshot(saved);w=restored
		check(w.data.agents.chen_wei._pendingHangout.agenda_until==a._pendingHangout.agenda_until,"reservation survives reload")
		var plans:=SimLeisurePlan.plans(w).duplicate(true);var stock: Dictionary=w.data.stockpile.duplicate(true)
		SimHangoutSafety.tick(w)
		check(w.data.agents.chen_wei._pendingHangout==null and w.data.agents.lin_mei._pendingHangout==null,"new overlap cancels both pending proposals")
		check("自主休閒" in w.quest_balance.hangout_status.chen_wei.reason,"cancellation explicitly names leisure conflict")
		check(equal(plans,SimLeisurePlan.plans(w)) and equal(stock,w.data.stockpile),"cancellation preserves existing leisure and stockpile")
		check(SimHangoutVisits.records(w).is_empty(),"cancelled overlap never creates a completed meeting")
	var report:={"checks":checks,"failures":failures,"scope":"controlled healthy close pair, existing leisure on either side, travel window and exact end, terminal/disabled plans, real proposal creation, changed plan and reload, explicit paired cancellation without rewriting leisure or adding goods; not natural frequency proof"}
	FileAccess.open("res://docs/HANGOUT_AGENDA_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_careers.gd"
func setup_guard() -> SimWorld:
	var w:=world();SimCareers.enroll(w,"guard");w.data.agents.player.currentLocation="town_square"
	check(SimCareers.start(w,"patrol:town_square").ok,"real duty starts")
	return w
func _initialize() -> void:
	var w:=setup_guard();check(SimCareers.book(w).get("outcomes",[]).is_empty(),"in progress is not outcome")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());finish(w);finish(restored)
	check(equal(w.snapshot(),restored.snapshot()),"active reload resolves deterministically")
	var b:=SimCareers.book(w);var row: Dictionary=b.outcomes.back()
	check(row.state=="completed" and row.settled and row.tick==w.data.tickCount and not row.time.is_empty(),"real completed duty has dated settlement")
	var before:=w.snapshot();SimCareers.tick(w);check(equal(before,w.snapshot()),"completed tick cannot replay")
	for reason in ["manual","left","midnight","changed"]:
		w=setup_guard();var xp: Dictionary=w.data.agents.player.skills.duplicate(true)
		match reason:
			"manual":SimCareers.cancel(w)
			"left":w.data.agents.player.currentLocation="tavern";finish(w)
			"midnight":w.data.clock.day+=1;SimCareers.book(w)
			"changed":w.data.agents.player.jobKey="farmer";finish(w)
		b=SimCareers.book(w);row=b.outcomes.back()
		check(row.state=="cancelled" and not row.settled and b.used==0 and equal(xp,w.data.agents.player.skills),"cancel has no settlement "+reason)
		check(not row.reason.is_empty(),"cancellation preserves reason "+reason)
		before=w.snapshot();SimCareers.cancel(w);check(equal(before,w.snapshot()),"empty cancellation does not add receipt "+reason)
		restored=SimWorld.new();restored.load_snapshot(w.snapshot());check(equal(b.outcomes,SimCareers.book(restored).outcomes),"resolved receipt survives reload "+reason)
	w=world();SimCareers.enroll(w,"guard");w.data.agents.player.currentLocation="town_square"
	for i in 15:SimCareers.start(w,"patrol:town_square");SimCareers.cancel(w,"手動取消 %d"%i)
	check(SimCareers.book(w).outcomes.size()==10 and SimCareers.book(w).outcomes[0].reason=="手動取消 5","history remains bounded")
	w=world();SimCareers.book(w).history=["舊巡查完成"]
	restored=SimWorld.new();restored.load_snapshot(w.snapshot());check(not SimCareers.book(restored).has("outcomes"),"legacy text not backfilled")
	var report:={"checks":checks,"failures":failures}
	FileAccess.open("res://docs/CAREER_OUTCOMES_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_hangout_visits.gd"
func _initialize() -> void:
	var w:=fixture();var layout:=TownLayout.new();layout.rebuild(w.data);var m:=SimMotion.new();m.configure(layout);m.stable_routes=true
	w.data.clock.hour=12
	for id in ["chen_wei","lin_mei"]:
		var a: Dictionary=w.data.agents[id];a.personality.traits=["night_owl"];a.needs.hunger=90;a.needs.rest=90
	m.update(w.data.agents);w.social.observe_positions(m);depart_pair(w)
	var point:=layout._nearest(layout._center("park"))
	for id in ["chen_wei","lin_mei"]: m.positions[id].x=point.x;m.positions[id].y=point.y
	SimHangoutVisits.observe(w,m)
	var token: String=SimHangoutVisits.records(w).keys()[0]
	check(SimHangoutVisits.records(w)[token].state=="met","actual same-place observation completes meeting")
	var saved:=w.snapshot();var resources: Dictionary=w.data.stockpile.duplicate(true)
	for id in ["chen_wei","lin_mei"]:
		var a: Dictionary=w.data.agents[id]
		check(a.has("_hangoutHome"),"meeting creates one bounded normal-walking return: "+id)
		w._update(id)
		check(a.activity=="heading_home" and a.currentLocation==a.homeLocation,"agent follows home route after meeting: "+id)
	var restored:=SimWorld.new();restored.load_snapshot(saved);restored.social.observe_positions(m)
	check(not SimHomeRest.plan(restored,restored.data.agents.chen_wei).is_empty(),"saved after-meeting return resumes with physical observations")
	var hungry: Dictionary=w.data.agents.lin_mei.duplicate(true);hungry.needs.hunger=0
	check(SimHomeRest.plan(w,hungry).is_empty(),"urgent hunger takes priority over post-meeting return")
	w.rules.jobs.return_work={"work_hours":[12,18],"workplace":"library"}
	var worker: Dictionary=w.data.agents.lin_mei.duplicate(true);worker.jobKey="return_work"
	check(SimHomeRest.plan(w,worker).is_empty(),"work takes priority over post-meeting return")
	var maximum_step:=0.0
	for frame in 8000:
		var p: Dictionary=m.positions.chen_wei;var old:=Vector2(p.x,p.y);m.update(w.data.agents)
		maximum_step=maxf(maximum_step,old.distance_to(Vector2(p.x,p.y)))
		if SimHomeRest.arrived(w,w.data.agents.chen_wei): break
	check(SimHomeRest.arrived(w,w.data.agents.chen_wei) and maximum_step<2,"return reaches own room at ordinary speed without teleport")
	w._update("chen_wei");check(not w.data.agents.chen_wei.has("_hangoutHome"),"actual arrival clears completed return")
	w.data.tickCount+=96;w._update("lin_mei");check(not w.data.agents.lin_mei.has("_hangoutHome"),"expired return is not retained indefinitely")
	check(equal(resources,w.data.stockpile),"return adds no resources")
	var report:={"checks":checks,"failures":failures,"maximum_step":maximum_step,"scope":"controlled reciprocal outing and physical meeting, actual agent update home routing, saved return, real slow walking into own room, arrival/expiry cleanup and unchanged resources; fixed-clock motion fixture"}
	FileAccess.open("res://docs/HANGOUT_RETURN_JOURNEY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

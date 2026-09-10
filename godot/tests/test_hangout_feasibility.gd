extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
	var a: Dictionary=w.data.agents.lin_mei;var b: Dictionary=w.data.agents.sun_yu
	a.jobKey="";b.jobKey=""
	var point:=m.layout._nearest(m.layout._center("park"))
	for id in [a.id,b.id]: m.positions[id].x=point.x;m.positions[id].y=point.y
	w.data.clock.hour=23;w.data.clock.minute=15
	var before:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true)
	var choices:=SimHangoutRoute.feasible(m,a,b,w.data.clock,w.rules.jobs,["park","library"])
	check("park" in choices and "library" not in choices,"night owls can stay near park but cannot reach distant library before sleep")
	check(SimHangoutRoute.distance(m,a.id,"library")>800,"budget uses actual long route")
	check(equal(before,w.snapshot()) and equal(positions,m.positions),"planning does not move residents or mutate world/resources")
	w.data.clock.hour=1;w.data.clock.minute=30
	check(SimHangoutRoute.feasible(m,a,b,w.data.clock,w.rules.jobs,["park"]).is_empty(),"insufficient departure window refuses proposal even nearby")
	w.data.clock.hour=12;w.data.clock.minute=0;a.jobKey="priest"
	check(SimHangoutRoute.feasible(m,a,b,w.data.clock,w.rules.jobs,["park"]).is_empty(),"one resident work/commute prevents schedule")
	a.jobKey="";m.positions.erase(b.id)
	check(SimHangoutRoute.feasible(m,a,b,w.data.clock,w.rules.jobs,["park"]).is_empty(),"missing actual location refuses estimate")
	check(SimHangoutRoute.feasible(null,a,b,w.data.clock,w.rules.jobs,["park"]).is_empty(),"missing observation cannot invent a route")
	var blocked:=SimMotion.new();var layout:=TownLayout.new();layout.rebuild(w.data)
	for row in layout.grid:
		for x in range(row.size()): row[x]=5
	layout.grid[1][1]=0;layout.grid[3][3]=0;blocked.configure(layout)
	check(is_inf(SimHangoutRoute.segment(blocked,Vector2(24,24),Vector2(56,56))),"disconnected walkable cells are rejected")
	var report:={"checks":checks,"failures":failures,"scope":"controlled night-owl time window, real route length, work priority, absent/disconnected path, no world or position mutation; not natural encounter proof"}
	FileAccess.open("res://docs/HANGOUT_FEASIBILITY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

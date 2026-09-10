extends "res://tests/test_leisure_plan.gd"
func _initialize() -> void:
	var f:=fixture();var w: SimWorld=f.w;var m: SimMotion=f.m;var p: Dictionary=SimLeisurePlan.plans(w).chen_wei
	w.data.tickCount=p.due;w.data.clock.hour=p.hour
	var point:=m.layout._nearest(m.layout._center(p.place));m.positions.chen_wei.x=point.x;m.positions.chen_wei.y=point.y
	SimLeisurePlan.observe(w,m);w.data.tickCount+=1;SimLeisurePlan.observe(w,m)
	check(p.dwell==1,"one observed continuous segment")
	var stock: Dictionary=w.data.stockpile.duplicate(true);var need: float=w.data.agents.chen_wei.needs.recreation
	w.data.tickCount+=2;SimLeisurePlan.observe(w,m)
	check(p.state=="attending" and p.dwell==0,"unobserved interval resets dwell instead of completing")
	check(w.data.agents.chen_wei.needs.recreation==need and equal(stock,w.data.stockpile),"observation gap yields no reward")
	for i in 100: SimLeisurePlan.observe(w,m)
	check(p.dwell==0,"repeated frames cannot replace missing time observations")
	w.data.tickCount+=1;SimLeisurePlan.observe(w,m);w.data.tickCount+=1;SimLeisurePlan.observe(w,m)
	check(p.state=="completed","two new continuous observations can complete normally")
	var saved:=w.snapshot();SimLeisurePlan.observe(w,m);check(equal(saved,w.snapshot()),"completion remains once-only")
	var report:={"checks":checks,"failures":failures,"scope":"controlled actual venue fixture, missing observation interval, no false reward, frame deduplication and continuous recovery"}
	FileAccess.open("res://docs/LEISURE_OBSERVATION_GAPS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_leisure_plan.gd"
func _initialize() -> void:
	for cause in ["unobserved","never_arrived","needs","left","gap","late"]:
		var f:=fixture();var w: SimWorld=f.w;var m: SimMotion=f.m;var p: Dictionary=SimLeisurePlan.plans(w).chen_wei
		w.data.tickCount=p.due;w.data.clock.hour=p.hour
		var point:=m.layout._nearest(m.layout._center(p.place))
		m.positions.chen_wei.x=point.x;m.positions.chen_wei.y=point.y
		if cause=="never_arrived": m.positions.chen_wei.x=0;m.positions.chen_wei.y=0
		if cause!="unobserved": SimLeisurePlan.observe(w,m)
		match cause:
			"needs": w.data.agents.chen_wei.needs.hunger=0;SimLeisurePlan.tick(w)
			"left": m.positions.chen_wei.x=0;m.positions.chen_wei.y=0;SimLeisurePlan.observe(w,m)
			"gap": w.data.tickCount+=3;SimLeisurePlan.observe(w,m)
		w.data.tickCount=p.until;SimLeisurePlan.tick(w)
		var phrase: String={"unobserved":"沒有足夠","never_arrived":"未確認到場","needs":"需求中斷","left":"曾離開","gap":"觀察有缺口","late":"已確認到場"}[cause]
		check(p.state=="missed" and phrase in p.reason,"specific truthful outcome: "+cause)
		check(phrase in SimLeisureChat.reply(w,"chen_wei"),"same facts reach local reply: "+cause)
		var row: Dictionary=SimLeisurePlan.history(w,"chen_wei").back()
		check(row.reason==p.reason and row.arrival_observed==(cause not in ["unobserved","never_arrived"]),"bounded history preserves evidence: "+cause)
		var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
		check(equal(row,SimLeisurePlan.history(restored,"chen_wei").back()),"reload preserves reason: "+cause)
	var report:={"checks":checks,"failures":failures,"scope":"actual-position fixtures distinguish absent observations, no observed arrival, needs interruption, departure, observation gap and insufficient dwell; same local reply/history/native world snapshot; no path-block inference"}
	FileAccess.open("res://docs/LEISURE_REASONS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

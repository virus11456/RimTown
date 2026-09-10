extends "res://tests/test_leisure_plan.gd"
func _initialize() -> void:
	var f:=fixture();var w: SimWorld=f.w
	w.data.agents.chen_wei.jobKey="doctor"
	SimLeisurePlan.finish(w,"chen_wei","missed","未完成到場停留")
	w.data.clock.day+=1;w.data.clock.hour=8;w.data.tickCount+=96;SimLeisurePlan.tick(w)
	var p: Dictionary=SimLeisurePlan.plans(w).chen_wei
	check(p.hour==19 and "較晚" in p.explanation,"full work day tries later slot after failed 18:00")
	check(not SimLeisurePlan.available(w,"chen_wei",17),"work remains protected")
	SimLeisurePlan.finish(w,"chen_wei","completed","actual outcome fixture")
	w.data.clock.day+=1;w.data.tickCount+=96;SimLeisurePlan.tick(w);p=SimLeisurePlan.plans(w).chen_wei
	check(p.hour==19 and p.basis.state=="completed","successful late slot retained next day")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
	check(equal(SimLeisurePlan.choose(w,"chen_wei"),SimLeisurePlan.choose(restored,"chen_wei")),"slot preference survives reload")
	w.data.agents.chen_wei.personality.traits=["early_bird"]
	var choice:=SimLeisurePlan.choose(w,"chen_wei")
	check(choice.hour==18 and not SimLeisurePlan.available(w,"chen_wei",20),"new sleep constraint overrides past successful slot")
	var report:={"checks":checks,"failures":failures,"scope":"doctor work fixture, later retry, successful slot reuse, reload and changed sleep constraints; outcomes injected only to isolate selection"}
	FileAccess.open("res://docs/LEISURE_WORK_SLOTS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

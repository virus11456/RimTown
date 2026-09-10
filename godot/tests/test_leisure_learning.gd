extends "res://tests/test_leisure_plan.gd"
func next_day(w: SimWorld) -> void:
	w.data.clock.day+=1;w.data.clock.hour=8;w.data.clock.minute=0;w.data.tickCount+=96
	SimLeisurePlan.tick(w)
func _initialize() -> void:
	var f:=fixture();var w: SimWorld=f.w
	var p: Dictionary=SimLeisurePlan.plans(w).chen_wei
	var stock: Dictionary=w.data.stockpile.duplicate(true);var skills: Dictionary=w.data.agents.chen_wei.skills.duplicate(true)
	check(SimLeisurePlan.history(w,"chen_wei").is_empty(),"scheduled is not a completed outcome")
	w.data.tickCount=p.until;SimLeisurePlan.tick(w)
	check(SimLeisurePlan.history(w,"chen_wei").size()==1 and SimLeisurePlan.history(w,"chen_wei")[0].state=="missed","deadline records actual failure")
	SimLeisurePlan.tick(w);SimLeisurePlan.finish(w,"chen_wei","completed","fake")
	check(SimLeisurePlan.history(w,"chen_wei").size()==1 and p.state=="missed","terminal outcome cannot be replaced or duplicated")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());w=restored
	next_day(w);p=SimLeisurePlan.plans(w).chen_wei
	check(p.hour==9 and p.basis.state=="missed" and p.basis.hour==18,"next day uses saved prior failure to choose earlier free slot")
	check("較早" in p.explanation,"reason exposes actual adjustment")
	var before: Dictionary=p.duplicate(true);SimLeisurePlan.tick(w);check(equal(before,p),"no intraday reroll")
	check(equal(stock,w.data.stockpile) and equal(skills,w.data.agents.chen_wei.skills),"learning adds no goods currency or XP")
	for reason in ["completed","cancelled"]:
		f=fixture();w=f.w;SimLeisurePlan.finish(w,"chen_wei",reason,"test outcome");next_day(w)
		check(SimLeisurePlan.plans(w).chen_wei.hour==18 and SimLeisurePlan.plans(w).chen_wei.basis.is_empty(),"no invented travel failure from "+reason)
	f=fixture();w=f.w;SimLeisurePlan.finish(w,"chen_wei","missed","deadline");w.data.agents.chen_wei.jobKey="priest";next_day(w)
	p=SimLeisurePlan.plans(w).chen_wei
	check(p.hour==19 and "沒有可用" in p.explanation,"earlier plan cannot override actual job hours")
	f=fixture();w=f.w;SimLeisurePlan.finish(w,"chen_wei","missed","deadline");w.data.tickCount+=300;next_day(w)
	check(SimLeisurePlan.plans(w).chen_wei.hour==18 and SimLeisurePlan.plans(w).chen_wei.basis.is_empty(),"old outcome cannot drive current adjustment")
	f=fixture();w=f.w;next_day(w)
	check(SimLeisurePlan.history(w,"chen_wei")[0].state=="missed","rollover closes unfinished plan without claiming completion")
	for day in 12:
		SimLeisurePlan.finish(w,"chen_wei","cancelled","test bounded history");next_day(w)
	check(SimLeisurePlan.history(w,"chen_wei").size()==7,"history bounded to seven outcomes")
	w.data.agents.erase("chen_wei");SimLeisurePlan.tick(w)
	check(SimLeisurePlan.history(w,"chen_wei").is_empty(),"removed resident history pruned")
	f=fixture();w=f.w;w.quest_balance.leisure_plans_enabled=false;SimLeisurePlan.tick(w);w.quest_balance.leisure_plans_enabled=true;SimLeisurePlan.tick(w)
	check(SimLeisurePlan.plans(w).chen_wei.state=="cancelled" and SimLeisurePlan.history(w,"chen_wei").size()==1,"toggle cannot regenerate or repeat outcome")
	var report:={"checks":checks,"failures":failures,"scope":"structured outcomes, once/day bounded history, saved failure changes next day slot, actual job precedence, stale history, no intraday reroll or rewards, rollover and removed residents"}
	FileAccess.open("res://docs/LEISURE_LEARNING_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

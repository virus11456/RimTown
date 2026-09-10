extends "res://tests/test_leisure_plan.gd"
func _initialize() -> void:
	var f:=fixture();var w: SimWorld=f.w;var m: SimMotion=f.m;w.social_enabled=true
	var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents.lin_mei
	var p: Dictionary=SimLeisurePlan.plans(w).chen_wei;w.data.tickCount=p.due;w.data.clock.hour=p.hour
	a.currentLocation=p.place;b.currentLocation=p.place
	var point:=m.layout._nearest(m.layout._center(p.place))
	for id in [a.id,b.id]: m.positions[id].x=point.x;m.positions[id].y=point.y
	w.social.observe_positions(m);SimLeisurePlan.observe(w,m)
	var stock: Dictionary=w.data.stockpile.duplicate(true)
	w._update(a.id)
	check(w.data.get("npcConversationLog",[]).size()==1,"physically attending leisure can use normal conversation flow")
	check(a.activity=="planned_leisure" and a.currentLocation==p.place,"conversation preserves leisure destination")
	check(equal(stock,w.data.stockpile),"conversation does not create goods")
	w._update(a.id);check(w.data.get("npcConversationLog",[]).size()==1,"existing conversation cooldown prevents repeats")
	f=fixture();w=f.w;m=f.m;w.social_enabled=true;a=w.data.agents.chen_wei;b=w.data.agents.lin_mei;p=SimLeisurePlan.plans(w).chen_wei
	w.data.tickCount=p.due;w.data.clock.hour=p.hour;a.currentLocation=p.place;b.currentLocation=p.place
	p.state="attending";w.social.observe_positions(m);w._update(a.id)
	check(w.data.get("npcConversationLog",[]).is_empty(),"logical attending flag without actual proximity cannot chat remotely")
	f=fixture();w=f.w;m=f.m;a=w.data.agents.chen_wei;b=w.data.agents.lin_mei;p=SimLeisurePlan.plans(w).chen_wei
	w.data.tickCount=p.due;w.data.clock.hour=p.hour;a.currentLocation=p.place;b.currentLocation=p.place
	for id in [a.id,b.id]: m.positions[id].x=point.x;m.positions[id].y=point.y
	w.social.observe_positions(m);SimLeisurePlan.observe(w,m);w.social_enabled=false;w._update(a.id)
	check(w.data.get("npcConversationLog",[]).is_empty(),"disabled social system remains disabled")
	var report:={"checks":checks,"failures":failures,"scope":"controlled shared physical leisure attendance, normal conversation and unchanged cooldown/destination/resources, absent proximity and disabled-social guards"}
	FileAccess.open("res://docs/LEISURE_CONVERSATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_daily_talk.gd"
func fixture() -> Dictionary:
	var f:=setup();var w: SimWorld=f.w
	w.data.clock.hour=8;w.data.clock.minute=0;w.quest_balance.leisure_plans_enabled=true
	SimLeisurePlan.tick(w)
	return f
func _initialize() -> void:
	var f:=fixture();var w: SimWorld=f.w;var m: SimMotion=f.m
	var p: Dictionary=SimLeisurePlan.plans(w).chen_wei
	check(p.state=="scheduled" and p.hour==18 and not SimLeisurePlan.plans(w).has("player"),"one future nonplayer plan")
	var saved:=w.snapshot();SimLeisurePlan.tick(w);check(equal(saved,w.snapshot()),"same day does not regenerate")
	check(not SimLeisurePlan.available(w,"chen_wei",23),"sleep protected")
	w.data.agents.chen_wei.jobKey="priest";check(not SimLeisurePlan.available(w,"chen_wei",18),"actual work protected")
	SimLeisurePlan.tick(w);check(p.state=="cancelled","changed work cancels")
	f=fixture();w=f.w;m=f.m;p=SimLeisurePlan.plans(w).chen_wei
	w.data.tickCount=p.due;w.data.clock.hour=p.hour
	w.data.agents.chen_wei.currentLocation=p.place
	m.positions.chen_wei.x=0;m.positions.chen_wei.y=0
	SimLeisurePlan.observe(w,m);check(p.state=="traveling" and p.dwell==0,"logical destination cannot complete")
	var point:=m.layout._nearest(m.layout._center(p.place));m.positions.chen_wei.x=point.x;m.positions.chen_wei.y=point.y
	SimLeisurePlan.observe(w,m)
	for i in 30: SimLeisurePlan.observe(w,m)
	check(p.state=="attending" and p.dwell==0,"frames cannot accelerate dwell")
	w.data.tickCount+=1;SimLeisurePlan.observe(w,m);check(p.dwell==1,"one time segment")
	w.data.agents.chen_wei.needs.hunger=0;SimLeisurePlan.observe(w,m);check(p.dwell==0,"urgent need interrupts continuous dwell")
	w.data.agents.chen_wei.needs.hunger=80;SimLeisurePlan.observe(w,m)
	w.data.tickCount+=1;SimLeisurePlan.observe(w,m)
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());w=restored;p=SimLeisurePlan.plans(w).chen_wei
	var stock: Dictionary=w.data.stockpile.duplicate(true);var skills: Dictionary=w.data.agents.chen_wei.skills.duplicate(true)
	w.data.agents.chen_wei.needs.recreation=20
	w.data.tickCount+=1;SimLeisurePlan.observe(w,m)
	check(p.state=="completed" and w.data.agents.chen_wei.needs.recreation==35,"restored physical dwell finishes once")
	saved=w.snapshot();SimLeisurePlan.observe(w,m);check(equal(saved,w.snapshot()),"completed cannot repeat reward")
	check(equal(stock,w.data.stockpile) and equal(skills,w.data.agents.chen_wei.skills),"no goods currency or XP generated")
	for fault in ["dead","raid","missing","work","appointment","disabled","deadline"]:
		f=fixture();w=f.w;m=f.m;p=SimLeisurePlan.plans(w).chen_wei;w.data.tickCount=p.due;w.data.clock.hour=p.hour
		match fault:
			"dead": w.data.agents.chen_wei.isDead=true
			"raid": w.data.agents.chen_wei._raidShelterUntil=99999
			"missing": w.data.townMap.locations.erase(p.place)
			"work": w.data.agents.chen_wei.jobKey="priest"
			"appointment": w.quest_balance.appointments={"current":{"npc":"chen_wei","state":"accepted","due":p.due,"until":p.until}}
			"disabled": w.quest_balance.leisure_plans_enabled=false
			"deadline": w.data.tickCount=p.until
		check(not SimLeisurePlan.directing(w,"chen_wei"),"no route override: "+fault)
		SimLeisurePlan.tick(w);check(p.state in ["cancelled","missed"],"terminal priority: "+fault)
	w=world();saved=w.snapshot();SimLeisurePlan.tick(w);check(equal(saved,w.snapshot()),"disabled pure world unchanged")
	var report:={"checks":checks,"failures":failures,"scope":"daily cap, sleep/work/needs/raid/appointment/death/removal priority, physical dwell fixture, save continuation, no duplicate goods or XP"}
	FileAccess.open("res://docs/LEISURE_PLAN_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

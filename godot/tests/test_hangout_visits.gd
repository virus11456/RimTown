extends "res://tests/test_hangout_safety.gd"
func depart_pair(w: SimWorld) -> String:
	var token:=""
	for id in ["chen_wei","lin_mei"]:
		var a: Dictionary=w.data.agents[id];var run:={"targetLocation":a.currentLocation}
		var pending: Dictionary=a._pendingHangout
		token=SimHangoutVisits.key(id,pending)
		SimHangoutSafety.route(w,a,run);a.currentLocation=run.targetLocation
	return token
func _initialize() -> void:
	var w:=fixture();var token:=depart_pair(w);var r: Dictionary=SimHangoutVisits.records(w)[token]
	check(r.departed.size()==2 and r.state=="traveling","both departures tracked without claiming arrival")
	var layout:=TownLayout.new();layout.rebuild(w.data);var m:=SimMotion.new();m.configure(layout);m.update(w.data.agents)
	var center:=layout._nearest(layout._center("park"))
	for id in r.people: m.positions[id].x=0;m.positions[id].y=0
	SimHangoutVisits.observe(w,m);check(r.state=="traveling","logical same destination cannot complete gathering")
	m.positions.chen_wei.x=center.x;m.positions.chen_wei.y=center.y
	SimHangoutVisits.observe(w,m);check(r.state=="traveling","one resident arrived is insufficient")
	m.positions.lin_mei.x=center.x;m.positions.lin_mei.y=center.y
	var stock: Dictionary=w.data.stockpile.duplicate(true);var rels: Dictionary=w.data.agents.chen_wei.relationships.duplicate(true)
	SimHangoutVisits.observe(w,m)
	check(r.state=="met" and r.has("resolved_tick"),"both physical arrivals complete once")
	check(w.data.agents.chen_wei.memory.any(func(x): return "依同行安排" in x.content) and w.data.agents.lin_mei.memory.any(func(x): return "依同行安排" in x.content),"both retain factual encounter memory")
	check(equal(stock,w.data.stockpile) and equal(rels,w.data.agents.chen_wei.relationships),"no extra resources or affinity")
	var saved:=w.snapshot();SimHangoutVisits.observe(w,m);check(equal(saved,w.snapshot()),"repeat observation cannot repeat memory")
	var restored:=SimWorld.new();restored.load_snapshot(saved);SimHangoutVisits.observe(restored,m);check(equal(saved,restored.snapshot()),"reload cannot repeat completion")
	for fault in ["expired","work","need","dead","left","shelter"]:
		w=fixture();token=depart_pair(w);r=SimHangoutVisits.records(w)[token]
		match fault:
			"expired": w.data.tickCount=r.until
			"work": w.data.agents.chen_wei.jobKey="priest"
			"need": w.data.agents.lin_mei.needs.hunger=0
			"dead": w.data.agents.lin_mei.isDead=true
			"left": w.data.agents.chen_wei.currentLocation="tavern"
			"shelter": w.data.agents.chen_wei._raidShelterUntil=999
		SimHangoutVisits.tick(w)
		check(r.state==("missed" if fault=="expired" else "cancelled"),"terminal outcome: "+fault)
		check(not w.data.agents.chen_wei.has("_activeHangout") and not w.data.agents.lin_mei.has("_hangoutDestination"),"both route markers released: "+fault)
	w=fixture();token=depart_pair(w);r=SimHangoutVisits.records(w)[token]
	SimHangoutVisits.restore_observations(w,{})
	check(r.state=="cancelled","missing saved positions cannot create arrival on rebuild")
	w=fixture();token=depart_pair(w);r=SimHangoutVisits.records(w)[token]
	m=SimMotion.new();m.configure(layout);m.update(w.data.agents)
	for i in range(2):
		var point:=layout._nearest(center+Vector2(-128,64+i*32))
		var pos: Dictionary=m.positions[r.people[i]]
		pos.x=point.x;pos.y=point.y;pos.targetX=point.x;pos.targetY=point.y;pos.doorPhase=null
	SimHangoutVisits.restore_observations(w,m.positions)
	check(r.state=="traveling","complete positions preserve live visit")
	var max_step:=0.0
	for frame in range(2400):
		var before: Dictionary={}
		for id in r.people: before[id]=Vector2(m.positions[id].x,m.positions[id].y)
		m.update(w.data.agents)
		for id in r.people: max_step=maxf(max_step,before[id].distance_to(Vector2(m.positions[id].x,m.positions[id].y)))
		SimHangoutVisits.observe(w,m)
		if r.state=="met": break
	check(r.state=="met","actual motion brings both residents to the meeting")
	check(max_step<2.0,"travel uses small walking steps without teleport")
	var report:={"checks":checks,"failures":failures,"scope":"controlled paired departure, real motion approach, missing-position restore, position fixtures, logical/one-sided arrival rejected, actual joint encounter and memories, no rewards, repeated/reloaded completion, deadline and priority cancellation"}
	FileAccess.open("res://docs/HANGOUT_VISIT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

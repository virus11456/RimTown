extends "res://tests/test_hangout_visits.gd"
func _initialize() -> void:
	var w:=fixture()
	for id in ["chen_wei","lin_mei"]: w.data.agents[id]._pendingHangout.location="library"
	var token:=depart_pair(w);var r: Dictionary=SimHangoutVisits.records(w)[token]
	var layout:=TownLayout.new();layout.rebuild(w.data);var m:=SimMotion.new();m.configure(layout);m.update(w.data.agents)
	var start:=layout._nearest(layout._center("park"))
	for id in r.people:
		var p: Dictionary=m.positions[id];p.x=start.x;p.y=start.y;p.targetX=start.x;p.targetY=start.y;p.doorPhase=null;p.erase("finalTarget")
	var max_step:=0.0;var blocked:=false;var progressed:=false
	for frame in 4000:
		var before: Dictionary={}
		for id in r.people: before[id]=Vector2(m.positions[id].x,m.positions[id].y)
		m.update(w.data.agents)
		for id in r.people:
			var point:=Vector2(m.positions[id].x,m.positions[id].y)
			max_step=maxf(max_step,point.distance_to(before[id]));blocked=blocked or not layout._walkable(point)
			if frame==119 and point.distance_to(start)>40: progressed=true
		SimHangoutVisits.observe(w,m)
		if r.state=="met": break
	check(progressed,"door route makes sustained progress beyond initial path waypoint")
	check(r.state=="met","pair physically reaches indoor library through real motion")
	check(max_step<2 and not blocked,"all movement uses walkable small steps without teleport")
	check(SimCareerPresence.together(m,"chen_wei","lin_mei","library"),"completion occurs inside actual destination")
	var saved:=w.snapshot();SimHangoutVisits.observe(w,m);check(equal(saved,w.snapshot()),"indoor arrival cannot repeat memory")
	var report:={"checks":checks,"failures":failures,"maximum_step":max_step,"scope":"controlled park-to-library pair, real motion and collision grid with fixed simulation clock to isolate routing; not enough-time or natural completion proof"}
	FileAccess.open("res://docs/HANGOUT_INDOOR_ROUTE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

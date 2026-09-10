extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m;m.stable_routes=true
	var a: Dictionary=w.data.agents.lin_mei;var b: Dictionary=w.data.agents.sun_yu
	a.jobKey="";b.jobKey="";a.personality.traits=["night_owl"];b.personality.traits=["night_owl"]
	var point:=m.layout._nearest(m.layout._center("park"))
	for id in [a.id,b.id]:m.positions[id].x=point.x;m.positions[id].y=point.y
	var before:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true)
	w.data.clock.hour=23;w.data.clock.minute=15
	m.stable_routes=false
	check("park" in SimHangoutRoute.feasible(m,a,b,w.data.clock,w.rules.jobs,["park"]),"legacy outbound-only check accepts nearby late meeting")
	m.stable_routes=true
	check(SimHangoutRoute.feasible(m,a,b,w.data.clock,w.rules.jobs,["park"]).is_empty(),"same meeting rejected when ordinary return journey misses sleep")
	w.data.clock.hour=12;w.data.clock.minute=0
	check("park" in SimHangoutRoute.feasible(m,a,b,w.data.clock,w.rules.jobs,["park"]),"earlier meeting leaves time for both home journeys")
	check(SimHangoutRoute.home_distance(m,a,"park")>0 and SimHangoutRoute.home_distance(m,b,"park")>0,"each participant has an actual home route")
	var length:=SimHangoutRoute.home_distance(m,b,"park");var ticks:=ceili(length/30.0)+1
	# End the route on the 02:00 sleep boundary: equality must not be accepted.
	var departure:=posmod(2*60-ticks*15,1440)
	var boundary:={"hour":departure/60,"minute":departure%60}
	check(not SimHangoutRoute.return_fits(m,b,boundary,w.rules.jobs,"park",0),"arrival at sleep boundary is too late")
	check(not SimHangoutRoute.return_fits(null,a,w.data.clock,w.rules.jobs,"park",0),"missing motion refuses estimate")
	var missing: Dictionary=a.duplicate(true);missing.homeLocation="missing_home"
	check(is_inf(SimHangoutRoute.home_distance(m,missing,"park")),"missing own home refuses estimate")
	check(is_inf(SimHangoutRoute.home_distance(m,a,"missing_place")),"missing meeting place refuses estimate")
	w.rules.jobs.return_test={"work_hours":[13,18],"workplace":"library"};var worker: Dictionary=a.duplicate(true);worker.jobKey="return_test"
	check(not SimHangoutRoute.return_fits(m,worker,w.data.clock,w.rules.jobs,"park",0),"return may not cross work or commute time")
	w.data.clock.hour=20;w.data.clock.minute=0
	check(equal(before,w.snapshot()) and equal(positions,m.positions),"estimates do not move residents or change world/resources")
	w.social.observe_positions(m)
	var maximum_step:=0.0
	for resident in [a,b]:
		var budget:=ceili(SimHangoutRoute.home_distance(m,resident,"park")/30.0)+1
		resident.currentLocation=resident.homeLocation;resident.activity="heading_home"
		var arrived:=false
		for frame in budget*120:
			var old:=Vector2(m.positions[resident.id].x,m.positions[resident.id].y)
			m.update({resident.id:resident})
			var p: Dictionary=m.positions[resident.id]
			maximum_step=maxf(maximum_step,old.distance_to(Vector2(p.x,p.y)))
			if SimHomeRest.arrived(w,resident): arrived=true;break
		check(arrived,"estimated normal-walking budget covers actual return: "+str(resident.id))
		# SimMotion removes agents absent from the input dictionary; restore the other fixture.
		m.positions=positions.duplicate(true)
	check(maximum_step<2,"actual return walking never teleports")
	var report:={"checks":checks,"failures":failures,"maximum_step":maximum_step,"scope":"controlled late versus early nearby invitation, both actual home paths at normal walking budget, exact sleep boundary, missing observations/home/place, work conflict and no world/position mutation; not natural social encounter proof"}
	FileAccess.open("res://docs/HANGOUT_RETURN_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

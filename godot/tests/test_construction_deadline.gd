extends "res://tests/test_careers.gd"
func accepted() -> SimWorld:
	var w:=world();SimAppointments.offer(w,"chen_wei");SimAppointments.respond(w,true)
	return w
func _initialize() -> void:
	for arrived in [false,true]:
		var w:=accepted();var a:=SimAppointments.current(w)
		a.npc_arrived=arrived;w.data.tickCount=a.until
		w.data.agents.chen_wei.job={"work_hours":[int(a.hour),int(a.hour)+1]}
		var before:=w.snapshot()
		check(not SimAppointmentChanges.propose(w) and equal(before,w.snapshot()),"direct change proposal cannot revive expired appointment: "+str(arrived))
		SimAppointments.tick(w)
		check(a.state=="missed" and not a.has("proposal"),"deadline takes precedence over new schedule conflict: "+str(arrived))
		check(("玩家未到" if arrived else "尚未抵達") in a.reason,"expiry preserves actual arrival distinction: "+str(arrived))
		var after:=w.snapshot();SimAppointments.tick(w)
		check(equal(after,w.snapshot()),"expiry memories and history are recorded once: "+str(arrived))
		var restored:=SimWorld.new();restored.load_snapshot(after);SimAppointments.tick(restored)
		check(equal(after,restored.snapshot()),"reload cannot revive expired appointment: "+str(arrived))
	var w:=accepted();var a:=SimAppointments.current(w)
	w.data.tickCount=int(a.until)-1;w.data.agents.chen_wei.job={"work_hours":[int(a.hour),int(a.hour)+1]}
	var until:=int(a.until);SimAppointments.tick(w)
	check(a.state=="change_offered" and int(a.until)==until,"before deadline conflict may propose but does not silently change deadline")
	check(a.has("proposal") and SimAppointmentChanges.respond(w,true) and a.state=="accepted" and int(a.until)>until,"future replacement requires explicit acceptance")
	w=accepted();a=SimAppointments.current(w)
	var layout:=TownLayout.new();layout.rebuild(w.data)
	var m:=SimMotion.new();m.configure(layout);m.stable_routes=true;m.update(w.data.agents)
	w.social.observed_motion=m
	var home: String=layout._house_id("chen_wei",w.data.agents.chen_wei.homeLocation)
	var door: Dictionary=layout.houses[home]
	layout.grid[floori(door.doorPixelY/16)][floori(door.doorPixelX/16)]=5;m.pathfinder.grid=layout.grid
	check(is_inf(SimHangoutRoute.home_distance(m,w.data.agents.chen_wei,a.place)),"new physical obstruction makes return route unavailable")
	check(not SimAppointments.free_hour(w,"chen_wei",int(a.hour)),"appointment rechecks current obstructed return route")
	var original_until:=int(a.until);var positions:=m.positions.duplicate(true)
	w.data.tickCount=original_until;SimAppointments.tick(w);SimAppointments.observe(w,m)
	check(a.state=="missed" and int(a.until)==original_until and not a.has("proposal"),"obstruction at deadline cannot extend or complete appointment")
	check(equal(positions,m.positions),"deadline handling does not move either participant")
	var point:=layout._center(a.place)
	for id in ["player","chen_wei"]:
		m.positions[id].x=point.x;m.positions[id].y=point.y;m.positions[id].walking=false;m.positions[id].doorPhase=null
	layout.grid[floori(door.doorPixelY/16)][floori(door.doorPixelX/16)]=0;m.pathfinder.grid=layout.grid
	var terminal:=w.snapshot();SimAppointments.observe(w,m);SimAppointments.tick(w)
	check(a.state=="missed" and equal(terminal,w.snapshot()),"late physical co-location after reopening cannot resurrect meeting or rewards")
	var report:={"checks":checks,"failures":failures,"scope":"exact deadline vs changed schedule conflict, direct proposal guard, prior-arrival distinction, one-time history/memory, native snapshot reload, pre-deadline explicit reschedule consent, blocked physical home doorway and late co-location"}
	FileAccess.open("res://docs/CONSTRUCTION_DEADLINE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_careers.gd"
func _initialize() -> void:
	var w:=world();var layout:=TownLayout.new();layout.rebuild(w.data)
	var m:=SimMotion.new();m.configure(layout);m.stable_routes=true
	var a: Dictionary=w.data.agents.chen_wei
	var agents:={"chen_wei":a};a.currentLocation="park";a.activity="wandering";m.update(agents)
	var maximum_step:=0.0
	for destination in ["library","tavern",a.homeLocation,"park"]:
		a.currentLocation=destination;a.activity="sleeping" if destination==a.homeLocation else "eating" if destination=="tavern" else "working"
		var arrived:=false;var walkable:=true
		for frame in 12000:
			var previous:=Vector2(m.positions.chen_wei.x,m.positions.chen_wei.y)
			m.update(agents)
			var point:=Vector2(m.positions.chen_wei.x,m.positions.chen_wei.y)
			maximum_step=maxf(maximum_step,previous.distance_to(point));walkable=walkable and layout._walkable(point)
			if not m.positions.chen_wei.walking and SimCareerPresence.place(m,"chen_wei")==destination:
				arrived=true;break
		check(arrived,"ordinary route reaches "+str(destination))
		check(walkable,"ordinary route stays on walkable grid: "+str(destination))
	check(maximum_step<2,"normal work/eating/sleep routes never teleport")
	# Retarget an in-progress indoor route, then resume its exact physical save.
	a.currentLocation="library";m.update(agents)
	for frame in 100: m.update(agents)
	a.currentLocation="tavern";m.update(agents)
	var saved: Dictionary=m.positions.duplicate(true);var resumed:=SimMotion.new();resumed.configure(layout);resumed.stable_routes=true;resumed.positions=saved.duplicate(true)
	for frame in 150: m.update(agents);resumed.update(agents)
	check(equal(m.positions,resumed.positions),"mid-route save resumes identically after retargeting")
	check(m.positions.chen_wei._directedGoal.location=="tavern","retarget clears old indoor destination")
	var report:={"checks":checks,"failures":failures,"maximum_step":maximum_step,"scope":"controlled sequential ordinary work/eating/home/sleep/outdoor destinations, real slow motion and collision grid, retarget and physical-state resume; fixed activity/time, not natural schedule completion"}
	FileAccess.open("res://docs/ROUTINE_ROUTE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

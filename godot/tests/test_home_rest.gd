extends "res://tests/test_careers.gd"
func _initialize() -> void:
	var w:=world();var layout:=TownLayout.new();layout.rebuild(w.data)
	var m:=SimMotion.new();m.configure(layout);m.stable_routes=true
	var a: Dictionary=w.data.agents.chen_wei;a.jobKey="";a.personality.traits=[];a.currentLocation="park";a.activity="wandering"
	var agents:={"chen_wei":a};m.update(agents);w.social.observe_positions(m)
	w.data.clock.hour=23;w.data.clock.minute=0;a.needs.hunger=90;a.needs.rest=50
	var stock: Dictionary=w.data.stockpile.duplicate(true)
	w._update("chen_wei")
	check(a.activity=="heading_home" and a.currentLocation==a.homeLocation,"sleep schedule sends physically absent resident home")
	check(is_equal_approx(a.needs.rest,49.4),"travel consumes rest instead of awarding sleep")
	var maximum_step:=0.0;var travel_checks:=0
	for frame in 12000:
		var before:=Vector2(m.positions.chen_wei.x,m.positions.chen_wei.y);m.update(agents)
		maximum_step=maxf(maximum_step,before.distance_to(Vector2(m.positions.chen_wei.x,m.positions.chen_wei.y)))
		if SimHomeRest.arrived(w,a): break
		if frame%120==0:
			a.needs.hunger=90
			var rest: float=a.needs.rest;w._update("chen_wei")
			if a.needs.rest>rest: failures.append("rest increased during real return route")
			travel_checks+=1
	check(travel_checks>0 and SimHomeRest.arrived(w,a),"real slow route reaches own home")
	check(maximum_step<2,"return home never teleports")
	a.needs.hunger=90;a.needs.rest=40;w._update("chen_wei")
	check(a.activity=="sleeping" and is_equal_approx(a.needs.rest,48),"stopped at own home restores eight rest")
	check(equal(stock,w.data.stockpile),"home rest does not generate resources")
	var saved: Dictionary=m.positions.duplicate(true)
	m.positions.chen_wei.walking=true
	check(not SimHomeRest.arrived(w,a),"walking inside home is still travel")
	m.positions=saved.duplicate(true);m.positions.chen_wei.doorPhase="entering"
	check(not SimHomeRest.arrived(w,a),"unfinished doorway transition cannot count as sleep")
	m.positions=saved.duplicate(true)
	var home:=layout._house_id("chen_wei",a.homeLocation)
	for key in layout.houses:
		if key!=home:
			var house: Dictionary=layout.houses[key];m.positions.chen_wei.x=house.interiorX;m.positions.chen_wei.y=house.interiorY
			check(not SimHomeRest.arrived(w,a),"another resident's house does not count as own bed");break
	m.positions=saved.duplicate(true);w.quest_balance.hangout_safety_enabled=true
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());var copy: Dictionary=restored.data.agents.chen_wei
	copy.activity="sleeping";SimHomeRest.apply(restored,copy)
	check(copy.activity=="heading_home","loaded world without scene observation cannot invent sleep")
	var resumed:=SimMotion.new();resumed.configure(layout);resumed.stable_routes=true;resumed.positions=saved.duplicate(true);restored.social.observe_positions(resumed)
	copy.activity="sleeping";SimHomeRest.apply(restored,copy)
	check(copy.activity=="sleeping","restored real home position allows sleep again")
	a.isPlayer=true;a.activity="sleeping";m.positions.clear();SimHomeRest.apply(w,a)
	check(a.activity=="sleeping","manual player rest remains unchanged")
	a.isPlayer=false;m.stable_routes=false;w.quest_balance.hangout_safety_enabled=false;a.activity="sleeping";SimHomeRest.apply(w,a)
	check(a.activity=="sleeping","source-only simulation remains compatible")
	var report:={"checks":checks,"failures":failures,"travel_ticks_checked":travel_checks,"maximum_step":maximum_step,"scope":"controlled fixed bedtime, actual slow path home with per-tick needs checks, own-house identity, movement/door guards, restored observations, player and legacy compatibility; not a natural full-night duration test"}
	FileAccess.open("res://docs/HOME_REST_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

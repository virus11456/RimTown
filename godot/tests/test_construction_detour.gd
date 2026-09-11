extends "res://tests/test_player_chat_ui.gd"
func crosses(path: Array,start: Vector2,area: Rect2) -> bool:
	var previous:=start
	for waypoint in path:
		var point:=Vector2(waypoint.x,waypoint.y);var steps:=maxi(1,ceili(previous.distance_to(point)/4))
		for step in range(steps+1):
			if area.has_point(previous.lerp(point,float(step)/steps)): return true
		previous=point
	return false
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	for resource in w.data.stockpile.resources: w.data.stockpile.resources[resource]=1000
	for agent in w.data.agents.values():
		if agent.jobKey=="mayor": agent.jobKey=""
	w.data.agents.player.jobKey="mayor"
	var plot: Dictionary=m.layout.factory_plots[0];var area:=Rect2(plot.x*16,plot.y*16,plot.w*16,plot.h*16)
	var start:=Vector2.ZERO;var venue:=""
	# Select a real doorway whose original route crosses the yet-unbuilt factory plot.
	for location in m.layout.buildings:
		if not w.data.townMap.locations.has(location): continue
		var door: Variant=m.door(location,"chen_wei")
		if door==null: continue
		for dx in [-2,6]:
			for dy in [-2,1,5]:
				var candidate:=m.layout._nearest(Vector2((plot.x+dx)*16+8,(plot.y+dy)*16+8))
				if area.grow(16).has_point(candidate) or not m.inside(candidate).is_empty(): continue
				if crosses(m.pathfinder.find_path(candidate,Vector2(door.x,door.y)),candidate,area): start=candidate;venue=location;break
			if not venue.is_empty(): break
		if not venue.is_empty(): break
	check(not venue.is_empty(),"real pre-construction doorway route crosses empty factory plot")
	if venue.is_empty(): quit(1);return
	var a: Dictionary=w.data.agents.chen_wei;a.currentLocation=venue;a._appointmentDestination=venue;a.activity="appointment_travel"
	var p: Dictionary=m.positions.chen_wei;p.x=start.x;p.y=start.y;p.doorPhase=null;p.erase("_directedGoal")
	m.update(w.data.agents)
	check(crosses(p._pathWaypoints,Vector2(p.x,p.y),area),"resident holds actual soon-obstructed route before building")
	var before:=Vector2(p.x,p.y)
	app.show_processing();press(app.drawer_body,"建造："+str(SimProcessing.rules().bakery.name))
	check(w.data.processing.builtFactories.has("bakery") and SimEconomy.amount(w,"wood")==980 and SimEconomy.amount(w,"stone")==985 and SimEconomy.amount(w,"silver")==920,"real build button applies original factory cost once")
	check(before.distance_to(Vector2(p.x,p.y))<1.001 and not crosses(p._pathWaypoints,Vector2(p.x,p.y),area),"scene refresh reroutes around new factory without snapping position")
	var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"construction detour native reload")
	p=m.positions.chen_wei;a=w.data.agents.chen_wei
	check(not crosses(p.get("_pathWaypoints",[]),Vector2(p.x,p.y),area),"native reload keeps route outside solid factory")
	var maximum:=0.0;var safe:=true;var phases: Array=[];var previous:=Vector2(p.x,p.y)
	for frame in range(6000):
		m.update(w.data.agents);var point:=Vector2(p.x,p.y)
		maximum=maxf(maximum,previous.distance_to(point));previous=point
		if not m.layout._walkable(point) or area.has_point(point): safe=false
		if p.doorPhase!=null and not phases.has(p.doorPhase): phases.append(p.doorPhase)
		if not p.walking and p.doorPhase==null and SimCareerPresence.place(m,"chen_wei")==venue: break
	check(not p.walking and p.doorPhase==null and SimCareerPresence.place(m,"chen_wei")==venue,"resident physically enters original building after construction detour")
	check(phases.has("approaching") and phases.has("entering"),"detour preserves doorway approach and entry stages")
	a.erase("_appointmentDestination");a.currentLocation=a.homeLocation;a.activity="sleeping"
	for frame in range(9000):
		m.update(w.data.agents);var point:=Vector2(p.x,p.y)
		maximum=maxf(maximum,previous.distance_to(point));previous=point
		if not m.layout._walkable(point) or area.has_point(point): safe=false
		if not p.walking and p.doorPhase==null and SimCareerPresence.room(m,"chen_wei")==m.layout._house_id("chen_wei",a.homeLocation): break
	check(not p.walking and p.doorPhase==null and SimCareerPresence.room(m,"chen_wei")==m.layout._house_id("chen_wei",a.homeLocation),"resident walks back into assigned home after visiting")
	check(safe and maximum<1.001,"every observed step avoids factory and blocked cells without teleport")
	var report:={"checks":checks,"failures":failures,"venue":venue,"maximum_step":maximum,"door_phases":phases,"scope":"controlled mayor/material and starting-position fixture; real factory build UI, preexisting route crossed footprint, immediate reroute, native reload, real doorway entry and assigned home return; clock fixed to isolate movement, not a natural appointment success claim"}
	FileAccess.open("res://docs/CONSTRUCTION_DETOUR_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

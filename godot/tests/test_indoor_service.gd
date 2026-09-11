extends "res://tests/test_careers_expansion_ui.gd"
var walked_frames:=0
var maximum_step:=0.0
var bad_cells:=0
func point(m: SimMotion,id: String="player") -> Vector2:
	return Vector2(m.positions[id].x,m.positions[id].y)
func walk(app: Node,destination: Vector2) -> bool:
	var m: SimMotion=app.motion
	var route:=m.pathfinder.find_path(point(m),destination)
	if route.is_empty(): return false
	for node in route:
		var goal:=Vector2(node.x,node.y)
		for frame in 4000:
			var before:=point(m);var offset:=goal-before
			if offset.length()<.1: break
			m.move_player(offset.limit_length(),minf(1.0/60,offset.length()/72))
			walked_frames+=1;maximum_step=maxf(maximum_step,before.distance_to(point(m)))
			if not m.layout._walkable(point(m)): bad_cells+=1
			var location:=SimCareerPresence.place(m,"player")
			if not location.is_empty(): app.simulation.data.agents.player.currentLocation=location
			app._validate_career_presence()
			if frame==3999: return false
	return point(m).distance_to(destination)<12
func put(m: SimMotion,id: String,pos: Vector2) -> void:
	m.positions[id].x=pos.x;m.positions[id].y=pos.y;m.positions[id].doorPhase=null
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		app.load_demo(town);var w: SimWorld=app.simulation;var id:=SimGovernance.mayor(w)
		SimCareers.enroll(w,"doctor")
		# Geometry coverage: every existing house is entered and exited through collision movement.
		for key in app.motion.layout.houses:
			var z: Dictionary=app.motion.layout.houses[key]
			var outside:=Vector2(z.doorPixelX,z.doorPixelY)
			var inside:=Vector2(z.interiorX,z.interiorY)
			put(app.motion,"player",outside)
			check(walk(app,inside) and SimCareerPresence.room(app.motion,"player")==key,"walk into "+town+key)
			check(walk(app,outside) and SimCareerPresence.room(app.motion,"player")!=key,"walk out of "+town+key)
		for key in app.motion.layout.buildings:
			var z: Dictionary=app.motion.layout.buildings[key]
			if not z.has("doorPixelX"): continue
			var outside:=Vector2(z.doorPixelX,z.doorPixelY)
			var inside: Vector2=app.motion.layout._nearest(app.motion.layout._center(key))
			put(app.motion,"player",outside)
			check(walk(app,inside) and SimCareerPresence.room(app.motion,"player")==key,"walk into public building "+town+key)
			check(walk(app,outside),"walk out of public building "+town+key)
		var initial: Dictionary=app.progress_snapshot()
		for job in ["doctor","priest"]:
			for outcome in ["complete","leave","reload","threshold","target_leaves","other_room"]:
				app._load_document(JSON.stringify(initial),"indoor service fixture");SimCareers.enroll(w,job)
				var m: SimMotion=app.motion;var key: String=m.layout.agent_house[id];var z: Dictionary=m.layout.houses[key]
				var inside:=Vector2(z.interiorX,z.interiorY);var outside:=Vector2(z.doorPixelX,z.doorPixelY)
				var a: Dictionary=w.data.agents[id];a.needs.rest=25;a.mood=-50;a.currentLocation=z.parentLocId
				put(m,id,inside);put(m,"player",outside)
				app.show_service_target(id);await settle()
				var before: Dictionary=app.progress_snapshot();press(app.drawer_body,"查看目前房屋入口")
				check(equal(before,app.progress_snapshot()) and app.rig.position.distance_to(Vector3(outside.x/16,0,outside.y/16))<.001,"entrance focuses actual house without moving actors "+town+job+outcome)
				var task: Dictionary=SimCareers.available(w).filter(func(t): return t.target==id)[0]
				check(not SimCareers.start(w,task.id).ok,"cannot serve from outside "+town+job+outcome)
				check(walk(app,inside),"walk to patient "+town+job+outcome)
				if outcome=="other_room":
					var other: String=m.layout.houses.keys().filter(func(k): return k!=key and m.layout.houses[k].parentLocId==z.parentLocId)[0]
					var other_zone: Dictionary=m.layout.houses[other]
					check(walk(app,Vector2(other_zone.interiorX,other_zone.interiorY)),"walk into neighboring home "+town+job)
					check(not SimCareers.start(w,task.id).ok,"same neighborhood different room cannot serve "+town+job)
					continue
				if outcome=="threshold":
					check(walk(app,outside-Vector2(0,16)),"walk onto door tile "+town+job)
					m.move_player(Vector2.ZERO,1.0/60)
					check(SimCareerPresence.at_threshold(m,"player") and not SimCareers.start(w,task.id).ok,"stationary manual player on threshold cannot serve "+town+job)
					app._load_document(JSON.stringify(app.progress_snapshot()),"threshold reload")
					check(not SimCareers.start(w,task.id).ok,"restored threshold cannot bypass presence "+town+job)
					continue
				check(SimCareers.start(w,task.id).ok,"indoor service starts "+town+job+outcome)
				var skill: String=SimCareers.JOBS[job].skill;var xp: float=w.data.agents.player.skills.get(skill,{}).get("xp",0)
				if outcome=="leave":
					check(walk(app,outside),"walk out during service "+town+job)
					check(SimCareers.book(w).active.is_empty(),"leaving cancels before settlement "+town+job)
				if outcome=="target_leaves":
					# Controlled target departure isolates cancellation from need recovery.
					put(m,id,outside);app._validate_career_presence()
					check(SimCareers.book(w).active.is_empty(),"target departure cancels "+town+job)
				if outcome=="reload":
					m.move_player(Vector2.ZERO,1.0/60)
					before=app.progress_snapshot();app._load_document(JSON.stringify(before),"indoor active reload")
					check(equal(before,app.progress_snapshot()),"active indoor save preserves world and physical positions "+town+job)
				var b:=SimCareers.book(w)
				if not b.active.is_empty(): w.data.tickCount=int(b.active.finish)
				SimCareers.tick(w)
				check(b.used==(0 if outcome in ["leave","target_leaves"] else 1) and float(w.data.agents.player.skills.get(skill,{}).get("xp",0))==xp+(0 if outcome in ["leave","target_leaves"] else 3),"indoor settlement exact XP and quota "+town+job+outcome)
				before=w.snapshot();SimCareers.tick(w);check(equal(before,w.snapshot()),"no duplicate settlement "+town+job+outcome)
		# Retained entrance button must not point at a room the target has left.
		app.show_service_target(id);await settle();stand(app,"town_square");put(app.motion,id,point(app.motion));app.motion.positions[id].doorPhase=null
		press(app.drawer_body,"查看目前房屋入口");await settle()
		check(has_text(app.drawer_body,"沒有可查看的室內入口"),"stale entrance resolves current outdoor location "+town)
		var fits:=true
		for c in app.drawer_body.get_children():
			if c is Control and c.size.x>app.drawer.size.x: fits=false
		check(fits,"375px visit guidance fits "+town)
	check(bad_cells==0 and maximum_step<=1.201 and walked_frames>1000,"collision walking has no invalid cells or teleport")
	var report:={"checks":checks,"failures":failures,"walked_frames":walked_frames,"maximum_step":maximum_step,"bad_cells":bad_cells,"scope":"two towns, all existing houses and door-bearing public buildings entered and exited using manual collision movement; controlled patient needs and initial positions; doctor/priest indoor completion, departure cancellation, active and stationary threshold reload, stale entrance UI, 375px layout; controlled settlement clock, not natural multi-day simulation"}
	FileAccess.open("res://docs/INDOOR_SERVICE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

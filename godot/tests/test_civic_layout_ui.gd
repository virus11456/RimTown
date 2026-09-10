extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var layout: TownLayout=app.motion.layout
	var legacy:=TownLayout.new();legacy.rebuild(w.data)
	for x in [504,616]: check(not legacy._walkable(Vector2(x,280)),"original overlapping home spawn is a blocked tile")
	var hall: Dictionary=layout.buildings.town_hall
	check(layout.civic_offset!=Vector2i.ZERO,"overlapping civic building relocated")
	for house in layout.houses.values():
		check(not Rect2(hall.x,hall.y,hall.w,hall.h).intersects(Rect2(house.x,house.y,house.w,house.h)),"town hall does not overlap any home")
	check(not BuildingSites.allowed(w.data,Vector2i(hall.x,hall.y)),"construction placement reserves relocated town hall")
	var path:=SimHangoutRoute.distance(app.motion,"chen_wei","town_hall")
	check(not is_inf(path),"relocated hall reachable by real path")
	var saved: Dictionary=app.progress_snapshot();var current_positions: Dictionary=app.motion.positions.duplicate(true)
	app._load_document(JSON.stringify(saved),"current civic layout reload")
	check(equal(current_positions,app.motion.positions),"current saves preserve physical state exactly")
	# Reproduce the two original invalid spawn positions in an old-format snapshot.
	saved._godot4a.erase("civic_layout_version")
	for pair in [["yang_feng",504.0],["huang_li",616.0]]:
		var p: Dictionary=saved._godot4a.motion[pair[0]];p.x=pair[1];p.y=280.0;p._directedGoal={"location":"town_hall","x":552,"y":224,"route_key":"town_hall","appointment":false}
	app._load_document(JSON.stringify(saved),"old overlapping layout migration")
	var old_positions: Dictionary=app.motion.positions.duplicate(true)
	for pair in [["yang_feng",504.0],["huang_li",616.0]]:
		var p: Dictionary=app.motion.positions[pair[0]]
		check(p.x==pair[1] and p.y==280.0 and not p.has("_directedGoal"),"legacy reload preserves coordinates and discards stale route: "+pair[0])
		check(app.motion.layout._walkable(Vector2(p.x,p.y)),"former blocked home doorway now walkable: "+pair[0])
	for frame in 120: app.motion.update(app.simulation.data.agents)
	for id in ["yang_feng","huang_li"]:
		var before:=Vector2(old_positions[id].x,old_positions[id].y);var p: Dictionary=app.motion.positions[id]
		check(before.distance_to(Vector2(p.x,p.y))>5 and before.distance_to(Vector2(p.x,p.y))<38,"old resident resumes ordinary movement: "+id)
	var report:={"checks":checks,"failures":failures,"town_hall":hall,"scope":"original app civic/home separation, path and construction reservation, exact current save restore, controlled old blocked-coordinate save restored without moving coordinates then ordinary walking"}
	FileAccess.open("res://docs/CIVIC_LAYOUT_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

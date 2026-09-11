extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	for r in w.data.stockpile.resources: w.data.stockpile.resources[r]=1000
	var initial: Dictionary=app.progress_snapshot();var plot: Dictionary=m.layout.factory_plots[0]
	for person in ["player","liu_jun"]:
		app._load_document(JSON.stringify(initial),"factory occupancy fixture")
		m.positions[person].x=(plot.x+2)*16;m.positions[person].y=(plot.y+1.5)*16
		var before:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true)
		check(not SimProcessing.build(w,"bakery") and equal(before,w.snapshot()) and equal(positions,m.positions),"occupied factory rejects public action atomically: "+person)
		check(not SimProcessing._execute_build(w,"bakery") and equal(before,w.snapshot()),"internal factory execution protects occupants: "+person)
	app._load_document(JSON.stringify(initial),"factory UI fixture")
	for a in w.data.agents.values():
		if a.jobKey=="mayor": a.jobKey=""
	w.data.agents.player.jobKey="mayor"
	app.show_processing();var original_pos: Dictionary=m.positions.player.duplicate(true)
	m.positions.player.x=(plot.x+3.75)*16;m.positions.player.y=(plot.y+2.75)*16
	var before:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true)
	press(app.drawer_body,"建造："+str(SimProcessing.rules().bakery.name))
	check(equal(before,w.snapshot()) and equal(positions,m.positions),"full four-by-three footprint is checked at button confirmation")
	check("用地附近有人" in app.status.text,"factory UI explains no-charge deferral")
	m.positions.player=original_pos;positions=m.positions.duplicate(true)
	press(app.drawer_body,"建造："+str(SimProcessing.rules().bakery.name))
	check(w.data.processing.builtFactories.has("bakery") and SimEconomy.amount(w,"wood")==980 and SimEconomy.amount(w,"stone")==985 and SimEconomy.amount(w,"silver")==920,"clear site builds once at original cost")
	check(app.world_view.content.get_children().any(func(n): return n.get_meta("factory_key","")=="bakery"),"factory model appears immediately without waiting for midnight")
	var blocked:=true
	for y in range(int(plot.y),int(plot.y+plot.h)):
		for x in range(int(plot.x),int(plot.x+plot.w)):
			if m.pathfinder.walkable(x,y): blocked=false
	check(blocked,"all twelve factory footprint cells block navigation")
	var start:=m.layout._nearest(Vector2((plot.x-1)*16+8,(plot.y+1)*16+8));var finish:=m.layout._nearest(Vector2((plot.x+5)*16+8,(plot.y+1)*16+8))
	var path:=m.pathfinder.find_path(start,finish);var safe:=not path.is_empty()
	for point in path:
		if point.x>=plot.x*16 and point.x<(plot.x+4)*16 and point.y>=plot.y*16 and point.y<(plot.y+3)*16: safe=false
	check(safe,"pathfinder routes around the new factory footprint")
	var maximum:=0.0
	for id in positions: maximum=maxf(maximum,Vector2(positions[id].x,positions[id].y).distance_to(Vector2(m.positions[id].x,m.positions[id].y)))
	check(maximum<2,"factory scene refresh uses ordinary movement, never coordinate snapping")
	# Controlled invalid old position demonstrates removal of the old nearest-ground teleport.
	m.positions.liu_jun.x=(plot.x+2)*16;m.positions.liu_jun.y=(plot.y+1.5)*16
	var trapped:=Vector2(m.positions.liu_jun.x,m.positions.liu_jun.y)
	app._refresh_building_world()
	check(trapped==Vector2(m.positions.liu_jun.x,m.positions.liu_jun.y) and not m.positions.liu_jun.walking,"blocked old position stays put instead of teleporting during refresh")
	var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"factory geometry reload")
	check(not m.pathfinder.walkable(int(plot.x),int(plot.y)) and w.data.processing.builtFactories.has("bakery"),"factory collision persists through native reload")
	# No remaining reserved plot must never silently charge for an invisible factory.
	m.layout.factory_plots=[];before=w.snapshot()
	check(not SimProcessing.build(w,"brewery") and equal(before,w.snapshot()),"missing reserved plot rejects without spending")
	app._load_document(JSON.stringify(initial),"approved factory fixture")
	SimProcessing.build(w,"bakery");SimGovernance.daily(w)
	var proposal: Dictionary=SimGovernance.book(w).proposals[0]
	check(proposal.status=="approved","ordinary mayor can approve factory at clear plot")
	original_pos=m.positions.player.duplicate(true);m.positions.player.x=(plot.x+2)*16;m.positions.player.y=(plot.y+1)*16
	before=w.snapshot();positions=m.positions.duplicate(true)
	check(not SimGovernance.execute(w,int(proposal.id)) and equal(before,w.snapshot()) and equal(positions,m.positions),"approved factory rechecks occupants without consuming approval")
	m.positions.player=original_pos
	check(SimGovernance.execute(w,int(proposal.id)) and proposal.status=="executed","same approval works when occupant leaves")
	var report:={"checks":checks,"failures":failures,"maximum_refresh_step":maximum,"path_points":path.size(),"scope":"controlled mayor/material/position fixtures; NPC/player occupancy, full rectangular footprint, atomic public/internal build, immediate model and navigation, actual refresh positions, invalid old-position no-snap, native reload and missing plot; no full factory production endurance"}
	FileAccess.open("res://docs/FACTORY_OCCUPANCY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

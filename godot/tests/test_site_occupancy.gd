extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	for r in w.data.stockpile.resources: w.data.stockpile.resources[r]=1000
	var initial: Dictionary=app.progress_snapshot()
	for action in ["building","decoration"]:
		for person in ["player","liu_jun"]:
			app._load_document(JSON.stringify(initial),"occupancy fixture reset")
			var footprint:=2 if action=="building" else 1
			var site: Vector2i=BuildingSites.candidates(w.data,footprint)[0]
			var p: Dictionary=m.positions[person];p.x=(site.x+.5)*16;p.y=(site.y+.5)*16;p.walking=false;p.doorPhase=null
			var before:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true)
			var result:=not SimBuildings.start(w,"granary",false,site).is_empty() if action=="building" else SimCombos.place(w,"flowerbed",site)
			check(not result and equal(before,w.snapshot()) and equal(positions,m.positions),"occupied public action rejects without costs proposal or movement: "+action+"/"+person)
			# Internal executors must independently protect the last step as well.
			result=not SimBuildings._execute_start(w,"granary",false,site).is_empty() if action=="building" else SimCombos._execute_place(w,"flowerbed",site)
			check(not result and equal(before,w.snapshot()),"internal execution checks occupancy: "+action+"/"+person)
	app._load_document(JSON.stringify(initial),"preview occupancy reset")
	for a in w.data.agents.values():
		if a.jobKey=="mayor": a.jobKey=""
	w.data.agents.player.jobKey="mayor"
	var site: Vector2i=BuildingSites.candidates(w.data)[0]
	app.show_building_site("granary")
	var original_pos: Dictionary=m.positions.liu_jun.duplicate(true)
	m.positions.liu_jun.x=(site.x+1)*16;m.positions.liu_jun.y=(site.y+1)*16
	var before:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true)
	press(app.drawer_body,"確認開工")
	check(equal(before,w.snapshot()) and equal(positions,m.positions),"person arriving after preview blocks confirmation without moving anyone")
	check("用地附近有人" in app.status.text and "未扣材料" in app.status.text,"UI explains why confirmation was deferred")
	m.positions.liu_jun=original_pos
	app.show_building_site("granary");press(app.drawer_body,"確認開工")
	check(w.data.buildings.projects.size()==1 and SimEconomy.amount(w,"wood")==float(before.stockpile.resources.wood)-30,"retry after person leaves starts one paid project")
	# One-tile decoration has its own footprint; a distant resident must not block it.
	var spot: Vector2i=BuildingSites.candidates(w.data,1)[0]
	original_pos=m.positions.player.duplicate(true)
	m.positions.player.x=spot.x*16-4;m.positions.player.y=spot.y*16
	check(not BuildingSites.vacant(w,spot,1),"half-tile margin prevents clipping a nearby resident")
	m.positions.player.x=(spot.x+2)*16;m.positions.player.y=(spot.y+2)*16
	check(BuildingSites.vacant(w,spot,1),"outside decoration footprint does not create an excessive exclusion zone")
	m.positions.player=original_pos
	check(SimCombos.place(w,"flowerbed",spot),"clear decoration site remains usable")
	# Approved proposal remains available if somebody walks into the site before execution.
	app._load_document(JSON.stringify(initial),"approved occupancy reset")
	site=BuildingSites.candidates(w.data)[0]
	SimBuildings.start(w,"granary",false,site);SimGovernance.daily(w)
	var proposal: Dictionary=SimGovernance.book(w).proposals[0]
	check(proposal.status=="approved","ordinary mayor approval established")
	original_pos=m.positions.player.duplicate(true);m.positions.player.x=(site.x+1)*16;m.positions.player.y=(site.y+1)*16
	before=w.snapshot();positions=m.positions.duplicate(true)
	check(not SimGovernance.execute(w,int(proposal.id)) and equal(before,w.snapshot()) and equal(positions,m.positions),"approved execution rechecks current occupants and preserves approval")
	m.positions.player=original_pos
	check(SimGovernance.execute(w,int(proposal.id)) and proposal.status=="executed","same approved proposal succeeds after occupant leaves")
	var report:={"checks":checks,"failures":failures,"scope":"controlled position/material fixtures, player and NPC, public and internal construction/decor executors, post-preview arrival, phone status, safe retry, footprint margin and NPC mayor approved execution; no long-run movement claim"}
	FileAccess.open("res://docs/SITE_OCCUPANCY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		app.load_demo(town);var w: SimWorld=app.simulation;var initial:=w.snapshot()
		for job in SimCareers.JOBS:
			app._load_document(JSON.stringify(initial),"all career facilities");SimCareers.enroll(w,job)
			# Explicit task-demand fixtures, without creating a new location.
			w.data.buildings.projects=[{"id":"fixture","name":"測試工程","status":"building","workDone":0,"workRequired":10}]
			w.data.research.current="fixture";w.data.research.projects.fixture={"name":"測試研究","status":"researching","cost":100,"progress":0}
			w.data.stockpile.resources.research_points=0;w.data.farm.plots=[{"id":1,"state":"growing","waterLevel":50}]
			if SimCareers.PRODUCTION.has(job):
				for resource in SimCareers.recipe(job).outputs: w.data.stockpile.resources[resource]=0
			var places: Dictionary=w.data.townMap.locations.duplicate(true);var stock: Dictionary=w.data.stockpile.duplicate(true)
			app.show_careers();await settle()
			check(SimCareers.available(w).all(func(t): return w.data.townMap.locations.has(t.location)),"all listed tasks have real destinations "+town+job)
			check(equal(places,w.data.townMap.locations) and equal(stock,w.data.stockpile),"opening profession creates no facility or resources "+town+job)
			if town=="harbor" and job in ["carpenter","blacksmith","tailor"]:
				check(SimCareers.available(w).is_empty() and has_text(app.drawer_body,"本鎮尚無工房"),"harbor missing workshop is explained without phantom work "+job)
			for location in ["workshop","quarry","library","meadow","general_store","residential_east","tavern"]: w.data.townMap.locations.erase(location)
			app.show_careers();await settle()
			check(SimCareers.available(w).all(func(t): return w.data.townMap.locations.has(t.location)),"removed venues cannot create broken task cards "+town+job)
			check(SimCareers.defense_bonus(w)==0,"missing patrol destinations do not grant a bonus "+town+job)
	# A core work item already started must cancel if the location is removed,
	# even without a UI refresh or physical-observation adapter.
	for job in ["carpenter","researcher","guard"]:
		var w:=SimWorld.new();w.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json")))
		SimCareers.enroll(w,job);w.data.buildings.projects=[{"id":"fixture","name":"測試工程","status":"building","workDone":0,"workRequired":10}]
		w.data.research.current="fixture";w.data.research.projects.fixture={"name":"測試研究","status":"researching","cost":100,"progress":0};w.data.stockpile.resources.research_points=0
		var task: Dictionary=SimCareers.available(w)[0];w.data.agents.player.currentLocation=task.location
		check(SimCareers.start(w,task.id).ok,"core fixture starts on existing venue "+job)
		w.data.townMap.locations.erase(task.location);w.data.tickCount+=4;var stock: Dictionary=w.data.stockpile.duplicate(true)
		SimCareers.tick(w);check(SimCareers.book(w).active.is_empty() and SimCareers.book(w).used==0 and equal(stock,w.data.stockpile),"removed venue cancels without quota or stock effects "+job)
	var report:={"checks":checks,"failures":failures,"scope":"all eleven profession pages in two towns with controlled demand, original missing workshop and removed venue fixtures, no free facilities/resources, no broken destinations, core active-work cancellation on location removal; not natural all-career completion"}
	FileAccess.open("res://docs/CAREER_FACILITIES_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

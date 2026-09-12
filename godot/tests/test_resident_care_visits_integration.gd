extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var cases: Array=[]
	for spec in [["frontier","doctor"],["harbor","doctor"],["frontier","priest"],["harbor","priest"]]:
		var town: String=spec[0];var job: String=spec[1]
		var pair: Dictionary=Fixture.prepare(app,town,job)
		var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true
		for id in w.data.agents:
			if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
		if job=="priest": w.runtime[pair.recipient].moodModifier=-100
		var start: Vector2=m.layout._nearest(m.layout._center("town_square"))
		m.positions[pair.recipient].x=start.x;m.positions[pair.recipient].y=start.y
		var travel:=false;var visit:=false;var ended:=false
		for tick in 8:
			app._tick_simulation()
			var a: Dictionary=w.data.agents[pair.recipient]
			travel=travel or a.activity=="care_travel";visit=visit or a.get("_careHolding",false)
			if visit and not a.has("_careVisit"): ended=true
			for frame in 480: m.update(w.data.agents)
			if tick==0:
				var save: Dictionary=app.progress_snapshot();var old: Dictionary=m.positions[pair.recipient].duplicate(true)
				app._load_document(JSON.stringify(save),"care route reload");w=app.simulation;m=app.motion
				check(w.data.agents[pair.recipient].has("_careVisit"),"reload preserves request "+town)
				check(Vector2(m.positions[pair.recipient].x,m.positions[pair.recipient].y).distance_to(Vector2(old.x,old.y))<.001,"reload preserves walking position "+town)
		check(travel and visit and ended,"real ticks run request arrival stay and finish "+town)
		check(not w.data.agents[pair.recipient].get("_careHolding",false),"no permanent freeze "+town)
		cases.append({"town":town,"job":job,"travel":travel,"visit":visit,"ended":ended})
	var report:={"checks":checks,"failures":failures,"cases":cases,"scope":"controlled fatigue/low mood demand and clinic, real simulation ticks and collision frames, mid-route save/load, arrival, bounded stay and continuation"}
	FileAccess.open("res://docs/RESIDENT_CARE_VISITS_INTEGRATION.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

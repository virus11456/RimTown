extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			var pair: Dictionary=Fixture.prepare(app,town,job)
			var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
			var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
			var goal:=Vector2(m.positions[pair.recipient].x,m.positions[pair.recipient].y)
			for id in w.data.agents:
				if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
			check(SimResidentCare.feasibility(w,a,b,goal).is_empty(),"nearby midday service fits "+town+job)
			var hours: Array=w.rules.jobs[job].work_hours
			w.data.clock.hour=int(hours[1])-1;w.data.clock.minute=45
			check(not SimResidentCare.feasibility(w,a,b,goal).is_empty(),"do not depart before provider closes")
			SimResidentCare.tick(w)
			check(not a.has("_careVisit") and not a.has("_careVisitDay"),"deferred departure does not spend daily request")
			check(a.has("_careDeferred") and "暫緩求助" in a._careVisitNotice,"defer reason shown")
			w.data.clock.hour=12;w.data.clock.minute=0
			a.needs.hunger=22;check(not SimResidentCare.feasibility(w,a,b,goal).is_empty(),"anticipate hunger during service");a.needs.hunger=80
			a.needs.rest=12;check(not SimResidentCare.feasibility(w,a,b,goal).is_empty(),"anticipate fatigue during service");a.needs.rest=30
			var appointments: Dictionary=w.quest_balance.get("appointments",{}).duplicate(true)
			w.quest_balance.appointments={"current":{"npc":pair.recipient,"state":"accepted","due":int(w.data.tickCount)+12,"until":int(w.data.tickCount)+20}}
			check(not SimResidentCare.feasibility(w,a,b,goal).is_empty(),"reserve confirmed future appointment")
			w.quest_balance.appointments=appointments
			check(not SimResidentCare.feasibility(w,a,b,Vector2(-16,-16)).is_empty(),"reject non-walkable destination")
			var budget: float=m.tick_seconds;m.tick_seconds=.05
			check(not SimResidentCare.feasibility(w,a,b,goal).is_empty(),"reject trip beyond unchanged deadline");m.tick_seconds=budget
			SimResidentCare.tick(w)
			check(a.has("_careVisit") and not a.has("_careDeferred"),"can request later when conditions fit")
	var report:={"checks":checks,"failures":failures,"scope":"two towns and care roles, close-time forecast, hunger/rest reserve, travel deadline, deferral without quota use and later admission; controlled needs"}
	FileAccess.open("res://docs/CARE_FEASIBILITY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

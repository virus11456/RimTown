extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for job in ["doctor","priest"]:
		var pair: Dictionary=Fixture.prepare(app,"harbor",job)
		var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
		var ids: Array=w.data.agents.keys().filter(func(id):return id not in ["player",pair.provider]);ids.sort()
		var point: Dictionary=m.positions[pair.recipient].duplicate(true)
		for id in w.data.agents: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
		for index in 4:
			var id: String=ids[index];var a: Dictionary=w.data.agents[id]
			a.jobKey="";a.age=28;a.activity="idle";a.needs.hunger=80;a.needs.rest=30;a.mood=-20;a.currentLocation=w.data.agents[pair.provider].currentLocation;a.erase("_careVisitDay")
			m.positions[id]=point.duplicate(true)
			SimResidentCare.tick(w)
			if index==3:
				check(not a.has("_careVisit"),"fourth patient not admitted after three completed visits")
				continue
			check(a.has("_careVisit"),"within quota admits patient")
			if not a.has("_careVisit"): continue
			SimResidentCare.apply(w,a,w.runtime[id])
			for frame in 1000:
				m.update(w.data.agents)
				if not m.positions[id].walking and m.positions[id].get("doorPhase")==null: break
			w.data.tickCount+=1;SimResidentCare.tick(w);w.data.tickCount+=2;SimResidentCare.tick(w)
			check(a.get("_careResults",[]).any(func(row):return row.state=="completed"),"admitted patient completes")
		check(w.data.agents[pair.provider]._careProvided.used==3,"exactly three completed services")
		w.data.clock.day+=1
		for id in w.data.agents: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
		w.data.agents[ids[3]].erase("_careVisitDay")
		SimResidentCare.tick(w)
		check(w.data.agents[ids[3]].has("_careVisit"),"next day can admit fourth resident")
	var report:={"checks":checks,"failures":failures,"scope":"four distinct residents, two provider roles, three actual completed visits, fourth blocked, next-day admission; controlled demand and initial patient positions"}
	FileAccess.open("res://docs/RESIDENT_CARE_QUOTA_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	print("CARE_LIFECYCLE_LOADING")
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var cases: Array=[]
	for town in ["frontier","harbor"]:
		for mode in ["player_patient","player_provider","provider_job","patient_job","removed_place","midnight"]:
			print("CASE "+town+" "+mode)
			var pair: Dictionary=Fixture.prepare(app,town,"doctor")
			var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
			var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
			for id in w.data.agents:
				if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
			SimResidentCare.tick(w);SimResidentCare.apply(w,a,w.runtime[pair.recipient])
			for frame in 1500:
				m.update(w.data.agents)
				if not m.positions[pair.recipient].walking and m.positions[pair.recipient].get("doorPhase")==null: break
			w.data.tickCount+=1;SimResidentCare.tick(w);SimResidentCare.apply(w,a,w.runtime[pair.recipient])
			check(a.get("_careHolding",false),"NPC service started "+mode)
			var rest: float=a.needs.rest
			if mode.begins_with("player"):
				var target: String=pair.recipient if mode=="player_patient" else pair.provider
				w.data.agents[target].needs.rest=30
				w.data.agents.player.jobKey="doctor";w.data.agents.player.currentLocation=b.currentLocation
				m.positions.player=m.positions[target].duplicate(true);m.positions.player.walking=false
				var started:=SimCareers.start(w,"care:"+target)
				check(started.ok,"actual player service starts "+mode)
				check(not a.has("_careVisit") and not a.has("_careHolding"),"player start releases NPC immediately")
				check(ResidentCarePerformance.target(w,m,pair.provider).is_empty(),"player intervention immediately removes NPC gesture")
			if mode=="provider_job": b.jobKey="guard"
			if mode=="patient_job": a.jobKey="guard"
			if mode=="removed_place": w.data.townMap.locations.erase(b.currentLocation)
			if mode=="midnight":
				w.data.clock.hour=23;w.data.clock.minute=45;SimClock.tick(w.data.clock)
			w.data.tickCount+=2;SimResidentCare.tick(w)
			check(not a.has("_careVisit") and not a.has("_careHolding"),"NPC stay cancelled "+mode)
			check(a.needs.rest==rest and a._careResults.back().state=="cancelled" and a._careResults.back().amount==0,"no NPC effect after conflict "+mode)
			check(int(b.get("_careProvided",{}).get("used",0))==0,"cancel does not charge provider "+mode)
			if mode.begins_with("player"):
				var book:=SimCareers.book(w);check(not book.active.is_empty(),"NPC cancellation preserves player task")
				w.data.tickCount=book.active.finish;SimCareers.tick(w)
				check(book.completed==1 and book.used==1,"player alone completes and earns career credit")
			if mode=="midnight":
				w.data.clock.hour=12;b.activity="working";a.activity="idle"
				check(SimResidentCare.allowance(w,a,b,"doctor"),"new-day allowance available")
				var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"cross-day cancellation")
				check(not app.simulation.data.agents[pair.recipient].has("_careVisit"),"reload does not resume cancelled visit")
			cases.append({"town":town,"mode":mode})
	var report:={"checks":checks,"failures":failures,"cases":cases,"scope":"controlled doctor demand, actual arrival and player start/complete APIs, provider/patient role change, facility removal, midnight and cancelled reload; no fabricated player task"}
	FileAccess.open("res://docs/CARE_LIFECYCLE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

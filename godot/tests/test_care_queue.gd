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
			var others: Array=w.data.agents.keys().filter(func(id):return id not in ["player",pair.recipient,pair.provider]);others.sort()
			var second: String=others.back();var waiting: Dictionary=w.data.agents[second]
			waiting.jobKey="";waiting.age=28;waiting.activity="idle";waiting.currentLocation=b.currentLocation;waiting.needs.hunger=80;waiting.needs.rest=30;waiting.mood=-20
			m.positions[second]=m.positions[pair.recipient].duplicate(true)
			for id in w.data.agents:
				if id not in [pair.recipient,second]: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
			SimResidentCare.tick(w)
			check(a.has("_careVisit") and waiting.has("_careQueue"),"busy provider creates bounded queue "+town+job)
			check(not waiting.has("_careVisitDay") and not waiting.has("_careDestination"),"waiting does not spend quota or direct movement")
			var original: Dictionary=m.positions[second].duplicate(true)
			var since: int=waiting._careQueue.since
			w.data.tickCount+=1;SimResidentCare.tick(w)
			check(int(waiting._careQueue.since)==since and equal(m.positions[second],original),"retry keeps seniority without teleport")
			var saved: Dictionary=app.progress_snapshot()
			app._load_document(JSON.stringify(saved),"queued care reload");w=app.simulation;m=app.motion
			a=w.data.agents[pair.recipient];b=w.data.agents[pair.provider];waiting=w.data.agents[second]
			check(int(waiting._careQueue.since)==since and equal(m.positions[second],original),"queue and position survive actual reload")
			check(SimResidentCare.queue_order(w,[pair.recipient,second])[0]==second,"older wait precedes alphabetical selection")
			w.data.tickCount+=2;SimResidentCare.tick(w)
			w.data.tickCount+=1;SimResidentCare.tick(w)
			check(waiting.has("_careVisit") and not waiting.has("_careQueue"),"released provider admits waiting resident")
			check(not a.get("_careResults",[]).is_empty() and a._careResults.back().state=="completed","first visit actually completes")
			check(int(b._careProvided.used)==1,"queue admission does not grant extra care outcome")
			w.data.tickCount+=1;SimResidentCare.tick(w);w.data.tickCount+=2;SimResidentCare.tick(w)
			check(not waiting.has("_careVisit") and waiting._careResults.back().state=="completed" and int(b._careProvided.used)==2,"queued resident completes once and uses shared quota")
			SimResidentCare.tick(w);check(int(b._careProvided.used)==2,"repeated tick does not replay queued outcome")
			SimResidentCare.clear(waiting,"test cleanup");waiting.erase("_careVisitDay")
			waiting._careQueue={"day":SimClock.total_days(w.data.clock)-1,"since":0,"job":job}
			waiting.needs.rest=80;waiting.mood=80
			SimResidentCare.tick(w);check(not waiting.has("_careQueue"),"expired queue and resolved need clear")
			waiting._careQueue={"day":SimClock.total_days(w.data.clock),"since":0,"job":job};waiting.activity="sleeping"
			SimResidentCare.tick(w);check(not waiting.has("_careQueue"),"sleep takes priority")
			waiting._careQueue={"day":SimClock.total_days(w.data.clock),"since":0,"job":job};w.social_enabled=false
			SimResidentCare.tick(w);check(not waiting.has("_careQueue"),"disable clears queue")
			var goal:=Vector2(m.positions[pair.recipient].x,m.positions[pair.recipient].y)
			var entry: Variant=m.door(b.currentLocation,pair.recipient)
			if entry!=null:
				var start:=m.layout._nearest(Vector2(entry.x,entry.y+16));m.positions[pair.recipient].x=start.x;m.positions[pair.recipient].y=start.y
				var door_point:=Vector2(entry.x,entry.y)
				var expected:=SimHangoutRoute.segment(m,start,door_point)+SimHangoutRoute.segment(m,door_point,goal)
				check(is_equal_approx(SimResidentCare.route_distance(m,pair.recipient,b.currentLocation,goal),expected),"forecast follows entrance to exact service position")
	var report:={"checks":checks,"failures":failures,"scope":"two towns/two roles: busy provider, queue seniority, no quota or movement, actual reload, release/admission/completion without replay, day/sleep/disable cleanup and exact door route"}
	FileAccess.open("res://docs/CARE_QUEUE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

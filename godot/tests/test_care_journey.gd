extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var cases: Array=[]
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			var pair: Dictionary=Fixture.prepare(app,town,job)
			var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
			var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
			a.needs.rest=40;a.needs.hunger=100;b.needs.rest=100;b.needs.hunger=100
			if job=="priest": w.runtime[pair.recipient].moodModifier=-100
			for id in w.data.agents:
				if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
			var q: Dictionary=m.positions[pair.provider];var goal:=Vector2(q.x+24,q.y)
			for offset in [Vector2(24,0),Vector2(-24,0),Vector2(0,24),Vector2(0,-24),Vector2(12,0),Vector2(-12,0),Vector2(0,12),Vector2(0,-12)]:
				var candidate: Vector2=Vector2(q.x,q.y)+offset
				if m.layout._walkable(candidate) and m.location_at(candidate)==b.currentLocation: goal=candidate;break
			var found:=false;var planned:=0
			for place in w.data.townMap.locations:
				var point:=m.layout._nearest(m.layout._center(place));m.positions[pair.recipient].x=point.x;m.positions[pair.recipient].y=point.y
				planned=SimResidentCare.travel_ticks(m,pair.recipient,b.currentLocation,goal)
				if planned>=6 and SimResidentCare.feasibility(w,a,b,goal).is_empty(): found=true;break
			check(found,"find real long route beyond previous total deadline "+town+job)
			if not found: continue
			var original: Dictionary=m.positions[pair.recipient].duplicate(true)
			SimResidentCare.tick(w)
			check(a.has("_careVisit") and int(a._careVisit.until)-int(w.data.tickCount)>8,"long feasible departure admitted")
			check(m.positions[pair.recipient]==original and not a.get("_careHolding",false),"departure does not teleport or start care")
			var deadline: int=a._careVisit.travel_until;var overall: int=a._careVisit.until
			var saw_travel:=false;var saw_stay:=false;var finished:=false;var largest:=0.0
			for tick in range(planned+4):
				app._tick_simulation()
				if a.has("_careVisit"):
					check(int(a._careVisit.travel_until)==deadline and int(a._careVisit.until)==overall,"deadline never slides")
					saw_travel=saw_travel or a._careVisit.state=="travel";saw_stay=saw_stay or a._careVisit.state=="visiting"
					if a._careVisit.state=="travel": check(not a._careVisit.has("finish"),"travel is not service time")
				for frame in 480:
					var p: Dictionary=m.positions[pair.recipient];var previous:=Vector2(p.x,p.y);m.update(w.data.agents)
					p=m.positions[pair.recipient];largest=maxf(largest,previous.distance_to(Vector2(p.x,p.y)))
				if tick==0:
					var saved: Dictionary=app.progress_snapshot();var position: Dictionary=m.positions[pair.recipient].duplicate(true)
					app._load_document(JSON.stringify(saved),"long care route reload");w=app.simulation;m=app.motion;a=w.data.agents[pair.recipient];b=w.data.agents[pair.provider]
					check(a.has("_careVisit") and equal(position,m.positions[pair.recipient]),"mid-route actual reload preserves motion")
				if not a.has("_careVisit"):
					finished=not a.get("_careResults",[]).is_empty() and a._careResults.back().state=="completed";break
			check(saw_travel and saw_stay and finished,"long journey arrives and completes actual service")
			check(largest<=1.01,"normal bounded walking throughout journey")
			check(int(b.get("_careProvided",{}).get("used",0))==1,"single bounded outcome")
			cases.append({"town":town,"job":job,"travel_budget_ticks":planned,"maximum_step":largest,"completed":finished})
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			for mode in ["missed_arrival","last_arrival","legacy"]:
				var pair: Dictionary=Fixture.prepare(app,town,job)
				var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
				var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
				for id in w.data.agents:
					if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
				SimResidentCare.tick(w);check(a.has("_careVisit"),"prepare boundary "+mode)
				var deadline: int=a._careVisit.travel_until;var overall: int=a._careVisit.until
				if mode=="missed_arrival":
					m.positions[pair.recipient].x=-16;m.positions[pair.recipient].y=-16
					w.data.tickCount=deadline+1;SimResidentCare.tick(w)
					check(not a.has("_careVisit") and "預留步行時間" in a._careVisitNotice,"missed arrival ends before total service deadline")
					check(not a.get("_careHolding",false) and not b.has("_careProvided"),"timeout grants no service or quota")
				elif mode=="last_arrival":
					w.data.tickCount=deadline;SimResidentCare.tick(w)
					check(a._careVisit.state=="visiting" and int(a._careVisit.finish)==deadline+2 and int(a._careVisit.until)==overall,"last allowed arrival still has full service window")
					w.data.tickCount=deadline+2;SimResidentCare.tick(w)
					check(not a.has("_careVisit") and a._careResults.back().state=="completed","inclusive arrival boundary can complete")
				else:
					a._careVisit.erase("travel_until");a._careVisit.until=int(w.data.tickCount)+8
					var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"legacy care deadline");w=app.simulation;a=w.data.agents[pair.recipient]
					check(not a._careVisit.has("travel_until"),"legacy reload does not invent an extension")
					w.data.tickCount=int(a._careVisit.until);SimResidentCare.tick(w)
					check(not a.has("_careVisit") and a._careResults.back().state=="cancelled","legacy absolute deadline still expires")
	var report:={"checks":checks,"failures":failures,"cases":cases,"scope":"two towns two roles, controlled fatigue and provider needs, real long map routes beyond old eight-tick total, actual simulation ticks/collision frames, mid-route reload, fixed deadlines, arrival-only care and single outcome; inclusive arrival boundary, missed arrival without reward and legacy deadline reload"}
	FileAccess.open("res://docs/CARE_JOURNEY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

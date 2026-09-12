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
			var key:="treated" if job=="doctor" else "counseled"
			for id in w.data.agents:
				if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
			var book:=SimCareers.book(w);var used: int=book.used;var completed: int=book.completed
			SimResidentCare.tick(w);check(a.has("_careVisit"),"needs create a request")
			SimResidentCare.apply(w,a,w.runtime[pair.recipient])
			for frame in 1500:
				m.update(w.data.agents)
				if not m.positions[pair.recipient].walking and m.positions[pair.recipient].get("doorPhase")==null: break
			w.data.tickCount+=1;SimResidentCare.tick(w)
			check(a._careVisit.state=="visiting","actual arrival starts service")
			var pending: Dictionary=a._careVisit.duplicate(true)
			var before: float=a.needs.rest if job=="doctor" else a.mood
			var mood_modifier: float=w.runtime[pair.recipient].moodModifier
			w.data.tickCount+=1;SimResidentCare.tick(w)
			check((float(a.needs.rest) if job=="doctor" else float(a.mood))==before,"no early settlement")
			w.data.tickCount+=1;SimResidentCare.tick(w)
			var after: float=a.needs.rest if job=="doctor" else a.mood
			check(is_equal_approx(after-before,15 if job=="doctor" else 8),"exact bounded effect")
			if job=="priest": check(is_equal_approx(w.runtime[pair.recipient].moodModifier-mood_modifier,8),"support survives mood recomputation")
			check(a._careResults.back().state=="completed" and a._careResults.back().amount==after-before,"truthful receipt")
			check(pair.recipient in book[key] and b._careProvided.used==1,"shared daily recipient ledger and provider quota")
			check(book.used==used and book.completed==completed,"NPC care does not award player career progress")
			check(not SimResidentCare.allowance(w,a,b,job),"repeat blocked")
			w.data.agents.player.jobKey=job
			check(SimCareers.available(w).all(func(task):return task.get("target","")!=pair.recipient),"NPC completion removes duplicate player service")
			var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"completed care reload");w=app.simulation;m=app.motion;w.social.observe_positions(m)
			a=w.data.agents[pair.recipient];b=w.data.agents[pair.provider];book=SimCareers.book(w)
			SimResidentCare.tick(w)
			check((float(a.needs.rest) if job=="doctor" else float(a.mood))==after and a._careResults.size()==1,"completed save does not replay")
			a._careVisit=pending;SimResidentCare.tick(w)
			check((float(a.needs.rest) if job=="doctor" else float(a.mood))==after and b._careProvided.used==1,"stale pending state cannot pay twice")
			book[key]=[];a.needs.rest=30;a.mood=-20;a.activity="idle";a.erase("_careVisitDay")
			b._careProvided.used=3
			check(not SimResidentCare.allowance(w,a,b,job),"provider stops at daily limit")
			b._careProvided.day-=1
			check(SimResidentCare.allowance(w,a,b,job),"next day refreshes provider allowance")
			book[key]=[pair.recipient]
			check(not SimResidentCare.allowance(w,a,b,job),"prior player service excludes NPC repeat")
			book[key]=[];b._careProvided.used=0;b._careProvided.day=SimClock.total_days(w.data.clock)
			SimResidentCare.tick(w);check(a.has("_careVisit"),"new controlled cancellation fixture")
			a.needs.hunger=5;SimResidentCare.tick(w)
			check(a._careResults.back().state=="cancelled" and a._careResults.back().amount==0 and b._careProvided.used==0,"cancelled service has no benefit or charge")
			for i in 12:
				a._careVisit=pending.duplicate(true);SimResidentCare.clear(a,"controlled cancel",w.data.tickCount)
			check(a._careResults.size()==8,"history storage is bounded")
			check(SimAgenda.routine(w,pair.recipient).any(func(row):return "求助中止" in row),"result visible in resident agenda")
	var report:={"checks":checks,"failures":failures,"scope":"both towns and care roles, real collision arrival, delayed bounded effect, shared recipient cap, provider quota, replay/reload, cancellation, bounded history and agenda; controlled demand"}
	FileAccess.open("res://docs/RESIDENT_CARE_OUTCOMES_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

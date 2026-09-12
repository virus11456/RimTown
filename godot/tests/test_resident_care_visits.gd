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
			for id in w.data.agents:
				if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
			var entrance: Variant=m.door(w.data.agents[pair.provider].currentLocation,pair.provider)
			var start: Vector2=m.layout._nearest(Vector2(entrance.x,entrance.y+16)) if entrance!=null else m.layout._nearest(m.layout._center(w.data.agents[pair.provider].currentLocation)+Vector2(0,32))
			m.positions[pair.recipient].x=start.x;m.positions[pair.recipient].y=start.y
			SimResidentCare.tick(w)
			check(a.has("_careVisit"),"eligible resident asks for help "+town+job)
			if not a.has("_careVisit"): continue
			check(not a.get("_careHolding",false),"request does not freeze or teleport")
			SimResidentCare.apply(w,a,w.runtime[pair.recipient])
			var previous:=Vector2(m.positions[pair.recipient].x,m.positions[pair.recipient].y);var steps:=0
			for frame in 3000:
				m.update(w.data.agents)
				var p: Dictionary=m.positions[pair.recipient];var now:=Vector2(p.x,p.y)
				check(now.distance_to(previous)<1.01,"bounded actual walking step")
				previous=now;steps+=1
				if not p.walking and p.get("doorPhase")==null: break
			w.data.tickCount+=1;SimResidentCare.tick(w);SimResidentCare.apply(w,a,w.runtime[pair.recipient])
			check(a.get("_careHolding",false),"arrived before conversation and stay")
			check(w.data.npcConversationLog.size()>0,"actual conversation recorded")
			Fixture.render(app);check(app.world_view.resident_care.pairs.has(pair.provider),"visit has care gesture")
			var saved:=w.snapshot();check(saved.agents[pair.recipient]._careVisit.state=="visiting","save preserves bounded visit")
			var rest: float=a.needs.rest;var balance: String=JSON.stringify(w.quest_balance)
			w.data.tickCount+=2;SimResidentCare.tick(w)
			check(not a.has("_careVisit") and not a.has("_careHolding"),"stay ends at deadline")
			check(a.needs.rest==rest+15 if job=="doctor" else a.needs.rest==rest,"completed visit applies only its care effect")
			SimResidentCare.tick(w);check(not a.has("_careVisit"),"daily retry cap")
			for reason in ["hunger","work","sleep","player","timeout","provider","raid","disabled"]:
				SimCareers.book(w).treated=[];SimCareers.book(w).counseled=[]
				a.erase("_careVisitDay");a.needs.hunger=80;a.needs.rest=30;a.mood=-20;a.activity="idle";a.jobKey="";b.activity="working"
				SimResidentCare.tick(w)
				check(a.has("_careVisit"),"prepare interruption "+reason)
				if reason=="hunger": a.needs.hunger=5
				if reason=="work": a.jobKey="guard"
				if reason=="sleep": a.activity="sleeping"
				if reason=="player": SimCareers.book(w).active={"target":pair.recipient}
				if reason=="timeout": w.data.tickCount+=8
				if reason=="provider": b.activity="heading_home"
				if reason=="raid": a._raidShelterUntil=999
				if reason=="disabled": w.social_enabled=false
				SimResidentCare.tick(w);check(not a.has("_careVisit"),"priority cancels "+reason)
				SimCareers.book(w).active={};a.erase("_raidShelterUntil");w.social_enabled=true
			cases.append({"town":town,"job":job,"walk_frames":steps})
	var report:={"checks":checks,"failures":failures,"cases":cases,"scope":"controlled need and clinic; actual route to provider, arrival, conversation, bounded stay, interruption, saved state and daily cap; bounded care, no goods or player career reward"}
	FileAccess.open("res://docs/RESIDENT_CARE_VISITS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

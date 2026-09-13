extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			for pace in ["original","relaxed"]:
				var pair: Dictionary=Fixture.prepare(app,town,job);app.set_clock_pace(pace)
				var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social.observe_positions(m)
				var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
				var goal:=SimResidentCare.meeting_goal(m,b)
				var duration:=SimResidentCare.travel_ticks(m,str(a.id),str(b.currentLocation),goal)+2
				var returning:=ceili(SimHangoutRoute.home_distance(m,a,str(b.currentLocation),goal)/m.travel_budget())+1
				var now:=int(w.data.tickCount)
				check(SimResidentCare.schedule_reason(w,a,b,duration,goal).is_empty(),"clear round trip fits "+town+job+pace)
				var appointment:={"npc":str(a.id),"state":"accepted","due":now+duration+34,"until":now+duration+40}
				w.quest_balance.appointments={"current":appointment}
				check(not SimAppointments.overlaps(w,str(a.id),now,now+duration+1) and returning>1,"appointment starts after treatment window")
				var before:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true)
				check("步行返家" in SimResidentCare.schedule_reason(w,a,b,duration,goal),"return leg protects accepted appointment")
				check(equal(before,w.snapshot()) and equal(positions,m.positions),"rejection does not consume quota move or rewrite appointment")
				app._load_document(JSON.stringify(app.progress_snapshot()),"return schedule reload");w=app.simulation;m=app.motion;a=w.data.agents[pair.recipient];b=w.data.agents[pair.provider]
				check("步行返家" in SimResidentCare.schedule_reason(w,a,b,duration,goal),"reload keeps return conflict")
				w.quest_balance.appointments.current.npc=str(b.id)
				check(SimResidentCare.schedule_reason(w,a,b,duration,goal).is_empty(),"provider released after treatment instead of patient return")
				w.quest_balance.appointments.current.npc=str(a.id);w.quest_balance.appointments.current.state="cancelled"
				check(SimResidentCare.schedule_reason(w,a,b,duration,goal).is_empty(),"cancelled appointment no longer blocks")
				w.quest_balance.appointments.current={}
				w.quest_balance.leisure_plans_enabled=true;w.quest_balance.leisure_plans={}
				w.quest_balance.leisure_plans[str(a.id)]={"state":"scheduled","hour":18,"day":SimTrace.day_key(w.data.clock),"place":str(b.currentLocation),"due":now+duration+18,"until":now+duration+24}
				check("步行返家" in SimResidentCare.schedule_reason(w,a,b,duration,goal),"return leg also protects leisure departure")
				app.active_tab="居民";app.show_care_availability(str(a.id));await settle()
				check(has_text(app.drawer_body,"步行返家"),"availability explains return conflict")
	var report:={"checks":checks,"failures":failures,"scope":"two towns, both care roles and clock paces; appointment and leisure return conflict, reload, provider release, cancellation, read-only rejection and real availability panel"}
	FileAccess.open("res://docs/CARE_RETURN_SCHEDULE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

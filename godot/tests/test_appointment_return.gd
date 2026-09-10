extends "res://tests/test_careers.gd"
func fixture() -> Dictionary:
	var w:=world();var layout:=TownLayout.new();layout.separate_civic_buildings=true;layout.rebuild(w.data)
	var m:=SimMotion.new();m.configure(layout);m.stable_routes=true;m.update(w.data.agents);w.social.observe_positions(m);w.quest_balance.hangout_safety_enabled=true
	var a: Dictionary=w.data.agents.chen_wei;a.jobKey="";a.personality.traits=[];a.needs.hunger=90;a.needs.rest=90
	return {"w":w,"m":m,"a":a}
func _initialize() -> void:
	var f:=fixture();var w: SimWorld=f.w;var a: Dictionary=f.a;var m: SimMotion=f.m
	var before:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true)
	check(not SimAppointments.free_hour(w,"chen_wei",18),"late meeting with full two-hour waiting allowance cannot fit return")
	SimAppointments.offer(w,"chen_wei");var meeting:=SimAppointments.current(w)
	check(meeting.get("state")=="offered" and int(meeting.hour)<18 and SimAppointments.free_hour(w,"chen_wei",int(meeting.hour)),"offer selects earlier valid time")
	check(equal(positions,m.positions) and equal(before.stockpile,w.data.stockpile),"planning neither moves anyone nor spends resources")
	a.homeLocation="missing_home"
	check(not SimAppointments.respond(w,true) and meeting.state=="cancelled" and "返家" in meeting.reason,"acceptance rechecks changed home route with truthful cancellation")
	f=fixture();w=f.w;a=f.a;m=f.m;SimAppointments.offer(w,"chen_wei");SimAppointments.respond(w,true);meeting=SimAppointments.current(w)
	var old_hour:=int(meeting.hour);a.personality.traits=["early_bird"];SimAppointments.tick(w)
	check(meeting.state=="change_offered" and int(meeting.proposal.hour)<old_hour,"changed sleep window proposes earlier replacement")
	check("返家" in meeting.reason and not SimAppointments.directing(w,"chen_wei"),"replacement explains return conflict and suspends old invitation")
	check(SimAppointmentChanges.respond(w,true) and meeting.state=="accepted" and int(meeting.reschedule_count)==1,"explicit consent accepts valid earlier replacement once")
	var stored:=w.snapshot();var restored:=SimWorld.new();restored.load_snapshot(stored);restored.social.observe_positions(m)
	check(equal(SimAppointments.current(restored),meeting) and SimAppointments.free_hour(restored,"chen_wei",int(meeting.hour)),"accepted replacement survives restored scene observation")
	check(not SimAppointments.reschedule(restored).ok,"shared one-change limit survives reload")
	f=fixture();w=f.w;a=f.a;m=f.m;SimAppointments.offer(w,"chen_wei");SimAppointments.respond(w,true);meeting=SimAppointments.current(w);a.homeLocation="missing_home"
	check(not SimAppointments.reschedule(w).ok and "返家" in SimAppointments.reschedule_error(w),"player postponement rejects invalid return")
	f=fixture();w=f.w;a=f.a;m=f.m;SimAppointments.offer(w,"chen_wei");SimAppointments.respond(w,true);meeting=SimAppointments.current(w);a.personality.traits=["early_bird"];SimAppointments.tick(w);a.homeLocation="missing_home"
	check(not SimAppointmentChanges.respond(w,true) and meeting.state=="cancelled","changed replacement route is rejected again at consent")
	f=fixture();w=f.w;a=f.a;m=f.m;SimAppointments.offer(w,"chen_wei");SimAppointments.respond(w,true);meeting=SimAppointments.current(w)
	w.data.tickCount=meeting.due;w.data.clock.hour=meeting.hour;w.data.clock.minute=0
	var point:=m.layout._nearest(m.layout._center("town_square"))
	for id in ["chen_wei","player"]:m.positions[id].x=point.x;m.positions[id].y=point.y
	positions=m.positions.duplicate(true);SimAppointments.observe(w,m)
	check(meeting.state=="met" and a.has("_hangoutHome"),"actual player encounter starts NPC return")
	check(not w.data.agents.player.has("_hangoutHome") and equal(positions,m.positions),"meeting leaves player control and all positions untouched")
	w._update("chen_wei");check(a.activity=="heading_home" and a.currentLocation==a.homeLocation,"NPC begins ordinary walking home after encounter")
	f=fixture();w=f.w;a=f.a;a.jobKey="mayor";SimAppointments.offer(w,"chen_wei")
	check(SimAppointments.current(w).is_empty() and not w.quest_balance.get("appointments",{}).has("last_offer_tick"),"full workday with no return window refuses offer without spending cooldown")
	f=fixture();w=f.w;SimAppointments.offer(w,"chen_wei");w.social.observed_motion=null
	check(not SimAppointments.respond(w,true),"missing scene observation at acceptance cannot invent return route")
	var report:={"checks":checks,"failures":failures,"scope":"controlled free-day NPC, full waiting window plus normal return, earlier offer, initial/replacement consent rechecks, player postponement, explicit NPC reschedule and shared limit, scene restore, actual close meeting and NPC-only return; not natural invitation frequency"}
	FileAccess.open("res://docs/APPOINTMENT_RETURN_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

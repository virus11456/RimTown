extends "res://tests/test_careers.gd"
func accepted() -> SimWorld:
	var w:=world();SimAppointments.offer(w,"chen_wei");SimAppointments.respond(w,true);return w
func _initialize() -> void:
	var w:=accepted();var a:=SimAppointments.current(w);var old_due:=int(a.due);var stock: Dictionary=w.data.stockpile.duplicate(true);var rels: Dictionary=w.data.agents.chen_wei.relationships.duplicate(true)
	check(SimAppointments.reschedule(w).ok,"valid request accepted by local schedule")
	check(int(a.due)==old_due+96 and int(a.until)==old_due+104 and a.state=="accepted","same appointment shifts exactly one day")
	check(a.time=="小鎮第 3 天 18:00" and a.previous_time=="小鎮第 2 天 18:00","calendar display follows new date")
	check(equal(stock,w.data.stockpile) and equal(rels,w.data.agents.chen_wei.relationships),"no resources or affinity from rescheduling")
	check(w.data.agents.player.memory.any(func(m): return "約定改期" in m.content) and w.data.agents.chen_wei.memory.any(func(m): return "約定改期" in m.content),"both remember new date")
	check(w.quest_balance.appointments.history.size()==1 and w.quest_balance.appointments.history[0].state=="rescheduled","old date retained in bounded history")
	var saved:=w.snapshot();check(not SimAppointments.reschedule(w).ok and equal(saved,w.snapshot()),"second click rejected without mutation")
	var restored:=SimWorld.new();restored.load_snapshot(saved)
	check(not SimAppointments.reschedule(restored).ok,"reload cannot reset reschedule limit")
	w.tick();restored.tick();check(equal(w.snapshot(),restored.snapshot()),"rescheduled next tick deterministic")
	w.data.tickCount=old_due;w.data.clock.hour=18
	check(not SimAppointments.directing(w,"chen_wei"),"old meeting time no longer routes NPC")
	SimAppointments.tick(w);check(a.state=="accepted","old meeting deadline cannot end new plan")
	w.data.tickCount=a.due;check(SimAppointments.directing(w,"chen_wei"),"new meeting time routes NPC")
	for field in ["late","waiting","offered","dead","need","job","venue","departed"]:
		w=accepted();a=SimAppointments.current(w)
		match field:
			"late": w.data.tickCount=int(a.due)-7
			"waiting": a.state="waiting"
			"offered": a.state="offered"
			"dead": w.data.agents.chen_wei.isDead=true
			"need": w.data.agents.chen_wei.needs.rest=0
			"job": w.data.agents.chen_wei.job={"work_hours":[0,23]}
			"venue": w.data.townMap.locations.erase(a.place)
			"departed": w.data.agents.erase("chen_wei")
		saved=w.snapshot();check(not SimAppointments.reschedule(w).ok and equal(saved,w.snapshot()),"invalid request atomic: "+field)
	w=accepted();a=SimAppointments.current(w);w.data.tickCount=int(a.due)-8
	w.data.agents.chen_wei._appointmentDestination="town_square"
	check(SimAppointments.reschedule(w).ok and not w.data.agents.chen_wei.has("_appointmentDestination"),"two-hour boundary allowed and old movement target cleared")
	SimAppointments.finish(w,"cancelled","玩家取消約定")
	saved=w.snapshot();check(not SimAppointments.reschedule(w).ok and equal(saved,w.snapshot()),"cancelled appointment cannot be revived")
	var report:={"checks":checks,"failures":failures,"scope":"one-day delay, two-hour cutoff, once per appointment, conflict rejection atomicity, date/memory/history, save limit and next-tick consistency, old/new destination windows; configured clock and conflict fixtures"}
	FileAccess.open("res://docs/APPOINTMENT_RESCHEDULE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

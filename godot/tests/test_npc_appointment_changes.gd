extends "res://tests/test_appointment_reschedule.gd"
func conflict() -> SimWorld:
	var w:=accepted()
	w.data.agents.chen_wei.job={"key":"mayor","title":"鎮長","work_hours":[9,19],"workplace":"town_hall"}
	SimAppointments.tick(w);return w
func _initialize() -> void:
	var w:=conflict();var a:=SimAppointments.current(w);var old_due:=int(a.due)
	check(a.state=="change_offered" and int(a.proposal.hour)==19,"work conflict proposes actual free hour")
	check(int(a.due)==144 and int(a.proposal.due)==244,"old date untouched until consent")
	check(not SimAppointments.directing(w,"chen_wei"),"suspended original does not direct movement")
	check(w.data.agents.player.chatHistory.back().get("_godotOffline",false),"NPC explains conflict using local dialogue")
	var saved:=w.snapshot();SimAppointments.tick(w);check(equal(saved,w.snapshot()),"same conflict does not repeat proposal or memories")
	var restored:=SimWorld.new();restored.load_snapshot(saved);check(equal(a,SimAppointments.current(restored)),"pending proposal survives reload")
	var stock: Dictionary=w.data.stockpile.duplicate(true)
	check(SimAppointmentChanges.respond(w,true),"explicit consent accepts alternative")
	check(a.state=="accepted" and int(a.due)==244 and int(a.reschedule_count)==1 and not a.has("proposal"),"consent installs new schedule once")
	check(equal(stock,w.data.stockpile),"reschedule creates no resources")
	check(not SimAppointments.reschedule(w).ok,"NPC change uses same one-change allowance")
	check(w.data.agents.player.memory.any(func(m): return "同意 NPC 改約" in m.content) and w.data.agents.chen_wei.memory.any(func(m): return "同意 NPC 改約" in m.content),"confirmed change in both memories")
	saved=w.snapshot();check(not SimAppointmentChanges.respond(w,true) and equal(saved,w.snapshot()),"duplicate acceptance atomic")
	SimAppointmentChanges.respond(restored,true);check(equal(w.snapshot(),restored.snapshot()),"accepting persisted proposal identical")
	w.tick();restored.tick();check(equal(w.snapshot(),restored.snapshot()),"accepted proposal next tick deterministic")
	w=conflict();a=SimAppointments.current(w);SimAppointmentChanges.respond(w,false)
	check(a.state=="cancelled" and int(a.due)==old_due,"reject cancels without silently rescheduling")
	w=conflict();a=SimAppointments.current(w);w.data.tickCount=a.proposal.expires
	check(not SimAppointmentChanges.respond(w,true) and a.state=="cancelled","deadline cannot be bypassed by acceptance")
	for fault in ["dead","venue","job","raid"]:
		w=conflict();a=SimAppointments.current(w)
		match fault:
			"dead": w.data.agents.chen_wei.isDead=true
			"venue": w.data.townMap.locations.erase(a.place)
			"job": w.data.agents.chen_wei.job.work_hours=[0,23]
			"raid": w.data.agents.chen_wei._raidShelterUntil=999
		check(not SimAppointmentChanges.respond(w,true) and a.state=="cancelled","revalidate before accepting: "+fault)
	w=accepted();w.data.agents.chen_wei.job={"work_hours":[0,23]};SimAppointments.tick(w)
	check(SimAppointments.current(w).state=="cancelled","no free slot means cancellation")
	w=accepted();SimAppointments.reschedule(w);w.data.agents.chen_wei.job={"work_hours":[9,19]};SimAppointments.tick(w)
	check(SimAppointments.current(w).state=="cancelled","used allowance cannot trigger another proposal")
	w=accepted();saved=w.snapshot();check(not SimAppointmentChanges.propose(w) and equal(saved,w.snapshot()),"no proposal without real work conflict")
	var report:={"checks":checks,"failures":failures,"scope":"configured work changes, pending proposal without implicit consent, suspended old route, local speech, shared cap, accept/reject/deadline/revalidation, memory and save determinism; no live AI"}
	FileAccess.open("res://docs/NPC_APPOINTMENT_CHANGES_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

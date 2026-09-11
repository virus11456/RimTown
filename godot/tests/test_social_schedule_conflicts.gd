extends "res://tests/test_hangout_visits.gd"
func player_booking(w: SimWorld,state: String="accepted",delay: int=40) -> void:
	w.quest_balance.appointments={"current":{"npc":"chen_wei","state":state,"due":int(w.data.tickCount)+delay,"until":int(w.data.tickCount)+delay+8},"history":[]}
func _initialize() -> void:
	for active in [false,true]:
		var w:=fixture();var token:=""
		if active: token=depart_pair(w)
		player_booking(w)
		var booking:=SimAppointments.current(w).duplicate(true);var stock: Dictionary=w.data.stockpile.duplicate(true);var relationships: Dictionary=w.data.agents.chen_wei.relationships.duplicate(true)
		w.runtime.chen_wei.targetLocation="park";w.runtime.lin_mei.targetLocation="park"
		SimHangoutSafety.tick(w)
		check(w.data.agents.chen_wei.get("_pendingHangout")==null and w.data.agents.lin_mei.get("_pendingHangout")==null,"both pending halves removed before player departure: "+str(active))
		check(not w.data.agents.chen_wei.has("_activeHangout") and not w.data.agents.lin_mei.has("_activeHangout"),"no stale active gathering continues: "+str(active))
		var reason: String=w.quest_balance.hangout_status.chen_wei.reason
		check("玩家約定" in reason and w.quest_balance.hangout_status.lin_mei.reason==reason,"both residents show the same concrete conflict: "+str(active))
		for id in ["chen_wei","lin_mei"]:
			check(w.data.agents[id].memory.filter(func(row): return "同行安排未完成" in row.content and reason in row.content).size()==1,"one factual cancellation memory: "+id+str(active))
		check(equal(booking,SimAppointments.current(w)) and equal(stock,w.data.stockpile) and equal(relationships,w.data.agents.chen_wei.relationships),"confirmed player booking and resources/affinity preserved: "+str(active))
		if active: check(w.runtime.chen_wei.targetLocation==null and w.runtime.lin_mei.targetLocation==null and SimHangoutVisits.records(w)[token].state=="cancelled","active cancellation clears old destination commands")
		var saved:=w.snapshot();SimHangoutSafety.tick(w);SimHangoutSafety.cancel(w,"chen_wei","duplicate")
		check(equal(saved,w.snapshot()),"repeat callbacks do not duplicate memories: "+str(active))
		var restored:=SimWorld.new();restored.load_snapshot(saved);SimHangoutSafety.tick(restored)
		check(equal(saved,restored.snapshot()),"reload preserves terminal reason without replay: "+str(active))
	for state in ["offered","change_offered","declined","missed"]:
		var w:=fixture();player_booking(w,state);SimHangoutSafety.tick(w)
		check(w.data.agents.chen_wei.get("_pendingHangout") is Dictionary,"unconfirmed or ended player booking does not cancel gathering: "+state)
	var w:=fixture();player_booking(w,"accepted",56)
	check(not SimAppointments.overlaps(w,"chen_wei",0,24) and not SimAppointments.overlaps(w,"lin_mei",0,80),"touching time boundary and other resident are not overlap")
	SimHangoutSafety.tick(w);check(w.data.agents.chen_wei.get("_pendingHangout") is Dictionary,"nonoverlapping future booking keeps gathering")
	w=fixture();w.data.agents.lin_mei._pendingHangout.issued_tick+=1
	SimHangoutSafety.cancel(w,"chen_wei","舊安排失效")
	check(w.data.agents.lin_mei._pendingHangout is Dictionary and not w.data.agents.lin_mei.memory.any(func(row): return "同行安排未完成" in row.content),"different peer arrangement cannot be cancelled or receive false memory")
	w=fixture();var token:=depart_pair(w);var record: Dictionary=SimHangoutVisits.records(w)[token]
	w.data.tickCount=record.until;SimHangoutVisits.tick(w)
	check(record.state=="missed" and w.data.agents.chen_wei.memory.any(func(row): return record.reason in row.content) and w.data.agents.lin_mei.memory.any(func(row): return record.reason in row.content),"missed physical gathering records same factual outcome for both")
	var report:={"checks":checks,"failures":failures,"scope":"pending and departed NPC pair vs confirmed future player interval, both memories/reasons, no reward/deadline mutation, old command cleanup, terminal replay/reload, proposal vs consent, exact boundary, unrelated peer and missed gathering"}
	FileAccess.open("res://docs/SOCIAL_SCHEDULE_CONFLICTS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

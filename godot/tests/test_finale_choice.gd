extends "res://tests/test_careers.gd"
func finale_world() -> SimWorld:
	var w:=world();w.quests_enabled=true;w.finale_choice_enabled=true;SimQuests.init(w)
	w.data.questSystem.quests.ch1_settle.status="locked";w.data.questSystem.quests.ch5_legacy.status="active"
	var def: Dictionary=SimQuests.rules().main.back()
	for route in def.routes:
		for c in route.conditions: w.data.questSystem.quests.ch5_legacy.routes[route.id][c.label]={"progress":c.target,"completed":true}
	return w
func _initialize() -> void:
	for route in ["prosper","peace","legend"]:
		var w:=finale_world();SimQuests.check_progress(w)
		check(w.data.multiEnding.get("endingTriggered")==null,"no automatic ending while choices ready")
		check(SimQuests.finale_ready(w,route),"latched route selectable")
		var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());check(restored.finale_choice_enabled and SimQuests.finale_ready(restored,route),"pending choice persists")
		check(SimQuests.choose_finale(w,route) and w.data.multiEnding.endingTriggered==route,"chosen ending "+route)
		var saved:=w.snapshot();check(not SimQuests.choose_finale(w,route) and equal(saved,w.snapshot()),"no repeated finale reward")
		var frozen: Dictionary=w.data.multiEnding.endingData.duplicate(true);w.data.stockpile.resources.silver+=1
		check(equal(frozen,w.data.multiEnding.endingData),"ending stats remain frozen")
	var w:=finale_world();w.data.agents.player.relationships.lin_mei={"targetName":"林美","affinity":80,"romanticInterest":80,"status":"married"}
	check(SimQuests.choose_finale(w,"peace") and w.data.multiEnding.endingTriggered=="personal","marriage override preserved")
	w=finale_world();w.data.agents.player.relationships.lin_mei={"targetName":"林美","affinity":80,"romanticInterest":80,"status":"married"}
	check(SimQuests.choose_finale(w,"legend") and w.data.multiEnding.endingTriggered=="legend","legend keeps precedence over marriage")
	w=finale_world();w.data.questSystem.quests.ch5_legacy.routes.legend.values()[0].completed=false
	var saved:=w.snapshot();check(not SimQuests.choose_finale(w,"legend") and equal(saved,w.snapshot()),"unearned route rejected atomically")
	check(not SimQuests.choose_finale(w,"fake"),"unknown route rejected")
	w=finale_world();w.finale_choice_enabled=false;SimQuests.check_progress(w);check(w.data.multiEnding.endingTriggered=="prosper","source compatibility auto ending retained")
	for key in ["watchtower","garden"]:
		w=world();w.quests_enabled=true;SimQuests.init(w);SimQuestWorld.prosperity(w)
		var dimension: String="defense" if key=="watchtower" else "beauty";var value: float=w.data.prosperity.dimensions[dimension].value
		var p:=SimBuildings.start(w,key);check(not p.is_empty(),"normal paid building starts")
		for i in 30: SimBuildings.daily(w)
		check(w.data.buildings.completed.any(func(b): return b.get("buildingKey")==key),"real building finishes")
		w.data.clock.day+=1;SimQuestWorld.prosperity(w)
		check(w.data.prosperity.dimensions[dimension].value>value,"native building contributes to "+dimension)
	var report:={"checks":checks,"failures":failures,"scope":"explicit finale choice, latched condition fixtures, all routes/marriage/reload/frozen stats, source compatibility, real paid completed buildings counted in prosperity; not natural all endings"}
	FileAccess.open("res://docs/FINALE_CHOICE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

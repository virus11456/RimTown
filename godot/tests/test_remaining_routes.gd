extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var source := FileAccess.get_file_as_string("res://tests/main-route-ready.json.tmp")
	check(not source.is_empty(), "130-day earned checkpoint exists")
	if source.is_empty(): quit(1);return
	var results: Array=[]
	for route in ["prosper", "peace"]:
		var w:=SimWorld.new();w.load_snapshot(JSON.parse_string(source))
		var ready:=SimQuests.finale_ready(w,route)
		check(ready,route+" earned without injected resources or relationships")
		var details:={"route":route,"ready":ready,"additional_days":0,"conversations":0,"silver":SimEconomy.amount(w,"silver"),"population":w.data.agents.size(),"average_affinity":SimQuests.evaluate(w,{"type":"avg_affinity"}),"friends":SimQuests.evaluate(w,{"type":"friends_count"})}
		if ready:
			var archive:=SaveArchive.encode(JSON.stringify(w.snapshot()))
			var path: String="res://../../../outputs/三路線結局前.rimtown"
			var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(archive);file.close()
			var decoded:=SaveArchive.decode(FileAccess.get_file_as_bytes(path))
			check(decoded.ok,route+" compressed checkpoint is readable")
			var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(decoded.text))
			check(SimQuests.finale_ready(restored,route),route+" ready after archive reload")
			check(SimQuests.choose_finale(restored,route) and restored.data.multiEnding.endingTriggered==route,route+" chosen ending matches")
			var frozen: Dictionary=restored.data.multiEnding.endingData.duplicate(true)
			for i in 96: restored.tick()
			check(equal(frozen,restored.data.multiEnding.endingData),route+" ending record frozen after continued play")
			var next:=SimWorld.new();next.load_snapshot(restored.snapshot())
			restored.tick();next.tick()
			check(equal(restored.snapshot(),next.snapshot()),route+" continued reload preserves deterministic next tick")
		results.append(details)
	var report:={"checks":checks,"failures":failures,"routes":results,"scope":"Branches already earned in the existing 130-day checkpoint; no additional conversations or condition/stock/relationship injection. Simulation API validation, not rendered walking. Personal marriage ending still excluded."}
	FileAccess.open("res://docs/REMAINING_ROUTES_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

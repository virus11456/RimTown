extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	for c in JSON.parse_string(FileAccess.get_file_as_string("res://tests/quests/world-oracle.json")):
		var w:=SimWorld.new();w.load_snapshot(c.input);w.quests_enabled=true;w.rng.state=11456;SimQuests.init(w)
		w.data.council._daysSinceCouncilCheck=4
		SimQuestWorld.daily(w)
		var actual: Dictionary=w.data.prosperity.duplicate(true)
		check(equal(actual,c.prosperity),"source prosperity dimensions and cap")
		check(equal(w.data.council.members,c.members),"source council ranking")
		check(w.rng.state==int(c.rng),"council RNG")
		var value: float=w.data.prosperity.prosperity;SimQuestWorld.daily(w);check(w.data.prosperity.prosperity==value,"one prosperity update per day")
	var report:={"checks":checks,"failures":failures,"scope":"8 original prosperity snapshots and council member formation with deterministic ranking; council proposals and lifecycle not included"}
	FileAccess.open("res://docs/QUEST_WORLD_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/economy/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=int(c.seed)
		SimEconomy.daily(w)
		check(equal(w.data.stockpile,c.stock),c.mode+" stock ledger")
		check(equal(w.data.agents,c.agents),c.mode+" agents")
		check(equal(w.data.messageLog,c.logs),c.mode+" logs")
		check(w.rng.state==int(c.rng),c.mode+" RNG")
		for id in c.moods: check(equal(w.runtime[id].moodModifier,c.moods[id]),c.mode+" mood "+id)
	var report:={"checks":checks,"failures":failures,"scope":"56 original processDailyProduction cases: seasons, work policy, shortage, spoilage, modifiers, exact stock ledger/agents/logs/mood/RNG"}
	FileAccess.open("res://docs/ECONOMY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

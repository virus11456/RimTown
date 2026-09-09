extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/research/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input)
		for i in 120:
			if i==2: SimResearch.start(w,"commerce")
			SimResearch.daily(w)
		check(equal(w.data.research,c.research),"research progression")
		check(equal(w.data.stockpile,c.stock),"stock ledger")
		check(equal(w.data.buildings,c.buildings),"effects")
		check(equal(w.data.messageLog,c.logs),"logs")
		for id in c.moods: check(equal(w.runtime[id].moodModifier,c.moods[id]),"mood")
	var report:={"checks":checks,"failures":failures,"scope":"six 120-day source research scenarios: switching, prerequisites, automatic selection, research stock use, news bonus, completion effects and mood"}
	FileAccess.open("res://docs/RESEARCH_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

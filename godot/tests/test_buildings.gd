extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/buildings/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input)
		for id in c.moods: w.runtime[id].moodModifier=c.moods[id]
		SimBuildings.start(w,c.key,int(c.stage)>1)
		for i in 20: SimBuildings.daily(w)
		check(equal(w.data.buildings,c.buildings),c.key+" building state")
		check(equal(w.data.stockpile,c.stock),c.key+" stock ledger")
		check(equal(w.data.dailyNews,c.news),c.key+" news material")
		check(equal(w.data.messageLog,c.logs),c.key+" logs")
		for id in c.afterMoods: check(equal(w.runtime[id].moodModifier,c.afterMoods[id]),c.key+" mood")
	var report:={"checks":checks,"failures":failures,"scope":"all source templates across levels 1–3, payment, construction, completion, cumulative effects, mood and news collection; combo and AI comments excluded"}
	FileAccess.open("res://docs/BUILDINGS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/industry/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input)
		for key in c.keys:
			SimIndustry.choose(w,key)
			for i in int(c.level)-1: SimIndustry.upgrade(w,key)
		SimIndustry.daily(w)
		check(equal(w.data.industry,c.industry),"industry state "+str(cases.find(c)))
		check(equal(w.data.stockpile,c.stock),"ledger and outputs")
		check(equal(w.data.messageLog,c.logs),"logs")
		check(equal(w.data.dailyNews,c.news),"news material")
	var report:={"checks":checks,"failures":failures,"scope":"300 original industry scenarios including no workers, sidelined workers and town promotion: all 15 combinations and levels 1–5, choose/upgrade cost, worker efficiency, synergy output, exact state/stock/logs/news"}
	FileAccess.open("res://docs/INDUSTRY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

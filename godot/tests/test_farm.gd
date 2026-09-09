extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/farm/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input)
		for step in c.steps:
			var result:=false
			match step.fn:
				"daily": SimFarm.daily(w);continue
				"season": w.data.clock.season=step.value;continue
				"tillPlot": result=SimFarm.till(w,int(step.args[0]))
				"plantCrop": result=SimFarm.plant(w,int(step.args[0]),step.args[1])
				"waterPlot": result=SimFarm.water(w,int(step.args[0]))
				"fertilizePlot": result=SimFarm.fertilize(w,int(step.args[0]))
				"harvestPlot": result=SimFarm.harvest(w,int(step.args[0]))
				"clearWithered": result=SimFarm.clear(w,int(step.args[0]))
			check(result==step.result,"action "+str(step.fn))
		check(equal(w.data.farm,c.farm),"farm state "+str(cases.find(c)))
		check(equal(w.data.stockpile,c.stock),"stock and ledger")
		check(equal(w.data.messageLog,c.logs),"logs")
		check(equal(w.data.dailyNews,c.news),"news")
	var report:={"checks":checks,"failures":failures,"scope":"78 original crop scenarios: all 13 crops, care, rotation, neglect, seasonal withering, mood penalty, harvest and clearing"}
	FileAccess.open("res://docs/FARM_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

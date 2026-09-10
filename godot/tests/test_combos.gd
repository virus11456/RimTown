extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/combos/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input)
		check(equal(SimCombos.active(w.data),c.active),"active anchor distance")
		SimCombos.check_new(w);SimCombos.check_new(w);var parts: Array=w.data.decorations;w.data.decorations=[];SimCombos.check_new(w);w.data.decorations=parts;SimCombos.check_new(w)
		check(equal(w.data.combosFound,c.found),"discovered once")
		check(equal(w.data.messageLog,c.logs),"discovery logs")
		check(equal(w.data.dailyNews,c.news),"news")
		for id in c.moods: check(equal(w.runtime[id].moodModifier,c.moods[id]),"one-time mood")
	var w:=SimWorld.new();w.load_snapshot(cases[0].input);w.combos_enabled=true;w.data.combosFound=[];w.data.decorations=[{"type":"bench","x":21,"y":21}]
	for r in w.data.stockpile.resources: w.data.stockpile.resources[r]=10000
	var project:=SimBuildings.start(w,"school");project.siteX=20;project.siteY=20;project.workDone=project.workRequired;SimBuildings.daily(w)
	check("scholar_path" in w.data.combosFound,"completion detects combo automatically")
	var before: int=w.combo_notifications.size();project=SimBuildings.start(w,"school",true);project.workDone=project.workRequired;SimBuildings.daily(w)
	check(w.combo_notifications.size()==before,"upgrade cannot repeat discovery")
	var report:={"checks":checks,"failures":failures,"scope":"48 original decoration/building cases across 8 combos, distance 0/4/5, anchor geometry, discovery/recheck/remove/rebuild, logs/news/mood; AI callback omitted"}
	FileAccess.open("res://docs/COMBO_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

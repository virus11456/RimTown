extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var fixture: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/quests/oracle.json"))
	for c in fixture.cases:
		var w:=SimWorld.new();w.load_snapshot(c.input);w.quests_enabled=true;w.rng.state=11456
		for i in 8:
			if c.mode=="main": SimQuests.check_progress(w)
			else: SimNPCQuests.check_progress(w)
		for key in c.expected:
			check(equal(w.data[key],c.expected[key]),str(c.mode)+" "+key)
			if not equal(w.data[key],c.expected[key]): FileAccess.open("/private/tmp/quest-diff-"+str(c.mode)+"-"+key+".json",FileAccess.WRITE).store_string(JSON.stringify({"actual":w.data[key],"expected":c.expected[key]}))
		for id in c.moods: check(equal(w.runtime[id].moodModifier,c.moods[id]),"mood "+id)
		check(w.rng.state==int(c.rng),"rng")
	var w:=SimWorld.new();w.load_snapshot(fixture.conditionInput);SimQuests.init(w)
	for entry in fixture.evaluated:
		check(equal(SimQuests.evaluate(w,entry.cond),entry.main),"main condition "+str(entry.cond))
		check(equal(SimQuests.evaluate(w,entry.cond,true),entry.npc),"NPC condition "+str(entry.cond))
	var report:={"checks":checks,"failures":failures,"scope":"source main/side/daily/story and NPC progression across 10 worlds plus all exported conditions; independent ending validation"}
	FileAccess.open("res://docs/QUEST_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

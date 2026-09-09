extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/player_whisper/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input)
		var seed:=w.rng.state
		for i in int(c.repeat): SimPlayerWhisper.apply(w,"chen_wei",c.text)
		check(equal(w.data.agents.chen_wei,c.agent),"NPC memory and target relationship")
		check(equal(w.data.agents.player,c.player),"player history")
		check(equal(w.data.playerActions,c.actions),"action snapshots")
		check(equal(w.data.messageLog,c.logs),"whisper logs")
		check(w.rng.state==seed,"no random draw")
	var report:={"checks":checks,"failures":failures,"scope":"12 original playerWhisper + offline plantWhisper cases; exact state, history, action records and logs; replan callback excluded"}
	FileAccess.open("res://docs/PLAYER_WHISPER_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

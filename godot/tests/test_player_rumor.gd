extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/player_rumor/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=int(c.seed)
		var result:=SimPlayerRumor.send(w,"chen_wei","lin_mei",c.tone)
		check(result.ok,"send success")
		check(equal(w.data.agents,c.agents),"original agents")
		check(equal(w.data.gossip,c.gossip),"original gossip")
		check(equal(w.data.messageLog,c.logs),"original logs")
		check(w.data._godot4a.last_rumor_day==c.day and w.rng.state==int(c.rng),"day and random state")
		var saved:=w.snapshot()
		check(not SimPlayerRumor.send(w,"chen_wei","lin_mei",c.tone).ok and equal(w.snapshot(),saved),"repeat blocked without mutation")
		var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(saved,"",false,true)))
		check(not SimPlayerRumor.available(restored),"day limit restored")
		restored.data.clock.day+=1;check(SimPlayerRumor.available(restored),"next day unlocked")
	var report:={"checks":checks,"failures":failures,"scope":"36 original _sendRumor cases: three tones, trait precedence, seeded pairing, exact agents/gossip/logs/RNG plus persistent daily guard"}
	FileAccess.open("res://docs/PLAYER_RUMOR_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

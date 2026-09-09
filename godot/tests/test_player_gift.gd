extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/player_gift/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=11456
		check(SimPlayerGift.send(w,"chen_wei",c.key).ok,"send")
		check(equal(w.data.agents,c.agents),"agents")
		check(equal(w.data.stockpile,c.stock),"stock and ledger")
		check(equal(w.data.playerActions,c.actions),"actions")
		check(equal(w.data.messageLog,c.logs),"logs")
		check(w.rng.state==int(c.rng),"RNG")
		var saved:=w.snapshot()
		check(not SimPlayerGift.send(w,"chen_wei",c.key).ok and equal(saved,w.snapshot()),"daily guard atomic")
		var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(saved,"",false,true)))
		check(not SimPlayerGift.available(restored,"chen_wei"),"daily guard restored")
		restored.data.clock.day+=1;check(SimPlayerGift.available(restored,"chen_wei"),"next day available")
	var report:={"checks":checks,"failures":failures,"scope":"70 original _giveGift cases: five resources, seven jobs, preference and caps, exact agents/stock ledger/actions/logs/RNG; saved daily guard; first-day and heart callbacks excluded"}
	FileAccess.open("res://docs/PLAYER_GIFT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

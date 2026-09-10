extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	for c in JSON.parse_string(FileAccess.get_file_as_string("res://tests/births/oracle.json")):
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=int(c.seed)
		var a: Dictionary=w.data.agents.player if c.player else w.data.agents.chen_wei
		var child:=SimBirths.birth(w,a,w.data.agents.lin_mei,c.player)
		check(equal(child,c.expected.agents[child.id]),"original child constructor")
		for key in ["lifecycle","gossip","messageLog","dailyNews"]: check(equal(w.data[key],c.expected[key]),"original "+key)
		for id in w.data.agents:
			check(equal(w.data.agents[id].memory,c.expected.agents[id].memory),"memory "+id)
			check(equal(w.data.agents[id].relationships,c.expected.agents[id].relationships),"relationship "+id)
			check(equal(w.runtime[id].moodModifier,c.moods[id]),"mood "+id)
		check(w.rng.state==int(c.rng),"exact constructor RNG")
		var second:=SimBirths.birth(w,a,w.data.agents.lin_mei,c.player)
		check(second.id!=child.id and w.data.agents.has(child.id),"same tick unique child id")
	var report:={"checks":checks,"failures":failures,"scope":"10 original birth scenarios, child skills/attributes/inheritance, parents, memories/mood/gossip/news, player children and RNG; unique ID guard"}
	FileAccess.open("res://docs/BIRTH_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends SceneTree
var failures: Array[String]=[]
var checks:=0
func equal(actual: Variant,expected: Variant,path: String) -> void:
	if failures.size()>30: return
	if (actual is float or actual is int) and (expected is float or expected is int):
		if absf(float(actual)-float(expected))>0.0000001: failures.append(path+": %s != %s"%[actual,expected])
	elif actual is Dictionary and expected is Dictionary:
		for key in expected: equal(actual.get(key),expected[key],path+"/"+key)
	elif actual!=expected: failures.append(path+": %s != %s"%[actual,expected])
func _initialize() -> void:
	for theme in ["frontier","harbor"]:
		var fixture: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/phase4a/"+theme+".json"))
		var world:=SimWorld.new()
		world.load_snapshot(fixture.input)
		world.rng.state=int(fixture.seed)
		var index:=0
		for i in 2880:
			world.tick()
			if i+1==int(fixture.checkpoints[index].tick):
				var expected: Dictionary=fixture.checkpoints[index]
				equal(world.data.clock,expected.clock,theme+"/%d/clock"%[i+1])
				equal(world.rng.state,expected.rng,theme+"/%d/rng"%[i+1])
				equal(world.data.agents,expected.agents,theme+"/%d/agents"%[i+1])
				checks+=1
				index+=1
				if failures.size()>0: break
	var report:={"checkpoints":checks,"ticks_per_town":2880,"failures":failures,"scope":"Phase 4a agent update; no economy, relationships, quests, events or LLM effects"}
	FileAccess.open("res://docs/PHASE4A_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

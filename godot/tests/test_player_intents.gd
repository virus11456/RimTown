extends SceneTree
var failures: Array=[]
var checks:=0
func equal(a: Variant,b: Variant) -> bool:
	if (a is float or a is int) and (b is float or b is int): return absf(float(a)-float(b))<.00000001
	if a is Dictionary and b is Dictionary:
		if a.size()!=b.size(): return false
		for key in a:
			if not b.has(key) or not equal(a[key],b[key]): return false
		return true
	if a is Array and b is Array:
		if a.size()!=b.size(): return false
		for i in a.size():
			if not equal(a[i],b[i]): return false
		return true
	return a==b
func check(value: bool,message: String) -> void:
	checks+=1
	if not value and failures.size()<30: failures.append(message)
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/player_intents/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input)
		for i in int(c.repeat): SimPlayerInteraction.apply_intent(w.data.agents.chen_wei,w,c.key)
		check(equal(w.data.agents.chen_wei,c.agent),c.key+" state")
		check(equal(w.data.agents.player,c.player),c.key+" player history")
		check(w.rng.state==int(c.rng),c.key+" RNG")
		check(equal(w.data.playerActions,c.actions),"action history")
		check(equal(w.runtime.chen_wei.moodModifier,c.mood),"mood")
	var report:={"checks":checks,"failures":failures,"scope":"96 original _applyChatIntent cases: gossip filtering and RNG, flirt/request thresholds, relationship caps, thought refresh, memory and action history"}
	FileAccess.open("res://docs/PLAYER_INTENTS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

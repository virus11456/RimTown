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
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/player_interaction/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input)
		for i in int(c.repeat): SimPlayerInteraction.comfort(w.data.agents.chen_wei,w)
		check(equal(w.data.agents.chen_wei,c.agent),"comfort state")
		check(equal(w.data.playerActions,c.actions),"action history")
		check(equal(w.runtime.chen_wei.moodModifier,c.mood),"mood")
	var report:={"checks":checks,"failures":failures,"scope":"24 original _applyChatIntent comfort cases; need/affinity caps, repeat thought refresh and action history"}
	FileAccess.open("res://docs/PLAYER_INTERACTION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

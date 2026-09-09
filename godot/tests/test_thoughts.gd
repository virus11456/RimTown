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
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/thoughts/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input);w.thoughts_enabled=true
		for checkpoint in c.checkpoints:
			for i in 96: w.data.tickCount+=1;SimClock.tick(w.data.clock)
			var rng_before:=w.rng.state
			SimThoughts.daily(w)
			check(w.rng.state==rng_before,c.kind+"/no random draws")
			check(equal(w.data.clock,checkpoint.clock),c.kind+"/clock")
			for id in checkpoint.agents:
				for key in ["thoughts","relationships"]: check(equal(w.data.agents[id][key],checkpoint.agents[id][key]),c.kind+"/"+str(checkpoint.day)+"/"+id+"/"+key)
			var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
			SimThoughts.daily(w);SimThoughts.daily(resumed)
			check(equal(w.snapshot(),resumed.snapshot()),c.kind+"/resume")
			# Restore checkpoint world: this extra daily call only verifies resume.
			for id in checkpoint.agents:
				w.data.agents[id].thoughts=checkpoint.agents[id].thoughts.duplicate(true) if checkpoint.agents[id].thoughts is Array else null
				w.data.agents[id].relationships=checkpoint.agents[id].relationships.duplicate(true)
	var report:={"checks":checks,"failures":failures,"scope":"original thought expiry/opinion, stacking, missing targets, player/dead exclusions, season/year rollover and JSON resume"}
	FileAccess.open("res://docs/THOUGHTS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

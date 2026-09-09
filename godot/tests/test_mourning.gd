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
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/mourning/oracle.json"))
	for i in cases.size():
		var c: Dictionary=cases[i]
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=int(c.seed)
		for step in c.steps:
			w.data.clock.year=step.year
			for tick in 32: SimMourning.process(w.data.agents.chen_wei,w)
			for field in ["agents","messageLog"]: check(equal(w.data[field],step[field]),str(i)+"/"+str(step.year)+"/"+field)
			check(equal(w.runtime.chen_wei.moodModifier,step.mood),str(i)+"/mood")
			check(w.rng.state==int(step.rng),str(i)+"/rng")
	var report:={"checks":checks,"failures":failures,"scope":"192 original JS scenarios across two years; recent FIFO, friend/family, duplicate annual name, visited/overdue annual entries, empty queues, needs cap, unknown fields, memories and RNG"}
	FileAccess.open("res://docs/MOURNING_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

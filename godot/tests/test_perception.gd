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
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/perception/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=int(c.seed)
		for phase in 3:
			if phase==2: w.data.clock.day+=1
			for i in 400: w.data.tickCount+=1;SimPerception.process(w.data.agents.chen_wei,w)
			var expected: Dictionary=c.steps[phase]
			check(equal(w.data.agents.chen_wei.memory,expected.memory),c.kind+"/memory")
			check(w.runtime.chen_wei.get("obs_day","")==expected.day,c.kind+"/day")
			check(w.runtime.chen_wei.get("obs_count",0)==expected.count,c.kind+"/cap")
			check(w.rng.state==int(expected.rng),c.kind+"/rng")
	var report:={"checks":checks,"failures":failures,"scope":"80 original JS scenarios across daily cap and next day; four-tick gating, sleeping/self/dead/player/location exclusions, plan steps, multiple candidates and RNG"}
	FileAccess.open("res://docs/PERCEPTION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

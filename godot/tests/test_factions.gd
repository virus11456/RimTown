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
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/factions/oracle.json"))
	for i in cases.size():
		var c: Dictionary=cases[i]
		var w:=SimWorld.new();w.load_snapshot(c.input);w.factions_enabled=true;w.rng.state=int(c.seed)
		for day in 30:
			w.data.tickCount+=96
			for tick in 96: SimClock.tick(w.data.clock)
			if c.kind=="events": SimFactions._events(w,w.data.factions.factions)
			else: SimFactions.daily(w)
		var tag:="%d/%s"%[i,c.kind]
		check(w.rng.state==int(c.rng),tag+"/rng")
		for key in ["factions","events","gossip","messageLog"]: check(equal(w.data[key],c.expected[key]),tag+"/"+key)
		for id in c.expected.agents:
			check(equal(w.runtime[id].moodModifier,c.expected.agents[id].moodModifier),tag+"/mood/"+id)
			for key in ["relationships","memory"]: check(equal(w.data.agents[id][key],c.expected.agents[id][key]),tag+"/"+id+"/"+key)
		var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
		for day in 12:
			w.data.tickCount+=96;resumed.data.tickCount+=96
			for tick in 96: SimClock.tick(w.data.clock);SimClock.tick(resumed.data.clock)
			SimFactions.daily(w);SimFactions.daily(resumed)
		check(equal(w.snapshot(),resumed.snapshot()),tag+"/resume")
	var report:={"checks":checks,"failures":failures,"scope":"FactionSystem formation, events, dedupe, cohesion, leaving, cleanup and JSON resume against original JS"}
	FileAccess.open("res://docs/FACTIONS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

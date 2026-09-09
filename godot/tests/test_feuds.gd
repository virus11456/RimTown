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
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/feuds/oracle.json"))
	for i in cases.size():
		var c: Dictionary=cases[i]
		var w:=SimWorld.new();w.load_snapshot(c.input);w.feuds_enabled=true;w.rng.state=int(c.seed)
		var day:=0
		for checkpoint in c.checkpoints:
			while day<int(checkpoint.day):
				for j in 96: w.data.tickCount+=1;SimClock.tick(w.data.clock)
				SimFeuds.process(w);day+=1
			var tag:="%d/%s/%d"%[i,c.kind,day]
			check(w.rng.state==int(checkpoint.rng),tag+"/rng")
			for key in ["clock","feudCooldown","messageLog"]: check(equal(w.data[key],checkpoint[key]),tag+"/"+key)
			for id in checkpoint.agents:
				var expected: Dictionary=checkpoint.agents[id]
				check(equal(w.runtime[id].moodModifier,expected.moodModifier),tag+"/mood/"+id)
				for key in ["relationships","memory"]: check(equal(w.data.agents[id][key],expected[key]),tag+"/"+id+"/"+key)
		var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
		for day_index in 10:
			for j in 96:
				w.data.tickCount+=1;resumed.data.tickCount+=1;SimClock.tick(w.data.clock);SimClock.tick(resumed.data.clock)
			SimFeuds.process(w);SimFeuds.process(resumed)
		check(equal(w.snapshot(),resumed.snapshot()),"resume "+str(i))
	var report:={"checks":checks,"failures":failures,"scope":"original feud thresholds, witnesses, cooldown and seasonal/year rollover; source oracle and JSON resume"}
	FileAccess.open("res://docs/FEUDS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

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
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/stargazing/oracle.json"))
	var discoveries: Dictionary={};var bonds:=0
	for i in cases.size():
		var c: Dictionary=cases[i]
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=int(c.seed)
		for tick in 16: SimStargazing.process(w.data.agents.chen_wei,w)
		for field in ["agents","events","messageLog"]: check(equal(w.data[field],c.expected[field]),str(i)+"/"+field)
		for id in c.mood: check(equal(w.runtime[id].moodModifier,c.mood[id]),str(i)+"/mood/"+id)
		check(w.rng.state==int(c.rng),str(i)+"/rng")
		for event in w.data.messageLog:
			if event.type=="discovery": discoveries[event.content]=true
			if event.type=="social": bonds+=1
	check(discoveries.size()==4,"all four discoveries covered")
	check(bonds>0,"bonding covered")
	var report:={"checks":checks,"failures":failures,"scope":"336 original JS scenarios, 16 calls each; solo, companions, location/activity exclusion, traits, affinity thresholds, caps, all discoveries, memories, topics and RNG"}
	FileAccess.open("res://docs/STARGAZING_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

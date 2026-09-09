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
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/romance/oracle.json"))
	for i in cases.size():
		var c: Dictionary=cases[i]
		var world:=SimWorld.new();world.load_snapshot(c.input);world.romance_enabled=true
		world.rng.state=int(c.seed)
		for j in int(c.steps):
			world.data.tickCount+=1
			SimRomance.process(world)
		var result:=world.snapshot()
		check(world.rng.state==int(c.rng),"rng %d/%s"%[i,c.kind])
		for key in ["gossip","messageLog"]: check(equal(result[key],c.expected[key]),"%s %d/%s"%[key,i,c.kind])
		for id in c.expected.agents:
			check(equal(world.runtime[id].moodModifier,c.runtime[id]),"mood %s %d/%s"%[id,i,c.kind])
			for key in c.expected.agents[id]:
				check(equal(result.agents[id].get(key),c.expected.agents[id][key]),"%s/%s %d/%s"%[id,key,i,c.kind])
		var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(result,"",false,true)))
		for j in 12:
			world.data.tickCount+=1;resumed.data.tickCount+=1
			SimRomance.process(world);SimRomance.process(resumed)
		check(equal(world.snapshot(),resumed.snapshot()),"resume %d/%s"%[i,c.kind])
	var report:={"checks":checks,"failures":failures,"scope":"daily relationship source oracle; AI drama, news and NPC event chain callbacks excluded"}
	FileAccess.open("res://docs/ROMANCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

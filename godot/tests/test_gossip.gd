extends SceneTree
var failures: Array=[]
var checks:=0
func equal(a: Variant,b: Variant) -> bool:
	return JSON.parse_string(JSON.stringify(a,"",true))==JSON.parse_string(JSON.stringify(b,"",true))
func check(value: bool,message: String) -> void:
	checks+=1
	if not value and failures.size()<30: failures.append(message)
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/gossip/oracle.json"))
	for i in cases.size():
		var c: Dictionary=cases[i]
		var world:=SimWorld.new();world.load_snapshot(c.input);world.gossip_enabled=true
		var data:=world.data
		var a: Dictionary=data.agents[c.ids.a]
		var b: Dictionary=data.agents[c.ids.b]
		var d: Dictionary=data.agents[c.ids.d]
		var p: Dictionary=data.agents[c.ids.p]
		world.rng.state=int(c.seed)
		if c.kind in ["praise","diss","ship","blocked_ship"]: SimGossip.seed_player(data,p,d,b,"ship" if c.kind=="blocked_ship" else c.kind,world.rng,d.name)
		if c.kind=="create": SimGossip.create(a,b,data,world.rng)
		if c.kind.begins_with("rel_"): SimGossip.create_relationship(data,c.kind.trim_prefix("rel_"),a,b,world.rng,"小花")
		SimGossip.spread(a,b,data,world.rng)
		for j in 16:
			data.tickCount+=1
			SimGossip.spread(a if j%2 else d,p,data,world.rng)
		var result:=world.snapshot()
		check(world.rng.state==int(c.rng),"rng %d/%s"%[i,c.kind])
		for key in ["gossip","messageLog","townFeed"]: check(equal(result[key],c.expected[key]),"%s %d/%s"%[key,i,c.kind])
		for id in c.expected.agents:
			for key in c.expected.agents[id]: check(equal(result.agents[id].get(key),c.expected.agents[id][key]),"%s/%s %d/%s"%[id,key,i,c.kind])
	var report:={"checks":checks,"failures":failures,"scope":"upstream gossip creation/spreading/confrontation incl player sources and feed posts; news collection excluded"}
	FileAccess.open("res://docs/GOSSIP_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

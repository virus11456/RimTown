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
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/player_chat/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=11456
		var parsed:=SimPlayerChat.parse(c.response)
		check(parsed.ok,c.style+"/parse")
		if not parsed.ok: continue
		SimPlayerChat.apply(w,"chen_wei","今天過得如何？",parsed)
		for id in c.agents: check(equal(w.data.agents[id],c.agents[id]),c.style+"/"+id)
		check(equal(w.data.messageLog,c.logs),c.style+"/log")
		check(w.rng.state==int(c.rng),c.style+"/rng")
	for response in ["","```analysis\n分析\n```","EFFECTS: {}","你好。\nEFFECTS: {\"affinity_change\":\"bad\"}"]:
		check(not SimPlayerChat.parse(response).ok,"invalid reply rejected")
	var w:=SimWorld.new();w.load_snapshot(cases[0].input)
	var parsed:=SimPlayerChat.parse("你好。\nEFFECTS: {\"affinity_change\":999,\"romantic_change\":-99}")
	var result:=SimPlayerChat.apply(w,"chen_wei","你好",parsed)
	check(result.affinity==5 and result.romantic==0,"untrusted effects bounded")
	var report:={"checks":checks,"failures":failures,"scope":"32 source parser/core-effects scenarios, memories/history/dedupe/RNG; invalid reply rejection and bounded effect safety; replan/heart events excluded"}
	FileAccess.open("res://docs/PLAYER_CHAT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

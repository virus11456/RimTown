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
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/trace/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input)
		var a: Dictionary=w.data.agents.chen_wei
		var state:=w.rng.state
		for i in c.actions.size():
			var action: Dictionary=c.actions[i]
			for field in ["hour","minute","day","season","year"]: w.data.clock[field]=action[field]
			a.activity=action.activity;a.currentLocation=action.loc;a.dailyPlan=action.plan
			SimTrace.record(a,w)
			for expected in c.expected:
				if int(expected.index)==i:
					check(equal(a.todayTrace,expected.trace),c.kind+"/"+str(i)+"/trace")
					check(a._traceDay==expected.day,c.kind+"/day")
		check(w.rng.state==state,c.kind+"/no RNG")
		var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
		SimTrace.record(a,w);SimTrace.record(restored.data.agents.chen_wei,restored)
		check(equal(w.snapshot(),restored.snapshot()),c.kind+"/resume dedupe")
	var report:={"checks":checks,"failures":failures,"scope":"12 original JS trace scenarios x 180 updates; dedupe, activity/location changes, day/season/year reset, plans, overrides, cap and JSON resume"}
	FileAccess.open("res://docs/TRACE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

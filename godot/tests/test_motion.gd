extends SceneTree
var failures: Array[String]=[]
var checks:=0
var maximum_error:=0.0
func compare(actual: Variant, expected: Variant, path: String) -> void:
	if failures.size()>20: return
	if actual is Dictionary and expected is Dictionary:
		for key in expected: compare(actual.get(key),expected[key],path+"/"+key)
	elif actual is Array and expected is Array:
		if actual.size()!=expected.size(): failures.append(path+" length"); return
		for i in expected.size(): compare(actual[i],expected[i],path+"/%d"%i)
	elif (actual is float or actual is int) and (expected is float or expected is int):
		var error:=absf(float(actual)-float(expected))
		maximum_error=maxf(maximum_error,error)
		if error>.05: failures.append(path+": %s != %s"%[actual,expected])
	elif actual!=expected: failures.append(path+": %s != %s"%[actual,expected])
func _initialize() -> void:
	for theme in ["frontier","harbor"]:
		var f: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/phase4a/"+theme+"-motion.json"))
		var layout:=TownLayout.new(); layout.rebuild(f.input)
		var motion:=SimMotion.new(); motion.configure(layout)
		for p in f.paths:
			compare(motion.pathfinder.find_path(Vector2(p.start[0],p.start[1]),Vector2(p.end[0],p.end[1])),p.expected,theme+"/path")
			checks+=1
		var change_index:=0; var index:=0
		for frame in range(1,721):
			if change_index<f.changes.size() and frame==f.changes[change_index].frame:
				var change: Dictionary=f.changes[change_index]
				if change.has("location"):
					for a in f.input.agents.values():
						a.currentLocation=a.homeLocation if change.location=="home" else change.location
						a.activity=change.activity
				for p in motion.positions.values():
					if change.get("sleepFuse",false): p._slpOut=600; p.walking=true
					if change.get("awakeFuse",false): p._inStuck=360
				change_index+=1
			motion.update(f.input.agents)
			if frame==f.checkpoints[index].frame:
				compare(motion.positions,f.checkpoints[index].positions,theme+"/%d"%frame)
				checks+=1; index+=1
				if not failures.is_empty(): break
	var result:={"checks":checks,"failures":failures,"maximum_numeric_error_pixels":maximum_error,"position_tolerance_pixels":.05}
	FileAccess.open("res://docs/MOTION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
	print(JSON.stringify(result)); quit(0 if failures.is_empty() else 1)

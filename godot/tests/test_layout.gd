extends SceneTree
func _initialize() -> void:
	var failures: Array=[]
	var cases:=0
	for filename in DirAccess.get_files_at("res://tests/layout"):
		if not filename.ends_with(".json"): continue
		var fixture: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/layout/"+filename))
		var layout:=TownLayout.new()
		layout.rebuild(fixture.input)
		var actual:={"grid":layout.grid,"buildings":layout.buildings,"houses":layout.houses,"factories":layout.factory_plots,"agentHouse":layout.agent_house,"agents":layout.agent_positions}
		actual = JSON.parse_string(JSON.stringify(actual))
		for key in actual:
			if actual[key]!=fixture.expected[key]:
				failures.append(filename+":"+key)
				var out:=FileAccess.open("res://tests/layout/actual-"+filename+".tmp",FileAccess.WRITE)
				out.store_string(JSON.stringify(actual))
		cases+=1
	var report:={"cases":cases,"tiles_compared":cases*4800,"failures":failures}
	FileAccess.open("res://docs/LAYOUT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

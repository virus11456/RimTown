extends SceneTree
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/social/dialogue.json"))
	var failures: Array=[]
	var dialogue:=SimDialogue.new()
	dialogue.rng=SimRandom.new()
	for i in cases.size():
		var c: Dictionary=cases[i]
		dialogue.rng.state=int(c.seed)
		var v: Dictionary=dialogue._generatePersonalityDialogue(c.input.a,c.input.b,c.input.w,c.input.ra,c.input.rb)
		if JSON.parse_string(JSON.stringify(v))!=c.expected: failures.append("dialogue %d"%i)
		if dialogue.rng.state!=int(c.rng): failures.append("rng %d"%i)
	var report:={"checks":cases.size()*2,"failures":failures,"scope":"complete original local dialogue templates plus RNG; no HTTP"}
	FileAccess.open("res://docs/DIALOGUE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

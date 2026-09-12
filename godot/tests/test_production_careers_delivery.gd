extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		var path:=ProjectSettings.globalize_path("res://../../../outputs/職涯生產四日_"+town+".rimtown")
		var bundled:=ProjectSettings.globalize_path("res://../progress/職涯生產四日_"+town+".rimtown")
		if FileAccess.file_exists(bundled): path=bundled
		check(FileAccess.file_exists(path),"natural delivery exists "+town)
		var decoded:=SaveArchive.decode(FileAccess.get_file_as_bytes(path))
		check(decoded.ok,"archive checksum and decoding "+town)
		if not decoded.ok: continue
		var source: Dictionary=JSON.parse_string(decoded.text)
		app.dialog.file_selected.emit(path);await settle()
		check(int(app.simulation.data.tickCount)==384,"four-day progress imported "+town)
		check(equal(source._godot4a.motion,app.progress_snapshot()._godot4a.motion),"saved physical motion preserved "+town)
		check(app.station_approach.job.is_empty(),"no queued approach resumes on import")
		check(SimCareers.book(app.simulation).completed==(6 if town=="frontier" else 8) and SimCareers.book(app.simulation).used<=3,"career progress and daily cap preserved")
	var report:={"checks":checks,"failures":failures,"scope":"both natural four-day delivery archives, checksum, file picker import, physical motion, career progress, no queued approach on load"}
	FileAccess.open("res://docs/PRODUCTION_CAREERS_DELIVERY.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		var path:=ProjectSettings.globalize_path("res://../../../outputs/步行四日_"+town+".rimtown")
		var bundled:=ProjectSettings.globalize_path("res://../progress/步行四日_"+town+".rimtown")
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
		check(SimCareers.book(app.simulation).completed==int(source._godot4a.quest_balance.careers.completed) and SimCareers.book(app.simulation).used<=3,"career progress and daily cap preserved")
		check(app.world_view.resident_care.pairs.is_empty(),"care pairs rebuild after import")
		check(app.world_view.resident_work.phases.is_empty(),"resident work phase resets on import")
		app.world_view.traveler_gait.update(app.world_view,app.motion.positions,0)
		check(app.world_view.traveler_gait.weight==0 and app.world_view.traveler_gait.feet.size()==2,"fresh foot targets without replaying old stance")
		check(app.world_view.resident_gaits.size()==app.simulation.data.agents.size()-1 and app.world_view.resident_gaits.values().all(func(g):return g.feet.is_empty()),"resident anchors rebuilt rather than restored from old save")
		app.world_view.animate_resident_gaits(app.motion.positions,0)
		check(app.world_view.resident_gaits.values().all(func(g):return g.initialized),"every saved resident initializes a fresh gait")
	var report:={"checks":checks,"failures":failures,"scope":"both natural four-day delivery archives, checksum, file picker import, physical motion, career progress, no queued approach on load"}
	FileAccess.open("res://docs/CARE_JOURNEY_DELIVERY.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

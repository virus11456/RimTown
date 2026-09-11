extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var towns: Array=[]
	for town in ["frontier","harbor"]:
		var path:=ProjectSettings.globalize_path("res://../../../outputs/室內服務四日_"+town+".rimtown")
		app.dialog.file_selected.emit(path);await settle();var w: SimWorld=app.simulation
		var run_report: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://docs/INDOOR_SERVICE_NATURAL_"+town.to_upper()+".json"))
		var original: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/"+town+"-day-01.json"))
		check(int(w.data.tickCount)==384 and original.agents.keys().all(func(id): return id=="player" or w.data.agents[id].jobKey==original.agents[id].jobKey),"four-day archive preserves original NPC jobs "+town)
		var total:=int(run_report.finished.doctor)+int(run_report.finished.priest)
		check(SimCareers.book(w).completed==total and SimCareers.book(w).used<=3,"verified completion count and quota survive "+town)
		check(float(w.data.agents.player.skills["醫療"].xp)==float(original.agents.player.skills["醫療"].xp)+3*int(run_report.finished.doctor),"only completed natural care grants medical XP "+town)
		var before:=w.snapshot();SimCareers.tick(w);check(equal(before,w.snapshot()),"archive does not replay care effects "+town)
		var expected: Dictionary=app.progress_snapshot();var points: Dictionary=app.motion.positions.duplicate(true)
		app._load_document(JSON.stringify(expected),"service full roundtrip")
		check(equal(expected,app.progress_snapshot()) and equal(points,app.motion.positions),"full save and actual positions roundtrip "+town)
		var id:="chen_wei" if town=="frontier" else "hb_achao"
		before=w.snapshot();app.show_service_target(id);await settle()
		check(app.active_tab=="居民" and app.resident_page=="agenda" and equal(before,w.snapshot()),"locate service target without moving actors or mutating world "+town)
		press(app.drawer_body,"返回職業與值勤");await settle();check(app.career_page,"archive supports return to service page "+town)
		towns.append({"town":town,"finished":run_report.finished,"population":w.data.agents.size(),"medical_xp":w.data.agents.player.skills["醫療"].xp})
	var report:={"checks":checks,"failures":failures,"towns":towns,"scope":"two natural four-day archives actual picker; original jobs, completion count vs final run, exact medical XP from completed duties only, full world/position roundtrip, no effect replay and target navigation; no artificial mood archives delivered"}
	FileAccess.open("res://docs/INDOOR_NATURAL_DELIVERY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

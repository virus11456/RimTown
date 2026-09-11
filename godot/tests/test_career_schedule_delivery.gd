extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var summaries: Array=[]
	for town in ["frontier","harbor"]:
		var path:=ProjectSettings.globalize_path("res://../../../outputs/職業四日_"+town+".rimtown")
		check(FileAccess.file_exists(path),"four-day career archive exists "+town)
		if not FileAccess.file_exists(path): continue
		app.dialog.file_selected.emit(path);await settle();var w: SimWorld=app.simulation
		check(int(w.data.tickCount)==384 and w.data.agents.player.jobKey=="guard","correct elapsed time and player profession "+town)
		var original: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/"+town+"-day-01.json"))
		check(original.agents.keys().all(func(id): return id=="player" or w.data.agents[id].jobKey==original.agents[id].jobKey),"player enrollment did not change original NPC jobs "+town)
		var guards: Array=[]
		for a in w.data.agents.values():
			if a.get("jobKey")=="guard" and not a.get("isPlayer",false): guards.append({"id":a.id,"shift":a.get("_guardShift","")})
		check(not w.data.agents.player.has("_guardShift"),"player guard does not become an automatic NPC shift "+town)
		if town=="frontier": check(w.data.agents.yang_feng._guardShift=="day" and w.data.agents.gao_lang._guardShift=="night","original day/night guards preserved")
		else: check(w.data.agents.hb_aduo._guardShift=="day" and not w.data.townMap.locations.has("workshop"),"original harbor guard and missing workshop preserved")
		check(SimAppointments.current(w).state=="met" and SimCareers.book(w).used<=3,"meeting and daily quota survive import "+town)
		var before:=w.snapshot();SimCareers.tick(w);SimAppointments.tick(w)
		check(equal(before,w.snapshot()),"imported completion cannot replay labor or appointment rewards "+town)
		var expected: Dictionary=app.progress_snapshot();var points: Dictionary=app.motion.positions.duplicate(true)
		app._load_document(JSON.stringify(expected),"career delivery roundtrip");check(equal(expected,app.progress_snapshot()) and equal(points,app.motion.positions),"full world and motion roundtrip "+town)
		app.show_careers();await settle();check(has_text(app.drawer_body,"今日完成 3 / 3"),"delivered career quota visible "+town)
		summaries.append({"town":town,"guards":guards,"guard_progress":SimCareerProgress.progress(w,"guard"),"carpenter_progress":SimCareerProgress.progress(w,"carpenter"),"population":w.data.agents.size()})
	var report:={"checks":checks,"failures":failures,"towns":summaries,"scope":"two four-day archives actual picker, full snapshot/position roundtrip, terminal no replay, quotas, original NPC jobs and day/night shifts, player not auto-shifted, harbor workshop still absent; no production AI"}
	FileAccess.open("res://docs/CAREER_SCHEDULE_DELIVERY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

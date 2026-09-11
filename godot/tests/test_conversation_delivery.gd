extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var summaries: Array=[]
	for town in ["frontier","harbor"]:
		var source:=ProjectSettings.globalize_path("res://../../../outputs/聊天八日_"+town+".rimtown")
		check(FileAccess.file_exists(source),"eight-day progress exists "+town)
		if not FileAccess.file_exists(source): continue
		app.dialog.file_selected.emit(source);await settle()
		var w: SimWorld=app.simulation;var m: SimMotion=app.motion
		var mayor:="chen_wei" if town=="frontier" else "hb_haibo"
		var absent:="hb_haibo" if town=="frontier" else "chen_wei"
		check(int(w.data.tickCount)==768 and SimGovernance.mayor(w)==mayor and not w.data.agents.has(absent),"correct town and original mayor at day eight "+town)
		var history: Array=w.quest_balance.appointments.history
		check(history.any(func(a): return a.state=="met"),"actual meeting history survives "+town)
		check(w.data.buildings.completed.any(func(p): return p.get("buildingKey")=="farm_irrigation"),"completed paid construction survives "+town)
		# Deliver with optional background API toggles off, even though the
		# endurance harness explicitly enabled its mock transport.
		w.event_comments_online=false;w.heart_events_online=false
		var expected: Dictionary=app.progress_snapshot();var points: Dictionary=m.positions.duplicate(true)
		var file:=ProjectSettings.globalize_path("res://../../../outputs/聊天八日試玩_"+town+".rimtown")
		FileAccess.open(file,FileAccess.WRITE).store_buffer(SaveArchive.encode(JSON.stringify(expected)))
		app.dialog.file_selected.emit(file);await settle()
		check(not w.event_comments_online and not w.heart_events_online and not app.chat_busy and not app.event_comment_busy,"delivered archive cannot resume mock requests or background API "+town)
		check(equal(points,m.positions) and equal(expected,app.progress_snapshot()),"native delivery roundtrip preserves full world and positions "+town)
		var before:=w.snapshot();SimAppointments.tick(w);SimAppointments.observe(w,m)
		check(equal(before,w.snapshot()),"loaded terminal meeting does not replay "+town)
		var id:="chen_wei" if town=="frontier" else "hb_achao"
		app.show_tab("居民",true);app.show_player_chat(id);press(app.drawer_body,"查看目前行程");await settle()
		check(app.resident_page=="agenda" and has_text(app.drawer_body,"實際位置："),"delivered current schedule is accessible "+town)
		summaries.append({"town":town,"population":w.data.agents.size(),"history":history,"verified_meetings":history.filter(func(a): return a.state=="met" and a.get("npc_arrived",false)).size(),"file":file})
	var report:={"checks":checks,"failures":failures,"towns":summaries,"scope":"actual archive picker, eight-day source progress to background-off delivery archives, full snapshot and physical-position roundtrip, existing meeting history/no replay, paid construction, chat-to-agenda buttons; no production AI"}
	FileAccess.open("res://docs/CONVERSATION_DELIVERY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

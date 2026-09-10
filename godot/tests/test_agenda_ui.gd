extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	w.data.agents.chen_wei.dailyPlan={"blocks":[{"time":"00:00","text":"尚未執行的遠行計畫","steps":["還沒去的地方"]}]}
	SimAppointments.offer(w,"chen_wei")
	app.show_tab("居民",true);app.show_agent("chen_wei",false);press(app.drawer_body,"今日作息與行程");await settle()
	check(has_text(app.drawer_body,"文字備忘（未排入行程）") and has_text(app.drawer_body,"尚未執行的遠行計畫"),"imported plan clearly separate from executable routine")
	check(has_text(app.drawer_body,"尚未接受，未排入行程"),"unaccepted appointment is not advertised as confirmed")
	check(has_text(app.drawer_body,"實際位置：") and has_text(app.drawer_body,"目的地："),"actual place and destination shown separately")
	app._tick_simulation();await settle()
	check(app.resident_page=="agenda" and has_text(app.drawer_body,"今日作息與行程"),"time advancement preserves agenda panel")
	check(has_text(app.drawer_body,"依班表保留"),"adjusted sleep duration and commute allowance visible")
	var trace: Array=app.physical_trace.entries(w,"chen_wei")
	check(not trace.is_empty() and not trace.any(func(e): return "遠行計畫" in e.text or "還沒去" in e.text),"normal app tick records actual observation")
	w.data.agents.chen_wei.todayTrace=[{"m":360,"text":"來源作息文字"}];w.data.agents.chen_wei._traceDay=SimTrace.day_key(w.data.clock)
	press(app.drawer_body,"今日足跡");await settle()
	check(has_text(app.drawer_body,"實際足跡") and has_text(app.drawer_body,"未核對實際位置"),"actual and legacy trace provenance visible")
	var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"375px trace panel fits")
	app.show_agenda("chen_wei");await settle()
	fits=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"375px agenda panel fits")
	var before: Dictionary=app.physical_trace.snapshot()
	var sleep_before: Dictionary=w.data.agents.chen_wei._shiftSleep.duplicate(true)
	var path:=ProjectSettings.globalize_path("res://../../../outputs/居民作息與實際足跡.rimtown")
	var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())));file.close()
	app.dialog.file_selected.emit(path);await settle()
	check(equal(before,app.physical_trace.snapshot()),"native archive restores physical timeline")
	check(equal(sleep_before,w.data.agents.chen_wei._shiftSleep),"native archive preserves adjusted sleep schedule")
	app.load_demo("harbor");check(app.physical_trace.snapshot().entries.is_empty(),"switching towns cannot leak previous physical trace")
	var report:={"checks":checks,"failures":failures,"scope":"real agenda/trace navigation, normal app tick, deliberate unexecuted plan and legacy trace, adjusted sleep display and native reload, unaccepted appointment, 375px panels, compressed timeline reload and town isolation; no new AI scheduler"}
	FileAccess.open("res://docs/AGENDA_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

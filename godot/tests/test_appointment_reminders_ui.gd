extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	w.data.agents.chen_wei.jobKey="" # Controlled free-day fixture for the stricter return-time check.
	check(app.appointment_shortcut.disabled,"no active appointment shortcut disabled")
	SimAppointments.offer(w,"chen_wei");app._refresh_appointment_reminder()
	check(not app.appointment_shortcut.disabled,"pending offer shortcut enabled")
	app.appointment_shortcut.pressed.emit();await settle()
	check(app.resident_page=="appointment" and has_text(app.drawer_body,"請在兩個遊戲小時內回覆"),"global shortcut reaches actual pending card")
	press(app.drawer_body,"接受邀約");var a:=SimAppointments.current(w);w.data.tickCount=a.due-8
	app.chat_busy=true;app._refresh_appointment_reminder()
	check(app.appointment_reminder.is_empty(),"busy chat defers reminder without consuming it")
	app.chat_busy=false;app._refresh_appointment_reminder();await settle()
	check("120" in app.status.text,"deferred reminder appears in status without opening new panel")
	var previous: String=app.status.text;app.status.text="其他訊息";app._refresh_appointment_reminder()
	check(app.status.text=="其他訊息","same reminder cannot overwrite later messages repeatedly")
	check(app.navigation.position.x+app.navigation.size.x<=375 and app.navigation.size.x<=343,"five mobile navigation buttons fit width")
	var path:=ProjectSettings.globalize_path("res://tests/reminder-save.json.tmp")
	var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())));file.close()
	app.dialog.file_selected.emit(path);await settle();app.status.text="已載入";app._refresh_appointment_reminder()
	check(app.status.text=="已載入","native reload does not replay reminder")
	SimAppointments.finish(w,"cancelled","取消");app._refresh_appointment_reminder()
	check(app.appointment_shortcut.disabled,"finished appointment shortcut disabled")
	DirAccess.remove_absolute(path)
	var report:={"checks":checks,"failures":failures,"scope":"controlled free-day NPC for return availability; 375px global navigation, pending/accepted/terminal shortcut, busy deferral, once-only status and native archive; controlled due time, no API"}
	FileAccess.open("res://docs/APPOINTMENT_REMINDER_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

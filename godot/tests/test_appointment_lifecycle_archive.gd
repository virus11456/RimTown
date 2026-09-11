extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var path:=ProjectSettings.globalize_path("res://../../../outputs/五日施工與邀約驗收.rimtown")
	check(FileAccess.file_exists(path),"delivered five-day archive exists")
	app.dialog.file_selected.emit(path);await settle()
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	check(int(w.data.tickCount)==480 and w.data.buildings.completed.any(func(p): return p.get("buildingKey")=="farm_irrigation"),"actual archive picker restores fifth-day construction progress")
	var history: Array=SimGovernance.book(w).proposals
	check(history.size()==1 and history[0].status=="executed" and SimGovernance.mayor(w)=="chen_wei","public approval remains executed with original mayor")
	var records: Array=w.quest_balance.appointments.history
	check(records.size()==2 and records[0].state=="missed" and records[1].state=="met","delivered archive retains separate failed and successful appointments")
	app.show_tab("居民",true);app.show_appointment("chen_wei");await settle()
	check(has_text(app.drawer_body,"玩家未到") and has_text(app.drawer_body,"實際碰面"),"phone history explains both outcomes")
	var before:=w.snapshot();SimAppointments.tick(w);SimAppointments.observe(w,m)
	check(equal(before,w.snapshot()),"opening delivered history does not replay settlement")
	check(m.layout.work_sites.has("farm") and w.data.agents.gao_lang._guardShift=="night","farm location and night roster survive archive")
	var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"delivered archive history fits 375px")
	var report:={"checks":checks,"failures":failures,"scope":"delivered compressed five-day archive loaded through app picker; original mayor, approved construction, separate missed/met history, mobile explanation, no replay, farm and night roster"}
	FileAccess.open("res://docs/APPOINTMENT_LIFECYCLE_ARCHIVE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

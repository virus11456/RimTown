extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	# Observe the initial hour with full normal motion; do not move anyone for this case.
	for tick in 4:
		app._tick_simulation()
		if tick<3:
			for frame in m.frames_per_tick():
				m.update(w.data.agents);SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
	var a: Dictionary=w.data.agents.wu_da
	check(a.activity=="working" and SimCareerPresence.place(m,a.id)!="quarry","natural initial worker is still travelling at shift start")
	var snapshot:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true)
	check("目前不在工作場所" in SimAgenda.attendance(w,m,a.id),"schedule alone cannot claim physical arrival")
	app.show_tab("居民",true);app.show_agenda(a.id);await settle()
	check(has_text(app.drawer_body,"上工狀態：工時內，目前不在工作場所"),"phone agenda displays actual absence during working hours")
	check(equal(snapshot,w.snapshot()) and equal(positions,m.positions),"reading attendance does not change simulation or movement")
	var guard: Dictionary=w.data.agents.gao_lang;var p: Dictionary=m.positions[guard.id]
	var point:=m.layout._nearest(m.layout._center("town_square"));p.x=point.x;p.y=point.y;p.walking=false;p.doorPhase=null
	guard.activity="eating";w.data.clock.hour=23
	check("已在工作場所" in SimAgenda.attendance(w,m,guard.id) and "進食" in SimAgenda.attendance(w,m,guard.id),"present night guard eating is not mislabeled as working")
	w.data.clock.hour=2;check("已在工作場所" in SimAgenda.attendance(w,m,guard.id),"night attendance spans midnight")
	p.doorPhase="entering";check("進出或移動" in SimAgenda.attendance(w,m,guard.id),"door transition is not stopped attendance");p.doorPhase=null
	w.data.clock.hour=10;check(SimAgenda.attendance(w,m,guard.id).is_empty(),"off-duty night guard is not shown as absent")
	check("尚未建成" in SimAgenda.attendance(w,m,"lin_mei"),"missing clinic is explained separately from absence")
	w.data.clock.hour=23;m.positions.erase(guard.id)
	check("無法確認" in SimAgenda.attendance(w,m,guard.id),"missing observation is unknown rather than absent")
	guard.isDead=true;check(SimAgenda.attendance(w,m,guard.id).is_empty(),"dead resident has no attendance status");guard.isDead=false
	guard.isPlayer=true;check(SimAgenda.attendance(w,m,guard.id).is_empty(),"player is not assigned NPC attendance status")
	var report:={"checks":checks,"failures":failures,"scope":"natural first-hour travel and phone agenda; controlled overnight, meal, doorway, off-duty, missing facility/position, player and dead states; read-only world and motion check"}
	FileAccess.open("res://docs/ATTENDANCE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

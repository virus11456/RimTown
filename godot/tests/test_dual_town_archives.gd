extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var summaries: Array=[]
	for spec in [{"file":"雙城整合邊境鎮.rimtown","mayor":"chen_wei","absent":"hb_haibo"},{"file":"海風鎮五日邀約驗收.rimtown","mayor":"hb_haibo","absent":"chen_wei"}]:
		var path:=ProjectSettings.globalize_path("res://../../../outputs/"+spec.file)
		check(FileAccess.file_exists(path),"completed town archive exists: "+spec.file)
		app.dialog.file_selected.emit(path);await settle()
		var w: SimWorld=app.simulation;var m: SimMotion=app.motion
		check(int(w.data.tickCount)==480 and SimGovernance.mayor(w)==spec.mayor and not w.data.agents.has(spec.absent),"switching archive restores correct town and mayor without other-town residents")
		var history: Array=w.quest_balance.appointments.history
		check(history.size()==2 and history[0].state=="missed" and history[1].state=="met","independent failed and successful player appointments survive archive")
		var resolved:=0;var clean:=true;var remembered:=true
		for token in SimHangoutVisits.records(w):
			var r: Dictionary=SimHangoutVisits.records(w)[token]
			if r.state not in ["cancelled","missed"]: continue
			resolved+=1
			for id in r.people:
				if not w.data.agents.has(id): continue
				var a: Dictionary=w.data.agents[id]
				if a.get("_activeHangout")==token: clean=false
				if not a.get("isDead",false) and not a.memory.any(func(row): return "同行安排未完成" in row.content and r.reason in row.content): remembered=false
		check(clean and remembered,"naturally ended NPC gatherings have no stale command and retain factual memory")
		var before:=w.snapshot();SimAppointments.tick(w);SimAppointments.observe(w,m)
		check(equal(before,w.snapshot()),"loading town cannot replay resolved player appointment")
		app.show_tab("居民",true);app.show_appointment(str(history[1].npc));await settle()
		check(has_text(app.drawer_body,"玩家未到") and has_text(app.drawer_body,"實際碰面"),"both outcomes visible in correct town history")
		summaries.append({"town":spec.file,"resolved_npc_gatherings":resolved,"npc_records":SimHangoutVisits.records(w).size(),"population":w.data.agents.size()})
	var report:={"checks":checks,"failures":failures,"towns":summaries,"scope":"two delivered five-day archives loaded via real picker, town isolation, actual player histories, naturally resolved NPC records and memory, no settlement replay; zero natural cancellation count is not coverage of injected conflict branches"}
	FileAccess.open("res://docs/DUAL_TOWN_ARCHIVES_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

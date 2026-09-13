extends "res://tests/test_appointments_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.chat_transport=mock
	app.dialog.file_selected.emit(ProjectSettings.globalize_path("res://docs/CARE_FOLLOWUP_HARBOR.rimtown"));await settle()
	var w: SimWorld=app.simulation;var id:="hb_shishu"
	var original: Array=w.data.agents[id]._careResults.duplicate(true)
	# Controlled encounter; care/home/work evidence comes unchanged from the natural archive.
	w.data.clock.hour=20;w.event_comments.clear();w.quest_balance.daily_talk={}
	for a in w.data.agents.values(): a.activity="sleeping"
	var npc: Dictionary=w.data.agents[id];npc.activity="wandering";npc.jobKey="";npc.needs.hunger=80;npc.needs.rest=80;npc.needs.social=30;npc.relationships.player={"affinity":0}
	w.data.agents.player.activity="wandering"
	SimWorkSchedule.refresh(w,app.motion);SimShiftSleep.refresh(w,app.motion)
	var safe:=true
	for frame in 6000:
		if not SimCareerPresence.place(app.motion,id).is_empty() and not app.motion.positions[id].walking: break
		var previous:=Vector2(app.motion.positions[id].x,app.motion.positions[id].y)
		app.motion.update(w.data.agents)
		var next:=Vector2(app.motion.positions[id].x,app.motion.positions[id].y)
		if previous.distance_to(next)>1.001 or not app.motion.layout._walkable(next): safe=false
	check(safe and not SimCareerPresence.place(app.motion,id).is_empty(),"resident walks to encounter location without snapping")
	check(walk_player(app,Vector2(app.motion.positions[id].x,app.motion.positions[id].y)),"player actually walks to resident")
	app.motion.move_player(Vector2.ZERO,.016)
	var stock: Dictionary=w.data.stockpile.duplicate(true)
	app.drawer.hide();app.active_tab="";app._process_daily_talk();await settle()
	var entry: Dictionary=w.data.agents.player.chatHistory.back()
	check(entry.get("_godotRecall",{}).get("kind")=="resident_care","actual app shows care recall from natural evidence")
	check("阿汐" in entry.text and "20:30" in entry.text and "07:45" in entry.text and "鹽場" in entry.text,"conversation contains dated actual followup")
	check(equal(original,npc._careResults) and equal(stock,w.data.stockpile) and requests==0,"no evidence mutation reward or network request")
	app.show_tab("居民",true);await settle();press(app.drawer_body,"最近搭話："+str(npc.name));await settle()
	check(has_text(app.drawer_body,entry.text),"recent greeting opens real conversation text")
	var fits:=true
	for child in app.drawer_body.get_children():
		if child is Control and child.size.x>app.drawer.size.x: fits=false
	check(fits,"375px conversation controls fit")
	var path:=ProjectSettings.globalize_path("res://docs/CARE_CHAT_ENCOUNTER.rimtown")
	var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())));file.close()
	app.dialog.file_selected.emit(path);await settle()
	check(SimCareChat.recall(app.simulation,id,app.simulation.quest_balance.daily_talk).is_empty(),"archive import retains consumed care recall")
	check(app.simulation.data.agents.player.chatHistory.back().text==entry.text,"archive preserves actual conversation")
	var report:={"checks":checks,"failures":failures,"scope":"natural care evidence with controlled encounter time/needs, collision walking, app greeting, mobile conversation and archive; no live AI"}
	FileAccess.open("res://docs/CARE_CHAT_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

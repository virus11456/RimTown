extends "res://tests/test_appointments_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var path:=ProjectSettings.globalize_path("res://../../../outputs/居民行程對話.rimtown")
	app.dialog.file_selected.emit(path);await settle()
	var w: SimWorld=app.simulation;var id:=""
	for candidate in w.data.agents:
		var rows:=SimLeisurePlan.history(w,candidate)
		if not rows.is_empty() and rows.back().state=="completed": id=candidate;break
	check(not id.is_empty(),"prior physical-walk archive contains real completed leisure")
	if id.is_empty(): quit(1);return
	# Configure a quiet encounter after the verified activity, without moving the NPC.
	w.data.tickCount+=4;w.data.clock.hour=20;w.quest_balance.daily_talk={};w.event_comments.clear()
	for a in w.data.agents.values(): a.activity="sleeping"
	var npc: Dictionary=w.data.agents[id];npc.activity="wandering";npc.jobKey="";npc.needs.hunger=80;npc.needs.rest=80;npc.needs.social=30
	w.data.agents.player.activity="wandering"
	var n: Dictionary=app.motion.positions[id]
	check(walk_player(app,Vector2(n.x,n.y)),"player physically walks to resident after completed activity")
	app.show_tab("居民",true);app._process_daily_talk();await settle()
	var entry: Dictionary=w.data.agents.player.chatHistory.back()
	check(entry.get("_godotRecall",{}).get("kind")=="leisure" and entry._godotRecall.state=="completed","actual app hook recalls verified completion")
	app.show_player_chat(id);await settle()
	check(has_text(app.drawer_body,"確實待了一會兒"),"personal recollection visible in chat")
	var fits:=true
	for c in app.drawer_body.get_children():
		if c is Control and c.size.x>app.drawer.size.x: fits=false
	check(fits,"375px recollection fits")
	var archive:=ProjectSettings.globalize_path("res://../../../outputs/居民休閒回憶.rimtown")
	var file:=FileAccess.open(archive,FileAccess.WRITE);file.store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())));file.close()
	app.dialog.file_selected.emit(archive);await settle()
	check(SimLeisureChat.recall(app.simulation,id,app.simulation.quest_balance.daily_talk).is_empty(),"native archive preserves consumed recollection")
	var report:={"checks":checks,"failures":failures,"resident":id,"scope":"prior actual-walk archive, controlled idle/work/needs/time encounter fixture, collision-based player approach, app daily-talk hook, phone chat and native archive; no production AI"}
	FileAccess.open("res://docs/LEISURE_RECALL_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

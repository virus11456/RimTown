extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.chat_transport=mock
	var w: SimWorld=app.simulation;app._tick_simulation()
	app.chat_drafts.chen_wei="保留的草稿";app.show_tab("居民",true);app.show_player_chat("chen_wei")
	press(app.drawer_body,"詢問休閒安排（本機）");await settle()
	check(requests==0 and has_text(app.drawer_body,"還沒完成"),"button gives local pending answer without API")
	check(app.chat_drafts.chen_wei=="保留的草稿","status inquiry preserves draft")
	var saved:=w.snapshot();press(app.drawer_body,"詢問休閒安排（本機）");check(equal(saved,w.snapshot()),"repeated click cannot duplicate record")
	app.send_player_chat("chen_wei","你今天安排什麼？")
	check(requests==1 and '"leisure":' in last_prompt and "不把文字備忘當行動" in last_prompt,"real chat transport gets truthful structured context")
	saved=w.snapshot();press(app.drawer_body,"詢問休閒安排（本機）");check(equal(saved,w.snapshot()),"in-flight chat blocks local inquiry")
	release_reply.emit();await settle()
	var completed:=""
	for t in 80:
		app._tick_simulation()
		for frame in 120:
			app.motion.update(w.data.agents);SimLeisurePlan.observe(w,app.motion)
		for id in SimLeisurePlan.plans(w):
			if SimLeisurePlan.plans(w)[id].state=="completed": completed=id;break
		if not completed.is_empty(): break
	check(not completed.is_empty(),"original resident completes by actual motion")
	if not completed.is_empty():
		app.show_player_chat(completed);press(app.drawer_body,"詢問休閒安排（本機）");await settle()
		check(has_text(app.drawer_body,"實際停留三十分鐘後完成了"),"local answer changes only after physical completion")
		check(w.data.agents.player.chatHistory.back()._godotLeisure.current.state=="completed","chat stores factual source")
	var fits:=true
	for c in app.drawer_body.get_children():
		if c is Control and c.size.x>app.drawer.size.x: fits=false
	check(fits,"375px factual chat fits")
	var history: Array=w.data.agents.player.chatHistory.duplicate(true)
	var path:=ProjectSettings.globalize_path("res://../../../outputs/居民行程對話.rimtown")
	var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())));file.close()
	app.dialog.file_selected.emit(path);await settle()
	check(equal(history,app.simulation.data.agents.player.chatHistory),"native archive preserves factual dialogue and source")
	var report:={"checks":checks,"failures":failures,"completed_resident":completed,"scope":"real local inquiry button, draft/dedup/busy guards, mock AI prompt transport, unmodified residents actual motion to completion, phone chat and native save; no production AI output guarantee"}
	FileAccess.open("res://docs/LEISURE_CHAT_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

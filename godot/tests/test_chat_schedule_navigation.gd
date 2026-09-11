extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.chat_transport=mock
	for town in ["frontier","harbor"]:
		app.load_demo(town);var w: SimWorld=app.simulation
		var id:="chen_wei" if town=="frontier" else "hb_achao"
		app.show_tab("居民",true);app.show_player_chat(id)
		app.send_player_chat(id,"明天的安排如何？")
		var before:=w.snapshot();var count:=requests
		press(app.drawer_body,"查看目前行程");await settle()
		check(app.resident_page=="agenda" and equal(before,w.snapshot()),"busy inspection is read-only "+town)
		press(app.drawer_body,"回到自由交談");await settle()
		check(app.chat_busy and app.chat_drafts.get(id)=="明天的安排如何？" and requests==count,"busy return keeps draft with no extra request "+town)
		SimAppointments.offer(w,id);before=w.snapshot();release_reply.emit();await settle()
		check(equal(before,w.snapshot()) and has_text(app.drawer_body,"玩家見面約定已更新"),"specific stale reason and no reply effects "+town)
		press(app.drawer_body,"查看目前行程");await settle()
		check(has_text(app.drawer_body,"尚未接受，未排入行程"),"actual current agenda avoids implying consent "+town)
		press(app.drawer_body,"回到自由交談");await settle();press(app.drawer_body,"傳送")
		release_reply.emit();await settle()
		check(requests==count+1 and not app.chat_drafts.has(id),"explicit send retries preserved message once "+town)
		var fits:=true
		for c in app.drawer_body.get_children():
			if c is Control and c.size.x>app.drawer.size.x: fits=false
		check(fits,"375px updated chat fits "+town)
	var source:={"appointment":{},"workplace":{},"leisure":{},"hangout":{}}
	check(SimConversationSchedule.changes(source,source)=="","unchanged snapshot has no invented explanation")
	for key in source:
		var changed:=source.duplicate(true);changed[key]={"state":"changed"}
		var reason:=SimConversationSchedule.changes(source,changed)
		check(not reason.is_empty() and "；" not in reason,"single changed category only: "+key)
	var report:={"checks":checks,"failures":failures,"scope":"two town actual chat/agenda buttons while waiting, source-specific stale notice, read-only inspection, unaccepted card explanation, preserved draft and explicit send, 375px; mock AI"}
	FileAccess.open("res://docs/CHAT_SCHEDULE_NAVIGATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

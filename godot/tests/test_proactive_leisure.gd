extends "res://tests/test_proactive_appointments.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var initial:=w.snapshot();app.event_comment_transport=mock
	for heart in [false,true]:
		for stale in [false,true]:
			app._load_document(JSON.stringify(initial),"proactive leisure fixture");w.quest_balance.leisure_plans_enabled=true;SimLeisurePlan.tick(w)
			w.event_comments_online=true;w.heart_events_online=true;app.chat_offline=false
			var item:=event(w,heart);var before: Dictionary=SimLeisurePlan.plans(w).duplicate(true)
			reply={"ok":true,"data":{"reply":"今天還沒完成休閒，改天要不要見面？\nEFFECTS: {\"invitation\":true}"}}
			app.process_event_comment()
			check("休閒行程與結果" in last_prompt and "不把文字備忘當行動" in last_prompt,"channel receives grounded leisure context")
			check(last_prompt.to_utf16_buffer().size()<=11600,"normal event prompt below server budget")
			check(equal(before,SimLeisurePlan.plans(w)),"request cannot execute plan")
			if stale: SimLeisurePlan.finish(w,"chen_wei","cancelled","工作安排改變")
			release_reply.emit();await settle()
			if stale:
				check(SimAppointments.current(w).is_empty(),"outdated leisure response cannot create invitation")
				check(w.data.agents.player.chatHistory.back().text==item.fallback,"changed facts use original event fallback")
			else:
				check(SimAppointments.current(w).get("state")=="offered","unchanged context preserves invitation path")
				check(equal(before,SimLeisurePlan.plans(w)),"invitation proposal does not complete leisure")
			check(w.event_comments.is_empty(),"event consumed exactly once")
	var report:={"checks":checks,"failures":failures,"scope":"event and heart app callbacks with mock AI, prompt context/budget, unchanged invitation behavior, leisure changed while pending discards response and effects; no production AI or semantic guarantee"}
	FileAccess.open("res://docs/PROACTIVE_LEISURE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

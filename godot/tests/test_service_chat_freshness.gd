extends "res://tests/test_service_chat.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.chat_transport=mock;app.event_comment_transport=mock
	reply={"ok":true,"data":{"reply":"舊服務台詞，改天要不要見面？\nEFFECTS: {\"affinity_change\":5,\"romantic_change\":3,\"summary\":\"舊服務台詞\",\"invitation\":true}"}}
	for town in ["frontier","harbor"]:
		for channel in ["free","event","heart"]:
			for change in ["start","cancel","complete","stable","other"]:
				var task:=prepare(app,town,"doctor");var w: SimWorld=app.simulation;var id:=str(task.target)
				w.event_comments.clear()
				if change!="start": SimCareers.start(w,task.id)
				var baseline:=SimConversationSchedule.capture(w,id)
				if channel=="free": app.show_player_chat(id);app.send_player_chat(id,"服務現在怎麼樣？","threaten")
				else:
					w.event_comments_online=true;w.heart_events_online=true;app.chat_offline=false
					var item:={"npc":id,"player":"player","event":"工程完成","fallback":"鎮上的工程完成了。"}
					if channel=="heart": item.kind="heart";item.definition={"name":"初識之誼","icon":"♥"}
					w.event_comments.append(item);app.process_event_comment()
				check("cancelled 必須說未完成" in last_prompt,"service facts reach actual transport "+town+channel+change)
				if channel=="free":
					var busy_before:=w.snapshot();press(app.drawer_body,"詢問服務結果（本機）");check(equal(busy_before,w.snapshot()),"busy local inquiry blocked "+town+change)
				match change:
					"start": SimCareers.start(w,task.id)
					"cancel": SimCareers.cancel(w,"對方需要上工，服務未完成。")
					"complete": finish_service(app)
					"stable": w.data.tickCount+=1
					"other":
						var other:=task.duplicate(true);other.target=w.data.agents.keys().filter(func(k): return k not in [id,"player"])[0]
						SimServiceChat.outcome(w,other,"cancelled","其他居民的服務取消。")
				var current:=SimConversationSchedule.capture(w,id)
				var unchanged: bool=change in ["stable","other"]
				check(equal(baseline,current)==unchanged,"only meaningful target service changes invalidate "+town+channel+change)
				for key in ["leisure","workplace","appointment","hangout"]: check(equal(baseline[key],current[key]),"service category isolated from "+key+town+channel+change)
				var before:=w.snapshot();var appointment:=SimAppointments.current(w).duplicate(true);var count:=requests
				release_reply.emit();await settle()
				if unchanged: check("舊服務台詞" in JSON.stringify(w.data.agents.player.chatHistory),"current facts accept normal response "+town+channel+change)
				elif channel=="free":
					check(equal(before,w.snapshot()) and app.chat_drafts.get(id)=="服務現在怎麼樣？","stale reply no world effect and draft retained "+town+change)
					check(has_text(app.drawer_body,"服務的進度／結果已更新"),"specific service freshness notice "+town+change)
				else:
					check(w.data.agents.player.chatHistory.back().text=="鎮上的工程完成了。" and equal(appointment,SimAppointments.current(w)),"stale proactive uses original fallback without invitation "+town+channel+change)
				check(requests==count and not app.chat_busy and not app.event_comment_busy,"no retry or stranded busy state "+town+channel+change)
	var report:={"checks":checks,"failures":failures,"scope":"two towns, three actual await channels with mock transport; service start/cancel/complete changes isolated from other schedule categories; stable time and other resident outcome accepted, stale free effects wholly rejected and draft retained, proactive fallback/no invitation, local busy guard, no retry; no production AI"}
	FileAccess.open("res://docs/SERVICE_CHAT_FRESHNESS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

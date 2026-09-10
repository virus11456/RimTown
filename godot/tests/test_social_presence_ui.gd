extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var count:=0;var invalid:=[]
	for t in 96:
		var old_count: int=w.data.get("npcConversationLog",[]).size()
		app._tick_simulation()
		var rows: Array=w.data.get("npcConversationLog",[])
		for row in rows.slice(old_count):
			count+=1
			var a: Dictionary=w.social.physical_positions.get(row.agentAId,{})
			var b: Dictionary=w.social.physical_positions.get(row.agentBId,{})
			if a.is_empty() or b.is_empty() or a.room!=b.room or a.place!=row.location or a.point.distance_to(b.point)>48: invalid.append(row)
		for frame in 120:
			app.motion.update(w.data.agents);SimLeisurePlan.observe(w,app.motion)
	check(w.social.physical_positions!=null,"normal app ticks supply physical observations")
	check(count>0,"original residents still converse in normal simulation")
	check(invalid.is_empty(),"every new conversation has same actual room venue and close distance")
	var saved: Dictionary=app.progress_snapshot()
	app._load_document(JSON.stringify(saved),"social resume");await settle()
	check(w.social.physical_positions==null,"reload clears stale transient observations")
	app._tick_simulation();check(w.social.physical_positions!=null,"next tick refreshes observations from restored motion")
	var report:={"checks":checks,"failures":failures,"conversations":count,"scope":"96 original app ticks with 120 motion frames each, no job/needs/position changes, all generated pair logs checked against pre-tick actual observations, reload refresh; no visual art or production AI verification"}
	FileAccess.open("res://docs/SOCIAL_PRESENCE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var bytes:=FileAccess.get_file_as_bytes("res://tests/golden/hangout-natural-departure.json.gz").decompress_dynamic(67108864,FileAccess.COMPRESSION_GZIP)
	app._load_document(bytes.get_string_from_utf8(),"natural departure replay")
	var w: SimWorld=app.simulation;var r: Dictionary=SimHangoutVisits.records(w).values()[0]
	var origin: Dictionary={};var distance: Dictionary={};var max_step:=0.0;var walkable:=true
	for id in r.people: origin[id]=Vector2(app.motion.positions[id].x,app.motion.positions[id].y);distance[id]=0.0
	for t in 16:
		for frame in 120:
			var before: Dictionary={}
			for id in r.people: before[id]=Vector2(app.motion.positions[id].x,app.motion.positions[id].y)
			app.motion.update(w.data.agents)
			for id in r.people:
				var point:=Vector2(app.motion.positions[id].x,app.motion.positions[id].y)
				max_step=maxf(max_step,point.distance_to(before[id]));distance[id]+=point.distance_to(before[id]);walkable=walkable and app.motion.layout._walkable(point)
			SimHangoutVisits.observe(w,app.motion)
			if r.state!="traveling": break
		if r.state!="traveling": break
		app._tick_simulation()
		if r.state!="traveling": break
	check(distance.values().all(func(d): return d>300),"both natural travelers make sustained route progress")
	check(walkable and max_step<2,"natural replay follows walkable small steps without teleport")
	check(r.state=="cancelled" and "睡眠時段" in r.reason,"existing sleep priority still ends this too-late journey")
	check(not r.has("arrived"),"movement progress does not falsely claim destination arrival")
	var report:={"checks":checks,"failures":failures,"start_tick":456,"end_tick":int(w.data.tickCount),"distance_walked":distance,"maximum_step":max_step,"outcome":r,"scope":"unchanged original app natural departure snapshot from five-day baseline; real motion and normal ticks, no changed positions/jobs/needs/clock/resources; fixture replay, not fresh 32-day natural run"}
	FileAccess.open("res://docs/HANGOUT_ROUTE_REPLAY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

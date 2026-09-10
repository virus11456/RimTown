extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	app._load_document(FileAccess.get_file_as_string("res://tests/elections/compatibility-save.json.tmp"),"選舉驗收")
	app.show_elections();await settle()
	check(has_text(app.drawer_body,"競選登記中"),"campaign visible")
	var w: SimWorld=app.simulation
	w.data.election.candidates=w.data.election.candidates.filter(func(c): return c.agentId!="player")
	app.show_elections();await settle();press(app.drawer_body,"參選：文化教育")
	check(w.data.election.candidates.any(func(c): return c.agentId=="player"),"registration button commits eligible traveler")
	w.data.election.phase="voting";w.data.election.votes={};app.show_elections();await settle()
	var id: String=w.data.election.candidates[0].agentId;press(app.drawer_body,"投給 "+str(w.data.agents[id].name));await settle()
	check(w.data.election.votes.get("player")==id,"ballot button commits")
	var before:=w.snapshot();check(not SimElections.vote(w,id),"duplicate ballot rejected");check(equal(before,w.snapshot()),"no duplicate state mutation")
	for child in app.drawer_body.get_children():
		if child is Control:
			check(child.size.x<=app.drawer.size.x,"375px election width")
	w.data.election.votingDaysLeft=1;w.data.clock.hour=23;w.data.clock.minute=45
	app._tick_simulation();app.show_elections();await settle();check(has_text(app.drawer_body,"結果公告"),"actual midnight result UI")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
	for i in 96*5: w.tick();restored.tick()
	check(equal(w.snapshot(),restored.snapshot()),"all-mode five-day result resume")
	var report:={"checks":checks,"failures":failures,"scope":"375px native scene, eligible registration, ballot, duplicate prevention, midnight result and five-day all-mode resume; explicit campaign fixture, no production AI"}
	FileAccess.open("res://docs/ELECTION_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;check(w.finale_choice_enabled,"normal game defaults to player finale choice")
	w.data.questSystem.quests.ch5_legacy.status="active"
	var def: Dictionary=SimQuests.rules().main.back()
	for route in def.routes:
		for c in route.conditions: w.data.questSystem.quests.ch5_legacy.routes[route.id][c.label]={"progress":c.target,"completed":route.id!="peace"}
	w.data.agents.player.relationships.lin_mei={"targetName":"林美","affinity":80,"romanticInterest":80,"status":"married"}
	app.show_quests();await settle()
	check(w.data.multiEnding.get("endingTriggered")==null,"opening page does not select first route")
	check(has_text(app.drawer_body,"你已婚"),"marriage override explained before decision")
	var found:=false
	for child in app.drawer_body.get_children():
		if child is Button and child.text=="選擇結局：和平結局": found=true;check(child.disabled,"unearned ending disabled")
	check(found,"route choice visible")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px final quest fits")
	press(app.drawer_body,"選擇結局：傳奇結局");await settle()
	check(w.data.multiEnding.endingTriggered=="legend","clicked route determines ending")
	check(has_text(app.drawer_body,str(SimQuests.rules().endings.legend.title)),"selected ending shown")
	var report:={"checks":checks,"failures":failures,"scope":"375px normal manual ending, qualified condition fixtures, disabled unfinished route, marriage warning, actual ending choice callback"}
	FileAccess.open("res://docs/FINALE_CHOICE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

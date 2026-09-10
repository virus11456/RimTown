extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	check(w.governance_enabled,"normal game enables public authority")
	app.show_building_site("watchtower");await settle();var stock: Dictionary=w.data.stockpile.duplicate(true)
	press(app.drawer_body,"提出建議：開工");await settle()
	check(has_text(app.drawer_body,"鎮務提案與權限"),"proposal opens review page")
	check(equal(stock,w.data.stockpile) and w.data.buildings.projects.is_empty(),"UI proposal cannot spend")
	check(has_text(app.drawer_body,"瞭望塔"),"specific proposal displayed")
	for i in 96: w.tick()
	app.show_governance();await settle();press(app.drawer_body,"執行核准案 #1");await settle()
	check(w.data.buildings.projects.size()==1,"approved button starts actual construction")
	check(app.world_view!=null,"geometry retained after approval")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px proposal width")
	app.show_player_gift("lin_mei");await settle();check(has_text(app.drawer_body,"公共慰問"),"public welfare explanation")
	check(not has_text(app.drawer_body,"銀幣紅包"),"no cash gifts offered")
	var report:={"checks":checks,"failures":failures,"scope":"375px normal game proposal UI, zero upfront charge, real midnight review and authorized construction, public welfare labels"}
	FileAccess.open("res://docs/GOVERNANCE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

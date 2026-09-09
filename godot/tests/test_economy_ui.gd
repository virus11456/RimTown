extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false)
	var raw: String=app.document.serialize();var w: SimWorld=app.simulation
	check(w.economy_enabled,"new imports enable economy")
	w.data.clock.hour=23;w.data.clock.minute=30
	var stock: Dictionary=w.data.stockpile.duplicate(true)
	app._tick_simulation();check(equal(stock,w.data.stockpile),"no settlement before midnight")
	app._tick_simulation();check(not equal(stock,w.data.stockpile),"settlement at midnight")
	var changes: int=w.data.stockpile.history.size()
	app._tick_simulation();check(w.data.stockpile.history.size()==changes,"no duplicate settlement after midnight")
	app.show_stockpile("meals");check(has_text(app.drawer_body,"每日餐食消耗"),"daily consumption visible in ledger")
	var saved:=w.snapshot();var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(saved,"",false,true)))
	for i in 960: w.tick();restored.tick()
	check(equal(w.snapshot(),restored.snapshot()),"ten-day combined mode deterministic resume")
	check(app.document.serialize()==raw,"original import bytes untouched")
	FileAccess.open("res://tests/economy/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_tab("設定",true);press(app.drawer_body,"每日生產與消耗：開啟")
	check(not w.economy_enabled,"toggle off")
	w.research_enabled=false # Research has an independent stock-consuming toggle.
	w.data.clock.hour=23;w.data.clock.minute=45;stock=w.data.stockpile.duplicate(true);app._tick_simulation()
	check(equal(stock,w.data.stockpile),"disabled midnight preserves resources")
	var off:=SimWorld.new();off.load_snapshot(w.snapshot());check(not off.economy_enabled,"disabled flag saved")
	app.show_work_policy()
	var choice: OptionButton
	for child in app.drawer_body.get_children():
		if child is OptionButton: choice=child;break
	choice.select(0);choice.item_selected.emit(0)
	check(w.data.workPolicy.meals=="off","UI sets kitchen off")
	check(w.data.messageLog.back().content.ends_with("休工（明日生效）"),"policy logged")
	var policy_saved:=SimWorld.new();policy_saved.load_snapshot(w.snapshot());check(policy_saved.data.workPolicy.meals=="off","policy persists")
	var unchanged:=w.snapshot();check(not SimEconomy.set_policy(w,"food","extra") and equal(unchanged,w.snapshot()),"invalid policy no mutation")
	var report:={"checks":checks,"failures":failures,"scope":"default enabled, midnight exactly once, disabled settlement, ledger, unchanged source import, ten-day all-mode resume; full original World.tick not claimed"}
	FileAccess.open("res://docs/ECONOMY_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

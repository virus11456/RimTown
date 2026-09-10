extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var path:=ProjectSettings.globalize_path("res://../../../outputs/第140天結局後.rimtown")
	app.dialog.file_selected.emit(path);await settle()
	check(app.simulation.data.multiEnding.get("endingTriggered")=="legend","delivered archive imports with ending intact")
	var tick: int=app.simulation.data.tickCount;app._tick_simulation()
	check(app.simulation.data.tickCount==tick+1,"loaded long-running game remains playable")
	var report:={"checks":checks,"failures":failures,"scope":"actual delivered 140-day compressed archive via normal native file callback and next app tick"}
	FileAccess.open("res://docs/LONG_SAVE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

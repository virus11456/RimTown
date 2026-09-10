extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var path:="res://tests/main-route-ready.json.tmp"
	check(FileAccess.get_file_as_bytes(path).size()<=20*1024*1024,"checkpoint fits normal import limit")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	check(app._load_document(FileAccess.get_file_as_string(path),"第130天結局前"),"natural-route checkpoint imports through normal loader")
	app.show_quests();await settle()
	check(SimQuests.finale_ready(app.simulation,"legend") and app.simulation.data.multiEnding.get("endingTriggered")==null,"earned pending ending retained after import")
	press(app.drawer_body,"選擇結局：傳奇結局");await settle()
	check(app.simulation.data.multiEnding.endingTriggered=="legend","real checkpoint chosen through UI")
	var report:={"checks":checks,"failures":failures,"scope":"unmodified 130-day simulated-route save below import size limit, normal main loader, pending legend and actual UI choice"}
	FileAccess.open("res://docs/FINALE_CHECKPOINT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

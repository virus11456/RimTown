extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	app.export_directory="/private/tmp"
	app.show_tab("小鎮",true);await settle();press(app.drawer_body,"匯出試玩進度");await settle()
	var path: String=app.status.text.trim_prefix("存檔已儲存於 ")
	check(path.ends_with(".rimtown") and FileAccess.file_exists(path),"normal progress button writes archive")
	var bytes:=FileAccess.get_file_as_bytes(path);var before: Dictionary=app.progress_snapshot()
	app.dialog.file_selected.emit(path);await settle();check(equal(before,app.progress_snapshot()),"file picker archive restores real world")
	check(app.document.data._godot4a.has("motion") and app.document.data._godot4a.has("house_map"),"physical positions and homes retained")
	var damaged:=bytes.duplicate();damaged[16]=damaged[16]^1
	before=app.simulation.snapshot();check(not app._load_save_bytes(damaged,"corrupt") and equal(before,app.simulation.snapshot()),"corrupt archive cannot replace active world")
	check(not app._load_save_bytes("{broken".to_utf8_buffer(),"bad json") and equal(before,app.simulation.snapshot()),"bad legacy JSON also preserves world")
	app.show_tab("小鎮",true);await settle();press(app.drawer_body,"匯出進度 JSON 相容版");await settle()
	var json_path: String=app.status.text.trim_prefix("存檔已儲存於 ")
	check(json_path.ends_with(".json") and FileAccess.file_exists(json_path),"plain JSON progress export retained")
	check(app._load_save_bytes(FileAccess.get_file_as_bytes(json_path),"legacy"),"JSON still loads")
	var raw: String=app.document.serialize();app.export_save();var copy_path: String=app.status.text.trim_prefix("存檔已儲存於 ")
	check(FileAccess.get_file_as_string(copy_path)==raw,"original copy stays byte-exact")
	for file in [path,json_path,copy_path]: DirAccess.remove_absolute(file)
	var report:={"checks":checks,"failures":failures,"scope":"375px progress/archive and JSON buttons, normal file picker signal, scene/motion persistence, corruption rejects without replacing world, byte-exact copy; native runtime"}
	FileAccess.open("res://docs/SAVE_ARCHIVE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

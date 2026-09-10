extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for width in [375,1280]:
		viewport.size=Vector2i(width,812)
		for pair in [["prosper","繁榮"],["peace","和平"]]:
			var path:=ProjectSettings.globalize_path("res://../../../outputs/三路線結局前.rimtown")
			app.dialog.file_selected.emit(path);await settle()
			var w: SimWorld=app.simulation
			check(w.data.multiEnding.get("endingTriggered")==null,"archive is before ending choice")
			app.show_quests();await settle()
			var label: String="選擇結局："+pair[1]+"結局"
			var enabled:=false;var fits:=true
			for child in app.drawer_body.get_children():
				if child is Button and child.text==label: enabled=not child.disabled
				if child is Control and child.size.x>app.drawer.size.x: fits=false
			check(fits,"route page fits viewport "+str(width))
			check(enabled,"earned route button enabled "+pair[0])
			press(app.drawer_body,label);await settle()
			check(w.data.multiEnding.endingTriggered==pair[0],"actual button chooses "+pair[0])
			check(has_text(app.drawer_body,str(SimQuests.rules().endings[pair[0]].title)),"chosen ending visible")
			var frozen: Dictionary=w.data.multiEnding.endingData.duplicate(true)
			var tick: int=w.data.tickCount;app._tick_simulation()
			check(w.data.tickCount==tick+1 and equal(frozen,w.data.multiEnding.endingData),"game continues without rewriting ending")
	var report:={"checks":checks,"failures":failures,"scope":"actual earned compressed checkpoints, native file selection callback, enabled finale buttons and ending display at 375/1280 pixels, continued app tick; headless UI, not rendered walking"}
	FileAccess.open("res://docs/REMAINING_ROUTES_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends Node3D
func _ready() -> void:call_deferred("capture")
func capture() -> void:
	for mobile in [false,true]:
		var viewport:=SubViewport.new();viewport.size=Vector2i(375,812) if mobile else Vector2i(1280,800);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
		var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await get_tree().process_frame;app.set_process(false)
		app._load_document(FileAccess.get_file_as_string("res://docs/CARE_FOLLOWUP_HARBOR_PROGRESS.rimtown"),"照護指南")
		app.active_tab="居民";app.hud.visible=true;app.drawer.show();app.show_care_guide("hb_shishu")
		for section in ["top","bottom"]:
			if section=="bottom": app.drawer_body.get_parent().scroll_vertical=10000
			await get_tree().process_frame;await get_tree().process_frame;await RenderingServer.frame_post_draw
			var file: String="care-guide-"+("mobile" if mobile else "desktop")+"-"+section+".png"
			viewport.get_texture().get_image().save_png("res://docs/"+file)
		viewport.queue_free();await get_tree().process_frame
	print("CARE_GUIDE_CAPTURE_COMPLETE");get_tree().quit()

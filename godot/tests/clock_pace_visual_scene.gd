extends Node3D
func _ready() -> void:call_deferred("capture_pace")
func capture_pace() -> void:
 var cases: Array=[]
 for mobile in [false,true]:
  var viewport:=SubViewport.new();viewport.size=Vector2i(375,812) if mobile else Vector2i(1280,800);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
  var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await get_tree().process_frame;app.set_process(false)
  app.load_demo("harbor" if mobile else "frontier");app.set_clock_pace("relaxed");app.show_tab("設定",true)
  await get_tree().process_frame;await get_tree().process_frame;await RenderingServer.frame_post_draw
  var file:="clock-pace-"+("mobile" if mobile else "desktop")+".png"
  viewport.get_texture().get_image().save_png("res://docs/"+file)
  cases.append({"mobile":mobile,"file":file,"width":viewport.size.x,"height":viewport.size.y,"mode":app.clock_pace(),"tick_seconds":app.motion.tick_seconds})
  viewport.queue_free();await get_tree().process_frame
 FileAccess.open("res://docs/CLOCK_PACE_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"native desktop/mobile settings; user-selected relaxed clock, original demo"},"  "))
 print("CLOCK_PACE_CAPTURE_COMPLETE");get_tree().quit()

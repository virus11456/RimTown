extends Node3D
const Fixture=preload("res://tests/resident_care_fixture.gd")
func _ready() -> void:call_deferred("capture_availability")
func capture_availability() -> void:
 var cases: Array=[]
 for spec in [["frontier",false],["harbor",true]]:
  var town: String=spec[0];var mobile: bool=spec[1]
  var viewport:=SubViewport.new();viewport.size=Vector2i(375,812) if mobile else Vector2i(1280,800);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
  var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await get_tree().process_frame;app.set_process(false)
  var pair: Dictionary=Fixture.prepare(app,town,"doctor")
  var w: SimWorld=app.simulation;w.social_enabled=true;w.social.observe_positions(app.motion)
  var provider: Dictionary=w.data.agents[pair.provider];provider.needs.hunger=100;provider.needs.rest=100
  Fixture.render(app);app.world_view._light_clock(w.data.clock);app.rig.width=35;app.rig.angle=135;app.rig.follow_player=false;app.rig._sync()
  app.summary.text="%s %d日 %02d:%02d · %d人"%[w.data.clock.season,w.data.clock.day,w.data.clock.hour,w.data.clock.minute,w.data.agents.size()]
  app.active_tab="居民";app.hud.visible=true;app.drawer.show();app.show_care_availability(pair.recipient)
  await get_tree().process_frame;await get_tree().process_frame;await RenderingServer.frame_post_draw
  var file:="care-availability-"+town+("-mobile" if mobile else "-desktop")+".png"
  viewport.get_texture().get_image().save_png("res://docs/"+file)
  cases.append({"town":town,"mobile":mobile,"width":viewport.size.x,"height":viewport.size.y,"file":file,"rows":SimCareAvailability.rows(w,app.motion,pair.recipient)})
  viewport.queue_free();await get_tree().process_frame
 FileAccess.open("res://docs/CARE_AVAILABILITY_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"controlled nearby doctor at work, native SubViewport drawer at 1280x800 and 375x812; no natural care completion claim"},"  "))
 print("CARE_AVAILABILITY_CAPTURE_COMPLETE");get_tree().quit()

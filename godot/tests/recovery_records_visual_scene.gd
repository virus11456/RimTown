extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_records")
func capture_records() -> void:
	var cases: Array=[]
	for town in ["frontier","harbor"]:
		var pair: Dictionary=Fixture.prepare(self,town,"doctor")
		var w: SimWorld=simulation;var m: SimMotion=motion;w.social_enabled=true;w.social.observe_positions(m)
		var a: Dictionary=w.data.agents[pair.recipient]
		for id in w.data.agents:
			if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
		var house: Dictionary=m.layout.houses[m.layout._house_id(pair.recipient,a.homeLocation)]
		var point:=m.layout._nearest(Vector2(house.doorPixelX,house.doorPixelY+32));m.positions[pair.recipient].x=point.x;m.positions[pair.recipient].y=point.y
		a.needs.rest=30;a.needs.hunger=50;SimResidentCare.begin_recovery(w,a,16)
		var captured: Array=[]
		for step in 12:
			_tick_simulation()
			if not a.has("_careRecovery"):
				captured.append(a.activity);Fixture.render(self);world_view.show_labels=false
				rig.width=35;rig.angle=135;rig.follow_player=false;rig.position=world_view.actors[pair.recipient].position+Vector3(0,.7,0);rig._sync()
				hud.visible=true;drawer.show();show_agenda(pair.recipient)
				await get_tree().process_frame;await get_tree().process_frame;await RenderingServer.frame_post_draw
				get_viewport().get_texture().get_image().save_png("res://docs/recovery-records-"+town+".png")
				cases.append({"town":town,"activity":a.activity,"at_home":SimHomeRest.arrived(w,a),"results":a.get("_careRecoveryResults",[]).duplicate(true)})
			for frame in 480: m.update(w.data.agents)
			if not a.has("_careRecovery"): break
		assert(not a.get("_careRecoveryResults",[]).is_empty())
	FileAccess.open("res://docs/RECOVERY_RECORDS_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"controlled near-home need deficit; regular tick, walking and actual at-home meal/rest with native agenda"},"  "))
	print("RECOVERY_RECORDS_CAPTURE_COMPLETE");get_tree().quit()

extends "res://scripts/view/main.gd"
const Render=preload("res://tests/outdoor_pose_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_cycle")
func capture_cycle() -> void:
	var cases: Array=[]
	for spec in [["frontier","chen_wei"],["frontier","gao_lang"],["harbor","hb_aduo"]]:
		var town: String=spec[0];var id: String=spec[1];load_demo(town)
		var w: SimWorld=simulation;var m: SimMotion=motion;w.social.observe_positions(m)
		var a: Dictionary=w.data.agents[id];var window:=SimShiftSleep.window(a,w.rules.jobs)
		w.data.clock.hour=posmod(int(window.start)-1,24);w.data.clock.minute=0
		a.needs.hunger=100;a.needs.rest=70;a.activity="idle";a.currentLocation=a.homeLocation
		var house: Dictionary=m.layout.houses[m.layout._house_id(id,a.homeLocation)];var offset:=id.unicode_at(0)%4
		var point:=m.layout._nearest(Vector2(house.interiorX+(offset%2-.5)*16,house.interiorY+(floori(offset/2.0)-.5)*16))
		m.positions[id]={"x":point.x,"y":point.y,"targetX":point.x,"targetY":point.y,"walking":false,"doorPhase":null,"activity":"idle","walkStep":0}
		for step in 4:
			_tick_simulation()
			if step in [0,3]:
				var phase:="settled" if step==0 else "sleeping"
				assert(a.activity==("idle" if step==0 else "sleeping") and SimHomeRest.arrived(w,a))
				Render.render(self);world_view.show_labels=false
				rig.width=35;rig.angle=135;rig.follow_player=false;rig.position=world_view.actors[id].position+Vector3(0,.7,0);rig._sync()
				hud.visible=true;drawer.show();show_agenda(id)
				await get_tree().process_frame;await get_tree().process_frame;await RenderingServer.frame_post_draw
				get_viewport().get_texture().get_image().save_png("res://docs/cycle-"+id+"-"+phase+".png")
				cases.append({"town":town,"id":id,"phase":phase,"hour":w.data.clock.hour,"minute":w.data.clock.minute,"original_sleep_start":window.start})
			for frame in 480: m.update(w.data.agents)
	FileAccess.open("res://docs/DAILY_CYCLE_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"original daytime/nighttime schedules; controlled at-home position and needs, regular ticks, pre-bed settled state and actual sleep entry"},"  "))
	print("DAILY_CYCLE_CAPTURE_COMPLETE");get_tree().quit()

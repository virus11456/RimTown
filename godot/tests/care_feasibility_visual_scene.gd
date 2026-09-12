extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_feasibility")
func capture_feasibility() -> void:
	var cases: Array=[]
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			var pair: Dictionary=Fixture.prepare(self,town,job)
			world_view.show_labels=false;world_view.actors.player.get_node("TravelerMarker").visible=false
			simulation.social_enabled=true;simulation.social.observe_positions(motion)
			for id in simulation.data.agents:
				if id!=pair.recipient: simulation.data.agents[id]._careVisitDay=SimClock.total_days(simulation.data.clock)
			simulation.data.clock.hour=int(simulation.rules.jobs[job].work_hours[1])-1;simulation.data.clock.minute=45
			var before: Dictionary=motion.positions.duplicate(true)
			SimResidentCare.tick(simulation)
			var a: Dictionary=simulation.data.agents[pair.recipient]
			assert(a.has("_careDeferred") and not a.has("_careVisit") and motion.positions==before)
			Fixture.render(self)
			rig.width=45;rig.angle=135;rig.follow_player=false;rig.position=world_view.actors[pair.recipient].position+Vector3(0,.7,0);rig._sync()
			world_view._light_clock(simulation.data.clock)
			var c: Dictionary=simulation.data.clock
			summary.text="%s %d日 %02d:%02d · %d人"%[c.season,c.day,c.hour,c.minute,simulation.data.agents.size()]
			hud.visible=true;drawer.show();show_agenda(pair.recipient)
			await get_tree().process_frame;await get_tree().process_frame;await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://docs/feasibility-"+town+"-"+job+".png")
			cases.append({"town":town,"job":job,"reason":a._careDeferred.reason,"no_departure":true})
	FileAccess.open("res://docs/CARE_FEASIBILITY_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"controlled near-closing clock and need; real preflight deferral, no position change, native agenda"},"  "))
	print("CARE_FEASIBILITY_CAPTURE_COMPLETE");get_tree().quit()

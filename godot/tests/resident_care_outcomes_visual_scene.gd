extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_outcomes")
func capture_pair(pair: Dictionary,label: String) -> void:
	rig.position=(world_view.actors[pair.provider].position+world_view.actors[pair.recipient].position)*.5+Vector3(0,.7,0);rig._sync()
	await get_tree().process_frame;await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/outcome-"+label+".png")
func capture_outcomes() -> void:
	var cases: Array=[]
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			world_view.show_labels=false
			var pair: Dictionary=Fixture.prepare(self,town,job,70)
			world_view.actors.player.get_node("TravelerMarker").visible=false
			hud.visible=false;rig.width=7;rig.angle=135;rig.follow_player=false;world_view._light_clock({"hour":12})
			var a: Dictionary=simulation.data.agents[pair.provider]
			var zone: Dictionary=motion.layout.buildings.get(a.currentLocation,{})
			if zone.has("doorPixelX"):
				var found:=false
				for y in range(zone.y+1,zone.y+zone.h-1):
					for x in range(zone.x+1,zone.x+zone.w-1):
						var point:=Vector2((x+.5)*16,(y+.5)*16)
						if not found and motion.layout._walkable(point):
							motion.positions.player.x=point.x;motion.positions.player.y=point.y;motion.positions.player.doorPhase=null;found=true
			for id in simulation.data.agents:
				if id!=pair.recipient: simulation.data.agents[id]._careVisitDay=SimClock.total_days(simulation.data.clock)
			simulation.social_enabled=true;simulation.social.observe_positions(motion)
			var start: Vector2=motion.layout._nearest(motion.layout._center("town_square"))
			motion.positions[pair.recipient].x=start.x;motion.positions[pair.recipient].y=start.y
			SimResidentCare.tick(simulation)
			assert(simulation.data.agents[pair.recipient].has("_careVisit"))
			SimResidentCare.apply(simulation,simulation.data.agents[pair.recipient],simulation.runtime[pair.recipient])
			for frame in 3000:
				motion.update(simulation.data.agents);Fixture.render(self)
				if frame%16==0: await get_tree().process_frame
				if not motion.positions[pair.recipient].walking and motion.positions[pair.recipient].get("doorPhase")==null: break
			simulation.data.tickCount+=1;SimResidentCare.tick(simulation)
			SimResidentCare.apply(simulation,simulation.data.agents[pair.recipient],simulation.runtime[pair.recipient])
			for frame in 120:
				Fixture.render(self)
				if frame%4==0: await get_tree().process_frame
			assert(world_view.resident_care.pairs.has(pair.provider))
			await capture_pair(pair,town+"-"+job+"-exchange")
			simulation.data.tickCount+=2;SimResidentCare.tick(simulation)
			Fixture.render(self);assert(world_view.resident_care.pairs.is_empty())
			await capture_pair(pair,town+"-"+job+"-stopped")
			assert(simulation.data.agents[pair.recipient]._careResults.back().state=="completed")
			hud.visible=true;drawer.show();show_agenda(pair.recipient)
			await capture_pair(pair,town+"-"+job+"-result")
			cases.append({"town":town,"job":job,"actual_conversation":true,"bounded_visit_completed":true})
	FileAccess.open("res://docs/RESIDENT_CARE_OUTCOMES_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"controlled needs and clinic; automatic request, real walking from square, actual arrival conversation and bounded completion; native render"},"  "))
	print("RESIDENT_CARE_OUTCOMES_CAPTURE_COMPLETE")

	get_tree().quit()

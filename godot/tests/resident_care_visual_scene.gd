extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_care")
func capture_pair(pair: Dictionary,label: String) -> void:
	rig.position=(world_view.actors[pair.provider].position+world_view.actors[pair.recipient].position)*.5+Vector3(0,.7,0);rig._sync()
	await get_tree().process_frame;await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/care-"+label+".png")
func capture_care() -> void:
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
			Fixture.converse(self,pair)
			for frame in 120:
				Fixture.render(self)
				if frame%4==0: await get_tree().process_frame
			assert(world_view.resident_care.pairs.has(pair.provider))
			await capture_pair(pair,town+"-"+job+"-exchange")
			simulation.data.agents[pair.recipient].activity="heading_home"
			Fixture.render(self);assert(world_view.resident_care.pairs.is_empty())
			await capture_pair(pair,town+"-"+job+"-stopped")
			cases.append({"town":town,"job":job,"actual_conversation":true,"stops_on_return_home":true})
	FileAccess.open("res://docs/RESIDENT_CARE_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"controlled clinic, needs, recipient location and conversation event; native display with no new medical outcome"},"  "))
	print("RESIDENT_CARE_CAPTURE_COMPLETE")

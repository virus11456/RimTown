extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/civic_pose_fixture.gd")
const Render=preload("res://tests/outdoor_pose_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_duty")
func capture_worker(id: String,label: String) -> void:
	rig.position=world_view.actors[id].position+Vector3(0,.6,0);rig._sync()
	await get_tree().process_frame;await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/civic-"+label+".png")
func capture_duty() -> void:
	var cases: Array=[]
	for sample in [["frontier","day"],["frontier","night"],["frontier","post"],["frontier","trader"],["harbor","day"],["harbor","night"],["harbor","trader"]]:
		world_view.show_labels=false
		var id: String=Fixture.prepare(self,sample[0],sample[1])
		world_view.actors.player.get_node("TravelerMarker").visible=false
		hud.visible=false;rig.width=6;rig.angle=135;rig.follow_player=false;world_view._light_clock(simulation.data.clock)
		var arrived:=false
		for frame in 2200:
			motion.update(simulation.data.agents)
			if CivicWorkPerformance.ready(simulation,motion,id): arrived=true;break
		assert(arrived)
		var a: Dictionary=simulation.data.agents[id];var p: Dictionary=motion.positions[id]
		var zone: Dictionary=motion.layout.buildings.get(a.currentLocation,{})
		if zone.has("doorPixelX"):
			var found:=false
			for y in range(zone.y+1,zone.y+zone.h-1):
				for x in range(zone.x+1,zone.x+zone.w-1):
					var point:=Vector2((x+.5)*16,(y+.5)*16)
					if not found and motion.layout._walkable(point) and point.distance_to(Vector2(p.x,p.y))>24:
						motion.positions.player.x=point.x;motion.positions.player.y=point.y;motion.positions.player.doorPhase=null;motion.positions.player.walking=false;found=true
			assert(found)
		var label: String=str(sample[0])+"-"+str(sample[1])
		for frame in 500:
			Render.render(self)
			if frame%4==0: await get_tree().process_frame
			if frame in [120,480]: await capture_worker(id,label+"-"+str(frame))
		a.activity="heading_home";a.currentLocation=a.homeLocation
		for frame in 30: motion.update(simulation.data.agents);Render.render(self)
		assert(not world_view.resident_work.phases.has(id) and Render.visible_tools(world_view.actors[id]).is_empty())
		await capture_worker(id,label+"-leaving")
		cases.append({"town":sample[0],"kind":sample[1],"arrived":arrived,"gesture_stops_on_leaving":true})
	FileAccess.open("res://docs/CIVIC_WORK_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"controlled duty clock, tower work point, nearby NPC starting point and player room position; real collision arrival; actual day/night lighting"},"  "))
	print("CIVIC_WORK_CAPTURE_COMPLETE")

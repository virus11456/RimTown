extends "res://scripts/view/main.gd"
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_residents")
func capture(id: String,label: String) -> void:
	rig.position=world_view.actors[id].position+Vector3(0,.65,0);rig._sync()
	await get_tree().process_frame;await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/resident-gait-"+label+".png")
func capture_residents() -> void:
	var cases: Array=[]
	for sample in [["frontier",9,"male"],["frontier",28,"female"],["harbor",70,"male"],["harbor",28,"male"]]:
		load_demo(sample[0])
		var id: String=simulation.data.agents.keys().filter(func(k):return k!="player")[0]
		simulation.data.agents[id].age=sample[1];simulation.data.agents[id].gender=sample[2]
		world_view.display_save(simulation.snapshot())
		var positions: Dictionary=motion.positions.duplicate(true)
		positions[id].x=34.5*16;positions[id].y=30.5*16;positions[id].activity="heading_home";positions[id].walking=false
		world_view.animate_agents(positions);world_view.animate_resident_gaits(positions,1.0/60)
		rig.width=6;rig.angle=225;rig.follow_player=false;hud.visible=false;world_view._light_clock({"hour":12})
		for frame in 70:
			positions[id].x+=.6;positions[id].walking=true
			assert(motion.layout._walkable(Vector2(positions[id].x,positions[id].y)))
			world_view.animate_agents(positions);world_view.animate_resident_gaits(positions,1.0/60)
			await get_tree().process_frame
			if frame==42: await capture(id,str(sample[0])+"-"+str(sample[1])+"-walking")
		for frame in 30:
			positions[id].walking=false;positions[id].activity="idle"
			world_view.animate_agents(positions);world_view.animate_resident_gaits(positions,1.0/60)
		await capture(id,str(sample[0])+"-"+str(sample[1])+"-stopped")
		cases.append({"town":sample[0],"age":sample[1],"gender":sample[2],"walking_frames":70,"stopped_frames":30})
	FileAccess.open("res://docs/RESIDENT_GAIT_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"controlled NPC model variants and walkable plaza positions; no claim of natural travel or sleep screenshots"},"  "))
	print("RESIDENT_GAIT_CAPTURE_COMPLETE")

extends "res://tests/interior_visual_scene.gd"
func capture(name: String) -> void:
	await get_tree().process_frame;await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/desks-"+name+".png")
func capture_interiors() -> void:
	var records: Array=[]
	for pair in [["frontier","cook"],["frontier","tailor"],["frontier","researcher"],["harbor","cook"],["harbor","researcher"]]:
		var town: String=pair[0];var job: String=pair[1]
		var task:=Fixture.prepare(self,town,job)
		var station:=SimWorkstation.resolve(motion.layout,job)
		var zone: Dictionary=motion.layout.buildings[task.location]
		hud.visible=false
		motion.positions.player.x=zone.doorPixelX;motion.positions.player.y=zone.doorPixelY
		motion.positions.player.walking=false;motion.positions.player.doorPhase=null
		rig.position=Vector3(station.bench.x,1.2,station.bench.y+.5);rig.width=8;rig.angle=225;rig._sync()
		world_view._light_clock({"hour":12})
		assert(await travel(station.stand))
		for i in 120:
			var offset: Vector2=station.stand-Vector2(motion.positions.player.x,motion.positions.player.y)
			if offset.length()<.1: break
			motion.move_player(offset.limit_length(),minf(1.0/60,offset.length()/72));steps+=1
			world_view.animate_agents(motion.positions);await get_tree().process_frame
		motion.move_player(Vector2.ZERO,1.0/60)
		assert(SimCareers.start(simulation,task.id).ok)
		var min_height:=INF
		for i in 160:
			world_view.animate_agents(motion.positions)
			world_view.service_performance.update(world_view,simulation,motion,1.0/60)
			var tool: Node3D=world_view.actors.player.get_node("Body/ServiceRight/acc_tool_book") if job=="researcher" else world_view.actors.player.get_node("Body/ServiceLeft/Duty_"+job+"_left")
			min_height=minf(min_height,DeskPerformance.bounds(tool).position.y)
			await get_tree().process_frame
			if i in [45,93,130]: await capture(town+"-"+job+"-"+str(i))
		assert(await travel(motion.layout._center(task.location)))
		assert(SimCareers.book(simulation).active.is_empty())
		records.append({"town":town,"job":job,"minimum_material_height":min_height,"walked_to_station":true,"leave_cancelled":true})
	FileAccess.open("res://docs/DESK_STATIONS_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":records,"steps":steps},"  "))
	print("DESK_STATIONS_CAPTURE_COMPLETE")

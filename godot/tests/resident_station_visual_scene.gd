extends "res://scripts/view/main.gd"
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_workers")
func pose_frame() -> void:
	world_view.animate_agents(motion.positions);world_view.animate_resident_gaits(motion.positions,1.0/60)
	world_view.resident_work.update(world_view,simulation,motion,1.0/60)
func capture_worker(id: String,label: String) -> void:
	rig.position=world_view.actors[id].position+Vector3(0,.6,0);rig._sync()
	await get_tree().process_frame;await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/resident-station-"+label+".png")
func capture_workers() -> void:
	var cases: Array=[]
	for sample in [["frontier","carpenter"],["frontier","blacksmith"],["frontier","cook"],["frontier","tailor"],["frontier","researcher"],["harbor","cook"],["harbor","researcher"]]:
		load_demo(sample[0]);motion.manual_player=true
		var job: String=sample[1];var station:=SimWorkstation.resolve(motion.layout,job)
		var ids: Array=simulation.data.agents.keys().filter(func(k):return k!="player");ids.sort();var id: String=ids[0]
		for agent in simulation.data.agents.values(): agent.activity="idle"
		var a: Dictionary=simulation.data.agents[id];a.jobKey=job;a.age=28;a.activity="working";a.currentLocation=SimWorkstation.LOCATIONS[job]
		world_view.display_save(simulation.snapshot())
		# Controlled room fixture. Arrival itself uses normal collision routing from door.
		var p: Dictionary=motion.positions[id];var door: Dictionary=motion.door(a.currentLocation,id)
		p.x=door.x;p.y=door.y;p.erase("_directedGoal")
		var zone: Dictionary=motion.layout.buildings[a.currentLocation];var found:=false
		for y in range(zone.y+1,zone.y+zone.h-1):
			for x in range(zone.x+1,zone.x+zone.w-1):
				var point:=Vector2((x+.5)*16,(y+.5)*16)
				if not found and motion.layout._walkable(point) and point.distance_to(station.stand)>32:
					motion.positions.player.x=point.x;motion.positions.player.y=point.y;motion.positions.player.doorPhase=null;motion.positions.player.walking=false;found=true
		assert(found)
		hud.visible=false;rig.width=5;rig.angle=135;rig.follow_player=false;world_view._light_clock({"hour":12})
		var arrived:=false
		for frame in 3000:
			motion.update(simulation.data.agents)
			if not p.walking and Vector2(p.x,p.y).distance_to(station.stand)<=2: arrived=true;break
		assert(arrived)
		for frame in 100:
			pose_frame();await get_tree().process_frame
			if frame in [45,93]: await capture_worker(id,str(sample[0])+"-"+job+"-"+str(frame))
		assert(world_view.interior.opened==a.currentLocation)
		cases.append({"town":sample[0],"job":job,"arrived":arrived,"working":world_view.resident_work.phases.has(id)})
	FileAccess.open("res://docs/RESIDENT_WORKSTATION_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"controlled adult job and player room positions; NPC follows real collision route from door; 2 native work poses per station"},"  "))
	print("RESIDENT_WORKSTATION_CAPTURE_COMPLETE")

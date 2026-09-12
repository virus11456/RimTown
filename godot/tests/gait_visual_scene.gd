extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_routes")
func capture(name: String) -> void:
	rig.position=world_view.actors.player.position+Vector3(0,.6,0);rig._sync()
	await get_tree().process_frame;await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/gait-"+name+".png")
func capture_routes() -> void:
	var records: Array=[]
	for pair in [["frontier","cook"],["harbor","researcher"]]:
		var town: String=pair[0];var job: String=pair[1]
		var task:=Fixture.prepare(self,town,job)
		var z: Dictionary=motion.layout.buildings[task.location]
		motion.positions.player.x=z.doorPixelX;motion.positions.player.y=z.doorPixelY;motion.move_player(Vector2.ZERO,0)
		var station:=SimWorkstation.resolve(motion.layout,job)
		rig.position=Vector3(z.x+z.w*.5,1,z.y+z.h*.5);rig.width=7;rig.angle=225;rig.follow_player=false;rig._sync()
		hud.visible=false;world_view._light_clock({"hour":12})
		assert(station_approach.begin(simulation,motion,task.id,job))
		var frames:=0;var maximum:=0.0
		for frame in 3000:
			var before:=Vector2(motion.positions.player.x,motion.positions.player.y)
			_process_traveler(1.0/60);frames+=1
			world_view.service_performance.update(world_view,simulation,motion,1.0/60)
			world_view.traveler_gait.update(world_view,motion.positions,1.0/60)
			maximum=maxf(maximum,before.distance_to(Vector2(motion.positions.player.x,motion.positions.player.y)))
			assert(maximum<=1.201)
			await get_tree().process_frame
			if frame in [15,22,30,37]: await capture(town+"-"+job+"-"+str(frame))
			if station_approach.job.is_empty(): break
		assert(SimWorkstation.error(motion,job).is_empty())
		assert(SimCareers.book(simulation).active.is_empty())
		for frame in 20:
			motion.move_player(Vector2.ZERO,0);world_view.service_performance.update(world_view,simulation,motion,1.0/60);world_view.traveler_gait.update(world_view,motion.positions,1.0/60)
		await capture(town+"-"+job+"-arrived")
		records.append({"town":town,"job":job,"frames":frames,"maximum_step":maximum,"arrived_without_starting":true})
	FileAccess.open("res://docs/TRAVELER_GAIT_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":records},"  "))
	print("TRAVELER_GAIT_CAPTURE_COMPLETE")

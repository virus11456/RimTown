extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_routes")
func pose() -> void:
	world_view.animate_agents(motion.positions)
	world_view.service_performance.update(world_view,simulation,motion,1.0/60)
	world_view.traveler_gait.update(world_view,motion.positions,1.0/60)
func capture(name: String) -> void:
	rig.position=world_view.actors.player.position+Vector3(0,.6,0);rig._sync()
	await get_tree().process_frame;await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/ankle-"+name+".png")
func capture_routes() -> void:
	var records: Array=[]
	for town in ["frontier","harbor"]:
		for fast in [false,true]:
			var job:="cook" if town=="frontier" else "researcher"
			var task:=Fixture.prepare(self,town,job)
			var z: Dictionary=motion.layout.buildings[task.location]
			motion.positions.player.x=z.doorPixelX;motion.positions.player.y=z.doorPixelY;motion.manual_player=true;motion.move_player(Vector2.ZERO,0)
			var station:=SimWorkstation.resolve(motion.layout,job)
			var route:=motion.pathfinder.find_path(Vector2(z.doorPixelX,z.doorPixelY),station.stand)
			route.append({"x":station.stand.x,"y":station.stand.y});var index:=0
			rig.width=6;rig.angle=225;rig.follow_player=false;rig._sync();hud.visible=false;world_view._light_clock({"hour":12});pose()
			var prefix: String=town+("-fast" if fast else "-walk");var captures: Array=[];var frames:=0;var maximum:=0.0
			for frame in 2000:
				var before:=Vector2(motion.positions.player.x,motion.positions.player.y)
				if before.distance_to(station.stand)<.15: break
				while index<route.size()-1 and before.distance_to(Vector2(route[index].x,route[index].y))<.15: index+=1
				var offset:=Vector2(route[index].x,route[index].y)-before
				motion.move_player(offset.limit_length(),minf(1.0/60,offset.length()/(SimMotion.PLAYER_FAST_SPEED if fast else SimMotion.PLAYER_WALK_SPEED)),fast)
				pose();frames+=1
				maximum=maxf(maximum,before.distance_to(Vector2(motion.positions.player.x,motion.positions.player.y)));assert(maximum<=1.201)
				await get_tree().process_frame
				for side in 2:
					var foot: Dictionary=world_view.traveler_gait.feet[side]
					if not foot.planted or world_view.interior.opened!=str(task.location): continue
					var tag:="heel" if foot.pitch<-.06 else "toe" if foot.pitch>.12 else ""
					if not tag.is_empty() and not captures.has(tag): captures.append(tag);await capture(prefix+"-"+tag)
				if captures.has("heel") and captures.has("toe") and not captures.has("stopped"):
					for stop_frame in 20: motion.move_player(Vector2.ZERO,0);pose()
					await capture(prefix+"-stopped");captures.append("stopped")
			assert(SimWorkstation.error(motion,job).is_empty());assert(SimCareers.book(simulation).active.is_empty())
			assert(captures.size()==3)
			records.append({"town":town,"fast":fast,"frames":frames,"maximum_step":maximum,"captures":captures,"arrived_without_starting":true})
	FileAccess.open("res://docs/ANKLE_PACE_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":records},"  "))
	print("ANKLE_PACE_CAPTURE_COMPLETE")

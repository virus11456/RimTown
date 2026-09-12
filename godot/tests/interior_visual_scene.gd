extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
var steps:=0
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_interiors")
func travel(goal: Vector2) -> bool:
	var p: Dictionary=motion.positions.player
	var path:=motion.pathfinder.find_path(Vector2(p.x,p.y),goal)
	if path.is_empty(): return false
	for point in path:
		var target:=Vector2(point.x,point.y)
		for i in 4000:
			var delta:=target-Vector2(p.x,p.y)
			if delta.length()<.1: break
			motion.move_player(delta.limit_length(),minf(1.0/60,delta.length()/72));steps+=1
			assert(motion.layout._walkable(Vector2(p.x,p.y)))
			var place:=SimCareerPresence.place(motion,"player")
			if not place.is_empty(): simulation.data.agents.player.currentLocation=place
			_validate_career_presence();world_view.animate_agents(motion.positions)
			world_view.service_performance.update(world_view,simulation,motion,1.0/60)
			await get_tree().process_frame
	motion.move_player(Vector2.ZERO,1.0/60)
	return Vector2(p.x,p.y).distance_to(goal)<12
func capture(name: String) -> void:
	await get_tree().process_frame;await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/interior-"+name+".png")
func capture_interiors() -> void:
	var records: Array=[]
	for town in ["frontier","harbor"]:
		for role in ["cook","researcher","home"]:
			var task: Dictionary={}
			var key: String=""
			if role!="home":
				task=Fixture.prepare(self,town,role);key=task.location
			else:
				load_demo(town)
				var id:=SimGovernance.mayor(simulation);key=motion.layout.agent_house[id]
				var house: Dictionary=motion.layout.houses[key]
				var a: Dictionary=simulation.data.agents[id]
				a.needs.rest=25;a.needs.hunger=90;a.activity="wandering";a.jobKey="";a.currentLocation=house.parentLocId
				a._pendingHangout=null;a.erase("_activeHangout");a.erase("_hangoutHome")
				motion.positions[id].x=house.interiorX;motion.positions[id].y=house.interiorY;motion.positions[id].walking=false;motion.positions[id].doorPhase=null
				SimCareers.enroll(simulation,"doctor")
				task=SimCareers.available(simulation).filter(func(t):return t.target==id)[0]
			hud.visible=false
			var zone: Dictionary=motion.layout.buildings[key]
			var inside: Vector2=motion.layout._nearest(motion.layout._center(key))
			if role=="home": inside=Vector2(motion.layout.houses[key].interiorX,motion.layout.houses[key].interiorY)
			var outside:=Vector2(zone.doorPixelX,zone.doorPixelY)
			motion.positions.player.x=outside.x;motion.positions.player.y=outside.y;motion.positions.player.doorPhase=null;motion.positions.player.walking=false
			world_view.animate_agents(motion.positions)
			world_view._light_clock({"hour":12})
			rig.position=Vector3((zone.x+zone.w*.5),.8,(zone.y+zone.h*.5));rig.width=maxf(12,zone.w*1.4);rig.angle=45;rig._sync()
			await capture(town+"-"+role+"-outside")
			assert(await travel(inside))
			SimWorkSchedule.refresh(simulation,motion);SimShiftSleep.refresh(simulation,motion)
			var started:=SimCareers.start(simulation,task.id);assert(started.ok)
			for i in 45:
				world_view.animate_agents(motion.positions)
				world_view.service_performance.update(world_view,simulation,motion,1.0/60)
				await get_tree().process_frame
			assert(world_view.interior.opened==key)
			await capture(town+"-"+role+"-inside")
			assert(await travel(outside))
			assert(world_view.interior.opened.is_empty())
			await capture(town+"-"+role+"-restored")
			records.append({"town":town,"role":role,"room":key,"started":started.ok,"walked_in_and_out":true,"restored":true})
	FileAccess.open("res://docs/INTERIOR_VISUAL_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":records,"steps":steps,"scenery_hidden":false},"  "))
	print("INTERIOR_VISUAL_CAPTURE_COMPLETE")

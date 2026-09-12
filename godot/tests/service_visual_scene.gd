extends "res://scripts/view/main.gd"
# Controlled, offline visual fixture; never loads or saves user progress.
func _ready() -> void:
	super._ready()
	set_process(false)
	call_deferred("capture_services")

func capture_services() -> void:
	var records: Array=[]
	for town in ["frontier", "harbor"]:
		for job in ["doctor", "priest"]:
			load_demo(town)
			hud.visible=false
			var w: SimWorld=simulation
			w.data.clock.hour=12;w.data.clock.minute=0
			var id:=SimGovernance.mayor(w)
			var a: Dictionary=w.data.agents[id]
			a.jobKey="";a.activity="wandering";a.needs.rest=35;a.needs.hunger=90;a.mood=-50;a.currentLocation="town_square"
			a._pendingHangout=null;a.erase("_activeHangout");a.erase("_hangoutHome")
			var zone: Dictionary=motion.layout.buildings.town_square
			var p: Dictionary=motion.positions.player
			p.x=(zone.x+1)*16;p.y=(zone.y+1)*16;p.walking=false;p.doorPhase=null
			w.data.agents.player.currentLocation="town_square"
			motion.positions[id].x=p.x+20;motion.positions[id].y=p.y;motion.positions[id].doorPhase=null;motion.positions[id].walking=false
			SimWorkSchedule.refresh(w,motion);SimShiftSleep.refresh(w,motion)
			SimCareers.enroll(w,job)
			var task: Dictionary=SimCareers.available(w).filter(func(t):return t.target==id)[0]
			var started:=SimCareers.start(w,task.id)
			records.append({"town":town,"job":job,"start":started,"active":SimCareers.book(w).active.duplicate(true),"need":SimCareerPresence.service_need_error(w,task),"presence":SimCareerPresence.task_error(motion,task)})
			world_view.animate_agents(motion.positions)
			rig.position=world_view.actors.player.position+Vector3(.5,1.5,0);rig.width=8;rig.angle=135;rig._sync()
			for i in 75:
				world_view.service_performance.update(world_view,w,motion,1.0/60)
				await get_tree().process_frame
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://docs/service-visual-"+town+"-"+job+".png")
			if job=="doctor":
				w.data.tickCount=int(SimCareers.book(w).active.finish);SimCareers.tick(w)
			else: SimCareers.cancel(w)
			world_view.service_performance.update(world_view,w,motion,.1)
			await get_tree().process_frame;await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://docs/service-visual-"+town+"-"+job+"-end.png")
	FileAccess.open("res://docs/SERVICE_VISUAL_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify(records,"  "))
	print("SERVICE_VISUAL_CAPTURE_COMPLETE")

extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/outdoor_pose_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_outdoor")
func capture_worker(id: String,label: String) -> void:
	rig.position=world_view.actors[id].position+Vector3(0,.6,0);rig._sync()
	await get_tree().process_frame;await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/outdoor-"+label+".png")
func capture_outdoor() -> void:
	var cases: Array=[]
	for sample in [["frontier","miner",28,true],["frontier","farmer",28,true],["frontier","farmer",70,false],["harbor","miner",28,true],["harbor","farmer",9,true]]:
		world_view.show_labels=false
		var id: String=Fixture.prepare(self,sample[0],sample[1],sample[2],sample[3])
		hud.visible=false;rig.width=5;rig.angle=315;rig.follow_player=false;world_view._light_clock({"hour":12})
		var arrived:=false
		for frame in 1600:
			motion.update(simulation.data.agents)
			if OutdoorWorkPerformance.ready(simulation,motion,id): arrived=true;break
		assert(arrived)
		var label: String=str(sample[0])+"-"+str(sample[1])+"-"+str(sample[2])
		for frame in 100:
			Fixture.render(self);await get_tree().process_frame
			if frame in [35,90]: await capture_worker(id,label+"-"+str(frame))
		var a: Dictionary=simulation.data.agents[id];a.activity="heading_home";a.currentLocation=a.homeLocation
		for frame in 30: motion.update(simulation.data.agents);Fixture.render(self)
		assert(Fixture.visible_tools(world_view.actors[id]).is_empty())
		await capture_worker(id,label+"-leaving")
		cases.append({"town":sample[0],"job":sample[1],"age":sample[2],"placed":sample[3],"arrived":arrived,"tools_hidden_on_departure":true})
	FileAccess.open("res://docs/OUTDOOR_WORK_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"controlled jobs, ages, farm registration and nearby start positions; real collision arrival and leaving; visible original town geometry"},"  "))
	print("OUTDOOR_WORK_CAPTURE_COMPLETE")

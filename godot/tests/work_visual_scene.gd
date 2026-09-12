extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_work")
func capture_work() -> void:
	var records: Array=[]
	for job in ServicePerformance.TOOLS:
		var task: Dictionary=Fixture.prepare(self,"frontier",job)
		hud.visible=false
		var started:=SimCareers.start(simulation,task.id)
		assert(started.ok)
		world_view.animate_agents(motion.positions)
		var actor: Node3D=world_view.actors.player
		# Isolated rig inspection: hide scenery, without relocating the worker.
		for child in world_view.content.get_children():
			if child is Node3D and child!=actor: child.visible=false
		actor.rotation.y=PI
		var floor_mesh:=MeshInstance3D.new();var plane:=PlaneMesh.new();plane.size=Vector2(12,12);floor_mesh.mesh=plane
		var material:=StandardMaterial3D.new();material.albedo_color=Color("7c908a");floor_mesh.material_override=material
		world_view.content.add_child(floor_mesh);floor_mesh.position=Vector3(actor.position.x,0,actor.position.z)
		world_view._light_clock({"hour":12})
		rig.position=actor.position+Vector3(0,1.5,0);rig.width=5;rig.angle=135;rig._sync()
		for i in 75:
			world_view.service_performance.update(world_view,simulation,motion,1.0/60)
			await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://docs/work-visual-"+job+".png")
		records.append({"job":job,"started":started,"active":SimCareers.book(simulation).active.duplicate(true),"scenery_hidden":true})
	FileAccess.open("res://docs/WORK_VISUAL_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify(records,"  "))
	print("WORK_VISUAL_CAPTURE_COMPLETE")

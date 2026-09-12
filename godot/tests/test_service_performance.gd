extends "res://tests/test_service_chat.gd"
func pose(app: Node, delta: float = .1) -> void:
	app.world_view.animate_agents(app.motion.positions)
	app.world_view.service_performance.update(app.world_view, app.simulation, app.motion, delta)
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(1000,760);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			for ending in ["completed","cancelled","distance","need","load"]:
				var task:=prepare(app,town,job);var w: SimWorld=app.simulation;var m: SimMotion=app.motion
				m.positions.player.walking=false;m.positions[task.target].walking=false
				m.positions[task.target].x+=20
				pose(app)
				var actor: Node3D=app.world_view.actors.player
				var body: MeshInstance3D=actor.get_node("Body")
				var arm: Node3D=body.get_node("ServiceRight")
				var label: Label3D=actor.get_node("ServiceStatus")
				check(arm.rotation==Vector3.ZERO and not label.visible,"title alone does not perform "+town+job+ending)
				check(arm.get_child(0).mesh.get_faces().size()==36,"arm preserves twelve original triangles")
				check(SimCareers.start(w,task.id).ok,"actual service starts")
				var before:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true)
				for i in 12: pose(app)
				check(arm.rotation.x<-.2 and label.visible and "尚未完成" in label.text,"active service has articulated pose and truthful text")
				check(equal(before,w.snapshot()) and equal(positions,m.positions),"presentation cannot mutate simulation or movement")
				var angle: float=arm.rotation.x;pose(app,0);check(is_equal_approx(angle,arm.rotation.x),"pause freezes gesture")
				m.positions.player.walking=true;pose(app);check(arm.rotation==Vector3.ZERO,"walking releases service arms");m.positions.player.walking=false
				if ending=="load":
					SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
					var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"service pose restore")
					for i in 10: pose(app)
					actor=app.world_view.actors.player;arm=actor.get_node("Body/ServiceRight");label=actor.get_node("ServiceStatus")
					check(arm.rotation.x<-.2 and "尚未完成" in label.text and equal(save,app.progress_snapshot()),"active reload reconstructs presentation without settlement")
					SimCareers.cancel(w)
				elif ending=="completed": finish_service(app)
				elif ending=="cancelled": SimCareers.cancel(w)
				elif ending=="distance": m.positions.player.x+=80;app._validate_career_presence()
				elif ending=="need": w.data.agents[task.target].needs.rest=90;w.data.agents[task.target].mood=30;app._validate_career_presence()
				pose(app)
				check(arm.rotation==Vector3.ZERO and label.text==("服務完成" if ending=="completed" else "服務中止"),"terminal pose clears and outcome is truthful "+ending)
				for i in 30: pose(app)
				check(not label.visible,"terminal cue expires")
	for model in ["chr_body_m","chr_body_f","chr_body_elder","chr_body_child"]:
		var mesh_instance:=MeshInstance3D.new();mesh_instance.mesh=app.world_view._mesh(model)
		var triangles:=mesh_instance.mesh.get_faces().size()
		ServicePerformance.articulate(mesh_instance,model.ends_with("child"))
		var total:=mesh_instance.mesh.get_faces().size()
		for name in ["ServiceRight","ServiceLeft"]:
			var arm: MeshInstance3D=mesh_instance.get_node(name).get_child(0)
			total+=arm.mesh.get_faces().size()
			check(arm.mesh.get_faces().size()==36,"arm isolated for "+model)
		check(total==triangles,"all triangles preserved for "+model)
		mesh_instance.free()
	# Deliberately staged visual sample, not a natural gameplay capture.
	for job in ["doctor","priest"]:
		var task:=prepare(app,"frontier",job);app.motion.positions.player.walking=false;app.motion.positions[task.target].walking=false
		app.motion.positions[task.target].x+=20
		SimCareers.start(app.simulation,task.id)
		for i in 12: pose(app)
		app.hud.visible=false
		var player: Node3D=app.world_view.actors.player
		app.rig.position=player.position;app.rig.width=6;app.rig.angle=135;app.rig._sync()
		if DisplayServer.get_name()!="headless":
			await process_frame;await RenderingServer.frame_post_draw
			viewport.get_texture().get_image().save_png("res://docs/service-performance-"+job+".png")
	var report:={"checks":checks,"failures":failures,"rendered_samples":DisplayServer.get_name()!="headless","scope":"two towns, two roles, actual start/completion/cancel/distance/need/reload; pure visual poses, pause, walking precedence, timed outcome; optional staged render capture"}
	FileAccess.open("res://docs/SERVICE_PERFORMANCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

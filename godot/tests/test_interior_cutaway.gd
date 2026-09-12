extends "res://tests/test_indoor_service.gd"
func draw(app: Node) -> void: app.world_view.animate_agents(app.motion.positions)
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		app.load_demo(town)
		var m: SimMotion=app.motion
		for key in app.world_view.interior.shells:
			var z: Dictionary=m.layout.buildings[key]
			var outside:=Vector2(z.doorPixelX,z.doorPixelY)
			var inside: Vector2=m.layout._nearest(m.layout._center(key))
			put(m,"player",outside);draw(app)
			check(app.world_view.interior.opened.is_empty(),"exterior does not open room "+town+key)
			check(walk(app,inside),"actual collision walk enters "+town+key);draw(app)
			var view: TownView=app.world_view
			check(view.interior.opened==key,"actual entered room opens "+town+key)
			var before: Dictionary=app.progress_snapshot()
			for i in 20: draw(app)
			check(equal(before,app.progress_snapshot()),"cutaway does not change world or saved positions")
			var altered:=0
			for other in view.interior.shells:
				if view.interior.shells[other].material_override==view.interior.material: altered+=1
			check(altered==1 and view.interior.shells[key].cast_shadow==GeometryInstance3D.SHADOW_CASTING_SETTING_OFF,"only occupied shell and shadow change")
			if view.interior.labels.has(key): check(not view.interior.labels[key].visible,"occupied building label does not obstruct work")
			m.move_player(Vector2.ZERO,1.0/60);SimWorkSchedule.refresh(app.simulation,m);SimShiftSleep.refresh(app.simulation,m)
			var save: Dictionary=app.progress_snapshot()
			app._load_document(JSON.stringify(save),"interior reload");draw(app)
			check(app.world_view.interior.opened==key and equal(save,app.progress_snapshot()),"reload reconstructs cutaway without changing save")
			check(walk(app,outside),"collision walk exits "+town+key);draw(app)
			view=app.world_view
			check(view.interior.opened.is_empty() and view.interior.shells[key].material_override==view.shared_material,"exit restores original material")
			check(view.interior.shells[key].cast_shadow==view.interior.originals[key].shadow,"exit restores original shadow")
			check(walk(app,outside-Vector2(0,16)),"walk onto threshold");draw(app)
			check(view.interior.opened.is_empty(),"door tile alone does not open interior")
			put(m,"player",inside);m.positions.player.doorPhase="entering";draw(app)
			check(view.interior.opened.is_empty(),"unfinished door phase cannot reveal room")
			m.positions.player.doorPhase=null;draw(app)
			view.interior.update(view.layout,{},true)
			check(view.interior.opened.is_empty(),"missing player restores cutaway")
			put(m,"player",outside)
		# Destination-only changes do not open a building from outdoors.
		app.simulation.data.agents.player.currentLocation="library";draw(app)
		check(app.world_view.interior.opened.is_empty(),"logical destination is not entry")
	check(bad_cells==0 and maximum_step<=1.201,"entry and exit never cross blocked cells or teleport")
	var report:={"checks":checks,"failures":failures,"walked_frames":walked_frames,"maximum_step":maximum_step,"bad_cells":bad_cells,"scope":"both original towns, every rendered door-bearing building and home, real collision entry/exit/threshold, unfinished door phase, pure view, per-building isolation, reload and missing-player reset"}
	FileAccess.open("res://docs/INTERIOR_CUTAWAY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

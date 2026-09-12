extends "res://tests/test_traveler_gait.gd"
var heel_samples:=0
var toe_samples:=0
var contacts:=0
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for fps in [30,60,120]:
			Fixture.prepare(app,town,"cook")
			var layout:=TownLayout.new()
			for y in 60: layout.grid.append([]);layout.grid[y].resize(80);layout.grid[y].fill(0)
			app.motion.configure(layout)
			app.motion.positions.player={"x":640.0,"y":480.0,"targetX":640.0,"targetY":480.0,"walking":false,"walkStep":0,"activity":"idle","doorPhase":null}
			app.motion.manual_player=true;app.world_view.traveler_gait=TravelerGait.new();pose(app,1.0/fps)
			var actor: Node3D=app.world_view.actors.player
			var stock: Dictionary=app.simulation.data.stockpile.duplicate(true)
			var lifts: Array=[0.0,0.0];var arms: Array=[0.0,0.0]
			for fast in [false,true,false]:
				for frame in fps*2:
					app.motion.move_player(Vector2.UP,1.0/fps,fast);pose(app,1.0/fps)
					var gait: TravelerGait=app.world_view.traveler_gait
					for side in 2:
						var shoe: MeshInstance3D=actor.get_node("Body/GaitRight" if side==0 else "Body/GaitLeft")
						var pitch: float=shoe.get_meta("pitch")
						var bottom:=INF
						for v in shoe.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]: bottom=minf(bottom,(shoe.global_transform*v).y)
						if frame>fps/2:
							lifts[int(fast)]=maxf(lifts[int(fast)],bottom-.12)
							arms[int(fast)]=maxf(arms[int(fast)],absf(actor.get_node("Body/ServiceRight").rotation.x))
						check(bottom>=.1199,"rolled shoe never penetrates flat ground")
						check(shoe.to_global(shoe.get_meta("contact_local")).distance_to(shoe.get_meta("contact_world"))<.0001,"rendered contact stays on heel/toe anchor")
						if gait.feet[side].planted:
							contacts+=1;check(absf(bottom-.12)<.0001,"support sole retains ground contact")
							if pitch<-.06: heel_samples+=1
							if pitch>.12: toe_samples+=1
				check(absf(app.world_view.traveler_gait.fast_blend-(1.0 if fast else 0.0))<.0001,"pace blend reaches correct mode after transition")
				check(absf(actor.rotation.x-(.10 if fast else 0.0))<.0001,"only fast movement leans forward")
			check(lifts[1]>lifts[0]+.035,"fast motion visibly increases foot lift")
			check(arms[1]>arms[0]+.10,"fast motion visibly increases arm swing")
			for frame in 30: app.motion.move_player(Vector2.ZERO,0);pose(app,1.0/fps)
			check(app.world_view.traveler_gait.fast_blend==0 and actor.rotation.x==0,"stop restores upright stance")
			for side in ["GaitRight","GaitLeft"]: check(actor.get_node("Body/"+side).get_meta("pitch")==0,"stop restores flat shoe")
			check(equal(stock,app.simulation.data.stockpile),"visual pace does not consume stock")
	check(heel_samples>30 and toe_samples>30,"both heel landing and toe push-off observed")
	var report:={"checks":checks,"failures":failures,"heel_samples":heel_samples,"toe_samples":toe_samples,"support_contacts":contacts,"scope":"two towns, flat collision fixture, 30/60/120Hz walking-fast-walking transitions, actual shoe vertices, heel/toe anchors, lean recovery, flat stop and no resource writes"}
	FileAccess.open("res://docs/ANKLE_PACE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

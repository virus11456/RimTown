extends "res://tests/test_traveler_gait.gd"
var planted_samples:=0
var maximum_drift:=0.0
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for fps in [30,60,120]:
		for fast in [false,true]:
			Fixture.prepare(app,"frontier","cook")
			var layout:=TownLayout.new()
			for y in 60: layout.grid.append([]);layout.grid[y].resize(80);layout.grid[y].fill(0)
			app.motion.configure(layout)
			app.motion.positions.player={"x":640.0,"y":480.0,"targetX":640.0,"targetY":480.0,"walking":false,"walkStep":0,"activity":"idle","doorPhase":null}
			app.motion.manual_player=true
			app.world_view.traveler_gait=TravelerGait.new();pose(app,1.0/fps)
			for frame in fps*2:
				var gait: TravelerGait=app.world_view.traveler_gait
				var old_support:=gait.support
				var was_moving:=gait.weight>0
				var old_replants:=gait.replants
				var old_point: Vector3=gait.feet[old_support].point
				app.motion.move_player(Vector2.UP,1.0/fps,fast);pose(app,1.0/fps)
				if was_moving and gait.replants==old_replants and gait.support==old_support and gait.feet[old_support].planted:
					var drift:=old_point.distance_to(gait.feet[old_support].point)
					maximum_drift=maxf(maximum_drift,drift);planted_samples+=1
					check(drift<.000001,"support stays fixed in world while body advances")
				var body: Node3D=app.world_view.actors.player.get_node("Body")
				for side in ["GaitRight","GaitLeft"]:
					var shoe: Node3D=body.get_node(side)
					var hip: Vector3=shoe.get_meta("hip");var knee: Vector3=shoe.get_meta("knee");var ankle: Vector3=shoe.get_meta("ankle")
					check(absf(hip.distance_to(knee)-.28)<.0001 and absf(knee.distance_to(ankle)-.28)<.0001,"both leg bones preserve length")
					check((knee-(hip+ankle)*.5).z>=-.00001,"knee bends forward")
					var index:=0 if side=="GaitRight" else 1
					check(shoe.to_global(shoe.get_meta("contact_local")).distance_to(shoe.get_meta("contact_world"))<.0001,"rendered heel or toe matches world contact target")
			# Actual direction reversal and stop release stale support without stretched legs.
			for frame in fps:
				app.motion.move_player(Vector2.RIGHT,1.0/fps,fast);pose(app,1.0/fps)
			for frame in fps:
				app.motion.move_player(Vector2.LEFT,1.0/fps,fast);pose(app,1.0/fps)
			check(app.world_view.traveler_gait.replants>0,"reversal can release obsolete support")
			for frame in 20: app.motion.move_player(Vector2.ZERO,0);pose(app,1.0/fps)
			check(app.world_view.traveler_gait.weight==0,"both paces settle after stopping")
	check(planted_samples>100,"support lock sampled across rates and paces")
	var report:={"checks":checks,"failures":failures,"planted_samples":planted_samples,"maximum_support_drift":maximum_drift,"scope":"flat collision fixture, walk/fast pace at 30/60/120Hz, world support stability, actual rendered shoe, fixed bone lengths, forward knees, 90/180 degree turns and stopping"}
	FileAccess.open("res://docs/FOOT_SUPPORT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

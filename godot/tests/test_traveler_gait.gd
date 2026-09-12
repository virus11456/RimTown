extends "res://tests/test_indoor_service.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
var samples:=0
var lifted:=false
func pose(app: Node,dt: float) -> void:
	app.world_view.animate_agents(app.motion.positions)
	app.world_view.service_performance.update(app.world_view,app.simulation,app.motion,dt)
	app.world_view.traveler_gait.update(app.world_view,app.motion.positions,dt)
func audit_pose(app: Node) -> void:
	var actor: Node3D=app.world_view.actors.player
	check(is_equal_approx(actor.position.y,.16),"player root stays on floor without floating bob")
	var grounded:=false
	for side in ["GaitRight","GaitLeft"]:
		var leg: MeshInstance3D=actor.get_node("Body/"+side)
		var bottom:=INF
		var vertices: PackedVector3Array=leg.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
		for v in vertices: bottom=minf(bottom,(leg.transform*v).y)
		bottom+=actor.position.y-TravelerGait.floor_height(app.motion.layout,Vector2(actor.position.x,actor.position.z))
		check(bottom>=-.0001 and bottom<=.101,"shoe geometry stays above floor with bounded swing lift")
		grounded=grounded or absf(bottom)<.0001;lifted=lifted or bottom>.005
	check(grounded,"at least one foot remains grounded")
	samples+=1
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		var task:=Fixture.prepare(app,town,"cook")
		var m: SimMotion=app.motion
		var z: Dictionary=m.layout.buildings[task.location]
		put(m,"player",Vector2(z.doorPixelX,z.doorPixelY));m.manual_player=true;pose(app,1.0/60)
		check(app.station_approach.begin(app.simulation,m,task.id,"cook"),"real collision route accepted")
		var snapshot: Dictionary=app.simulation.data.stockpile.duplicate(true)
		for frame in 1500:
			var before:=point(m);app.station_approach.step(app.simulation,m,Vector2.ZERO,1.0/60)
			pose(app,1.0/60);audit_pose(app)
			check(point(m).distance_to(before)<=1.201,"gait does not change collision movement")
			if app.station_approach.job.is_empty(): break
		check(equal(snapshot,app.simulation.data.stockpile),"presentation consumes no resources")
		for frame in 20: m.move_player(Vector2.ZERO,0);pose(app,1.0/60)
		check(app.world_view.traveler_gait.weight==0,"stop settles to neutral")
		var phase: float=app.world_view.traveler_gait.phase
		m.positions.player.walking=true
		for frame in 20: pose(app,1.0/60)
		check(app.world_view.traveler_gait.phase==phase and app.world_view.traveler_gait.weight==0,"stationary walking flag cannot cause treadmill steps")
		m.positions.player.walking=false
		check(SimCareers.start(app.simulation,task.id).ok,"station work still starts")
		pose(app,.1)
		var arm: Node3D=app.world_view.actors.player.get_node("Body/ServiceRight")
		check(absf(arm.rotation.x)>.01,"work animation retains arm ownership while stationary")
		m.move_player(Vector2.ZERO,0);SimWorkSchedule.refresh(app.simulation,m);SimShiftSleep.refresh(app.simulation,m)
		var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"gait reload");pose(app,1.0/60)
		check(app.world_view.traveler_gait.weight==0,"reload does not replay stride")
	# Drive real collision into a wall, then verify the stride settles despite held input.
	Fixture.prepare(app,"frontier","cook")
	var before_stock: Dictionary=app.simulation.data.stockpile.duplicate(true)
	var blocked_frames:=0
	for frame in 240:
		var before:=point(app.motion);app.motion.move_player(Vector2.UP,1.0/60);pose(app,1.0/60)
		if point(app.motion)==before: blocked_frames+=1
	check(blocked_frames>20 and app.world_view.traveler_gait.weight==0,"held input against actual wall settles feet")
	var saved_motion: Dictionary=app.motion.positions.duplicate(true)
	for frame in 20: app.world_view.traveler_gait.update(app.world_view,app.motion.positions,1.0/60)
	check(equal(saved_motion,app.motion.positions) and equal(before_stock,app.simulation.data.stockpile),"gait never writes motion or economy")
	# Controlled bridge tile: default towns need not contain a bridge.
	var cell:=Vector2i(floori(point(app.motion).x/16),floori(point(app.motion).y/16))
	var old_tile: int=app.motion.layout.grid[cell.y][cell.x]
	app.motion.layout.grid[cell.y][cell.x]=38
	app.motion.positions.player.walking=false;pose(app,1.0/60);audit_pose(app)
	check(TravelerGait.floor_height(app.motion.layout,point(app.motion)/16)==.22,"controlled bridge uses raised deck height")
	app.motion.layout.grid[cell.y][cell.x]=old_tile
	app.motion.positions.player.activity="sleeping";pose(app,1.0/60)
	check(app.world_view.traveler_gait.weight==0,"sleep cancels residual stride")
	check(lifted,"moving samples include lifted swing foot")
	# Equal physical distance produces equal phase at different render rates.
	var phases: Array=[]
	for fps in [30,60,120]:
		Fixture.prepare(app,"frontier","cook");var g:=TravelerGait.new();var pos: Dictionary=app.motion.positions.duplicate(true)
		g.update(app.world_view,pos,0)
		for frame in fps:
			pos.player.x+=16.0/fps;pos.player.walking=true;g.update(app.world_view,pos,1.0/fps)
		phases.append(g.phase)
	check(absf(phases[0]-phases[1])<.0001 and absf(phases[1]-phases[2])<.0001,"stride phase independent of rendering rate")
	var report:={"checks":checks,"failures":failures,"samples":samples,"scope":"two-town real station walk, transformed shoe vertices and floor, stop, blocked intent, no resource writes, work ownership, reload, 30/60/120Hz distance phase; controlled fixture"}
	FileAccess.open("res://docs/TRAVELER_GAIT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

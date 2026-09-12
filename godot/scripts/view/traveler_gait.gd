class_name TravelerGait
extends RefCounted
# Visual only. Distance comes from collision-resolved positions, never input intent.
var previous := Vector2.ZERO
var initialized := false
var phase := 0.0
var weight := 0.0
var actor_id := 0
var facing := 0.0
var target_facing := 0.0

static func floor_height(layout: TownLayout, point: Vector2) -> float:
	var cell:=Vector2i(floori(point.x),floori(point.y))
	if cell.y>=0 and cell.y<layout.grid.size() and cell.x>=0 and cell.x<layout.grid[cell.y].size() and int(layout.grid[cell.y][cell.x])==38: return .22
	return .12

static func articulate(body: MeshInstance3D, child: bool) -> void:
	var h := .78 if child else 1.0
	var groups: Array = [SurfaceTool.new(), SurfaceTool.new(), SurfaceTool.new()]
	for group in groups: group.begin(Mesh.PRIMITIVE_TRIANGLES)
	for surface in body.mesh.get_surface_count():
		var a := body.mesh.surface_get_arrays(surface)
		var vertices: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
		var indices: PackedInt32Array = a[Mesh.ARRAY_INDEX] if a[Mesh.ARRAY_INDEX]!=null else PackedInt32Array()
		if indices.is_empty():
			for i in vertices.size(): indices.append(i)
		for triangle in range(0, indices.size(), 3):
			var side := 0
			for candidate in [1, 2]:
				var fits := true
				for corner in 3:
					var v := vertices[indices[triangle+corner]]
					fits = fits and v.y <= .571*h and (v.x > 0 if candidate==1 else v.x < 0)
				if fits: side=candidate
			var pivot := Vector3(.14 if side==1 else -.14,.57*h,0) if side>0 else Vector3.ZERO
			for corner in 3:
				var i: int=indices[triangle+corner]
				groups[side].set_normal(a[Mesh.ARRAY_NORMAL][i]);groups[side].set_uv(a[Mesh.ARRAY_TEX_UV][i])
				groups[side].add_vertex(vertices[i]-pivot)
	body.mesh=groups[0].commit()
	for side in [1,2]:
		var leg:=MeshInstance3D.new();leg.name="GaitRight" if side==1 else "GaitLeft"
		leg.position=Vector3(.14 if side==1 else -.14,.57*h,0)
		leg.mesh=groups[side].commit();leg.material_override=body.material_override
		leg.set_meta("rest",leg.position);body.add_child(leg)

func update(town: TownView, positions: Dictionary, delta: float) -> void:
	if not town.actors.has("player") or not positions.has("player"): return
	var actor: Node3D=town.actors.player
	var body: Node3D=actor.get_node("Body")
	var p: Dictionary=positions.player
	var now:=Vector2(p.x,p.y)/16.0
	if actor_id!=actor.get_instance_id(): initialized=false;weight=0;phase=0;actor_id=actor.get_instance_id();facing=actor.rotation.y;target_facing=facing
	var distance:=now.distance_to(previous) if initialized else 0.0
	var direction:=now-previous
	previous=now;initialized=true
	# A reload/teleport is not a stride. Feet must not replay the old route.
	if distance>1.0: weight=0;phase=0;distance=0
	var walking: bool=p.get("walking",false) and distance>.00001
	var dt:=clampf(delta,0,.1)
	weight=move_toward(weight,1.0 if walking else 0.0,dt*10)
	if walking:
		phase=fmod(phase+distance/1.1*TAU,TAU)
		target_facing=atan2(direction.x,direction.y)
	if weight>.001:
		facing=lerp_angle(facing,target_facing,1-exp(-18*dt));actor.rotation.y=facing
	else: facing=actor.rotation.y
	if p.get("activity","")=="sleeping": weight=0
	var swing:=sin(phase)*.38*weight
	for side in [1,2]:
		var leg: MeshInstance3D=body.get_node("GaitRight" if side==1 else "GaitLeft")
		leg.position=leg.get_meta("rest");leg.rotation=Vector3(swing if side==1 else -swing,0,0)
		# Keep the lowest transformed shoe corner on or above the model floor.
		var box:=leg.mesh.get_aabb();var bottom:=INF
		for corner in 8: bottom=minf(bottom,(leg.transform*box.get_endpoint(corner)).y)
		var lift:=maxf(0,sin(phase if side==1 else phase+PI))*.055*weight
		leg.position.y+=floor_height(town.layout,now)-actor.position.y-bottom+lift
	# Service poses own the arms as soon as walking/settling finishes.
	if weight>0.001:
		body.get_node("ServiceRight").rotation.x=-swing*.7
		body.get_node("ServiceLeft").rotation.x=swing*.7

class_name TravelerGait
extends RefCounted
# Display-only two-bone legs; world-space support feet never drive simulation motion.
var previous := Vector2.ZERO
var initialized := false
var phase := PI/2
var weight := 0.0
var actor_id := 0
var facing := 0.0
var target_facing := 0.0
var feet: Array = []
var support := 0
var replants := 0

static func floor_height(layout: TownLayout, point: Vector2) -> float:
	var cell:=Vector2i(floori(point.x),floori(point.y))
	if cell.y>=0 and cell.y<layout.grid.size() and cell.x>=0 and cell.x<layout.grid[cell.y].size() and int(layout.grid[cell.y][cell.x])==38: return .22
	return .12

static func articulate(body: MeshInstance3D, child: bool) -> void:
	var h := .78 if child else 1.0
	body.set_meta("gait_height",h)
	# Preserve torso, shoes and trouser material/UVs. Split each trouser into two segments.
	var groups: Array=[]
	for i in 5:
		var group:=SurfaceTool.new();group.begin(Mesh.PRIMITIVE_TRIANGLES);groups.append(group)
	for surface in body.mesh.get_surface_count():
		var a:=body.mesh.surface_get_arrays(surface)
		var vertices: PackedVector3Array=a[Mesh.ARRAY_VERTEX]
		var indices: PackedInt32Array=a[Mesh.ARRAY_INDEX] if a[Mesh.ARRAY_INDEX]!=null else PackedInt32Array()
		if indices.is_empty():
			for i in vertices.size(): indices.append(i)
		for triangle in range(0,indices.size(),3):
			var side:=0
			for candidate in [1,2]:
				var fits:=true
				for corner in 3:
					var v:=vertices[indices[triangle+corner]]
					fits=fits and v.y<=.571*h and (v.x>0 if candidate==1 else v.x<0)
				if fits: side=candidate
			var group:=side
			var shoe:=false
			for corner in 3: shoe=shoe or absf(vertices[indices[triangle+corner]].z)>.10
			if side>0 and not shoe: group+=2
			var pivot:=Vector3(.14 if side==1 else -.14,(.1 if shoe else .36)*h,0) if side>0 else Vector3.ZERO
			for corner in 3:
				var i: int=indices[triangle+corner]
				groups[group].set_normal(a[Mesh.ARRAY_NORMAL][i]);groups[group].set_uv(a[Mesh.ARRAY_TEX_UV][i]);groups[group].add_vertex(vertices[i]-pivot)
	body.mesh=groups[0].commit()
	for side in [1,2]:
		var name:="GaitRight" if side==1 else "GaitLeft"
		var shoe:=MeshInstance3D.new();shoe.name=name;shoe.mesh=groups[side].commit();shoe.material_override=body.material_override;body.add_child(shoe)
		var rod: ArrayMesh=groups[side+2].commit()
		for part in ["Upper","Lower"]:
			var segment:=MeshInstance3D.new();segment.name=name+part;segment.mesh=rod;segment.material_override=body.material_override;body.add_child(segment)
		# Neutral construction pose also works in historical fixtures without a gait update.
		shoe.position=Vector3(.14 if side==1 else -.14,.1*h-.04,0)
		for part in ["Upper","Lower"]:
			var segment: Node3D=body.get_node(name+part)
			segment.position=Vector3(shoe.position.x,(.46 if part=="Upper" else .25)*h-.02,0);segment.scale.y=.5
		for part in ["","Upper","Lower"]:
			var node: Node3D=body.get_node(name+part);node.set_meta("gait_rest",node.transform)

func neutral(actor: Node3D,body: Node3D,side: int,town: TownView) -> Vector3:
	var point:=body.to_global(Vector3(.14 if side==0 else -.14,0,0))
	point.y=floor_height(town.layout,Vector2(point.x,point.z))
	return point

func reset_feet(actor: Node3D,body: Node3D,town: TownView) -> void:
	feet.clear();support=0;phase=PI/2
	for side in 2:
		var point:=neutral(actor,body,side,town)
		feet.append({"point":point,"start":point,"yaw":actor.rotation.y,"planted":side==0})

static func rod_pose(node: Node3D,a: Vector3,b: Vector3,height: float) -> void:
	var direction:=b-a
	node.position=(a+b)*.5
	node.basis=Basis(Quaternion(Vector3.UP,direction.normalized())).scaled(Vector3(1,direction.length()/(.42*height),1))

func solve(body: Node3D,side: int,point: Vector3,yaw: float,height: float) -> void:
	var name:="GaitRight" if side==0 else "GaitLeft"
	var shoe: Node3D=body.get_node(name)
	shoe.global_transform=Transform3D(Basis(Vector3.UP,yaw),point+Vector3.UP*.1*height)
	var hip:=Vector3(.14 if side==0 else -.14,.57*height,0)
	var ankle:=body.to_local(point+Vector3.UP*.16*height)
	var axis:=(ankle-hip).normalized()
	var length:=.28*height
	var distance:=hip.distance_to(ankle)
	# A reachable target produces two equal-length bones with a forward knee.
	var bend:=Vector3.BACK-axis*Vector3.BACK.dot(axis)
	if bend.length()<.001: bend=Vector3.RIGHT-axis*Vector3.RIGHT.dot(axis)
	bend=bend.normalized()
	var knee:=(hip+ankle)*.5+bend*sqrt(maxf(0,length*length-distance*distance*.25))
	rod_pose(body.get_node(name+"Upper"),hip,knee,height)
	rod_pose(body.get_node(name+"Lower"),knee,ankle,height)
	shoe.set_meta("hip",hip);shoe.set_meta("knee",knee);shoe.set_meta("ankle",ankle)

func update(town: TownView,positions: Dictionary,delta: float) -> void:
	if not town.actors.has("player") or not positions.has("player"): return
	var actor: Node3D=town.actors.player;var body: Node3D=actor.get_node("Body")
	var h: float=body.get_meta("gait_height",1.0)
	var p: Dictionary=positions.player;var now:=Vector2(p.x,p.y)/16
	var changed:=actor_id!=actor.get_instance_id()
	if changed:
		initialized=false;weight=0;actor_id=actor.get_instance_id();facing=actor.rotation.y;target_facing=facing;feet.clear()
	var direction:=now-previous if initialized else Vector2.ZERO
	var distance:=direction.length();previous=now;initialized=true
	if distance>1.0: distance=0;weight=0;feet.clear()
	var walking: bool=p.get("walking",false) and distance>.00001
	var dt:=clampf(delta,0,.1)
	var old_weight:=weight
	weight=move_toward(weight,1.0 if walking else 0.0,dt*10)
	if walking:
		var heading:=atan2(direction.x,direction.y)
		# Abrupt reversal releases the old support rather than stretching a leg across the body.
		if absf(angle_difference(target_facing,heading))>PI*.55: feet.clear();replants+=1
		target_facing=heading
	if weight>.001:
		facing=lerp_angle(facing,target_facing,1-exp(-18*dt));actor.rotation.y=facing
	else: facing=actor.rotation.y
	if p.get("activity","")=="sleeping":
		weight=0;feet.clear()
		for name in ["GaitRight","GaitLeft"]:
			for part in ["","Upper","Lower"]:
				var node: Node3D=body.get_node(name+part);node.transform=node.get_meta("gait_rest")
		return
	if feet.is_empty() or (walking and old_weight==0): reset_feet(actor,body,town)
	if walking:
		phase=fmod(phase+distance/h*TAU,TAU)
		var next_support:=0 if phase<PI else 1
		var forward:=Vector3(direction.x,0,direction.y).normalized()
		if next_support!=support:
			support=next_support
			var landing:=neutral(actor,body,support,town)+forward*.24*h
			landing.y=floor_height(town.layout,Vector2(landing.x,landing.z))
			feet[support].point=landing;feet[support].yaw=facing
			feet[1-support].start=feet[1-support].point
		for side in 2:
			feet[side].planted=side==support
			if side==support: continue
			var t:=fmod(phase/PI,1.0)
			var target:=neutral(actor,body,side,town)+forward*.24*h
			target.y=floor_height(town.layout,Vector2(target.x,target.z))
			feet[side].point=Vector3(feet[side].start).lerp(target,smoothstep(0,1,t))+Vector3.UP*sin(t*PI)*.10*h
			feet[side].yaw=facing
	else:
		for side in 2:
			feet[side].point=Vector3(feet[side].point).lerp(neutral(actor,body,side,town),minf(1,dt*20))
			if weight==0: feet[side].point=neutral(actor,body,side,town)
			feet[side].yaw=lerp_angle(feet[side].yaw,actor.rotation.y,minf(1,dt*20));feet[side].planted=false
	for side in 2:
		var hip:=body.to_global(Vector3(.14 if side==0 else -.14,.57*h,0))
		var ankle: Vector3=feet[side].point+Vector3.UP*.16*h
		if hip.distance_to(ankle)>.558*h:
			feet[side].point=neutral(actor,body,side,town);feet[side].start=feet[side].point;feet[side].planted=false;replants+=1
		solve(body,side,feet[side].point,feet[side].yaw,h)
	if weight>.001:
		var swing:=sin(phase)*.27*weight
		body.get_node("ServiceRight").rotation.x=-swing;body.get_node("ServiceLeft").rotation.x=swing

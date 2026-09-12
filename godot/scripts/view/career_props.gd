class_name CareerProps
extends RefCounted
const JOBS := ["farmer", "cook", "tailor", "guard", "trader"]
static func part(parent: Node3D, mesh: Mesh, at: Vector3, color: Color) -> MeshInstance3D:
	var node:=MeshInstance3D.new();node.mesh=mesh;node.position=at
	var material:=StandardMaterial3D.new();material.albedo_color=color;material.roughness=1
	node.material_override=material;parent.add_child(node);return node
static func box(parent: Node3D, size: Vector3, at: Vector3, color: Color) -> MeshInstance3D:
	var mesh:=BoxMesh.new();mesh.size=size;return part(parent,mesh,at,color)
static func tube(parent: Node3D,radius: float,height: float,at: Vector3,color: Color) -> MeshInstance3D:
	var mesh:=CylinderMesh.new();mesh.top_radius=radius;mesh.bottom_radius=radius;mesh.height=height;mesh.radial_segments=8
	return part(parent,mesh,at,color)
static func get_prop(arm: Node3D,job: String,side: String) -> Node3D:
	var key:="Duty_"+job+"_"+side
	var prop: Node3D=arm.get_node_or_null(key)
	if prop!=null: prop.visible=true;return prop
	prop=Node3D.new();prop.name=key;prop.position=Vector3(0,-.44,.10);prop.set_meta("career_tool",true);arm.add_child(prop)
	var metal:=Color("718b91");var wood:=Color("94734f")
	if job=="farmer":
		tube(prop,.13,.22,Vector3(0,-.15,0),metal)
		var spout:=tube(prop,.035,.27,Vector3(0,-.09,.19),metal);spout.rotation.x=1.05
		box(prop,Vector3(.04,.14,.04),Vector3(-.10,.01,0),metal)
		box(prop,Vector3(.04,.14,.04),Vector3(.10,.01,0),metal)
		box(prop,Vector3(.24,.04,.04),Vector3(0,.08,0),metal)
	elif job=="cook":
		if side=="left":
			tube(prop,.16,.10,Vector3(0,-.07,.04),metal)
			tube(prop,.14,.012,Vector3(0,-.014,.04),Color("caa261"))
		else:
			tube(prop,.018,.20,Vector3(0,.06,0),wood)
			tube(prop,.035,.035,Vector3(0,-.06,0),wood)
	elif job=="tailor":
		if side=="left": box(prop,Vector3(.34,.025,.28),Vector3(0,-.03,.04),Color("b78578"))
		else: tube(prop,.008,.16,Vector3.ZERO,Color("d6d7c7"))
	elif job=="trader":
		box(prop,Vector3(.25,.04,.32),Vector3(0,-.03,.04),Color("725b76"))
		box(prop,Vector3(.21,.01,.28),Vector3(0,-.005,.04),Color("e2d8b4"))
	return prop
static func pose(job: String,right: Node3D,left: Node3D,phase: float,blend: float) -> void:
	match job:
		"farmer":
			right.rotation.x=(-.70+sin(phase*1.4)*.10)*blend
			left.rotation.x=-.15*blend
			get_prop(right,job,"right").basis=right.basis.inverse()*Basis(Vector3.RIGHT,.35*blend)
		"cook":
			left.rotation.x=-1.0*blend;left.rotation.z=.6*blend
			right.rotation.x=(-.9+sin(phase*2.5)*.08)*blend;right.rotation.z=-.6*blend
			right.rotation.y=sin(phase*2.5)*.15*blend
			get_prop(left,job,"left").basis=left.basis.inverse()
			get_prop(right,job,"right").basis=right.basis.inverse()
		"tailor":
			left.rotation.x=-1.0*blend;left.rotation.z=.6*blend
			right.rotation.x=(-.9+sin(phase*3.5)*.06)*blend;right.rotation.z=-.6*blend
			get_prop(left,job,"left").basis=left.basis.inverse()
			get_prop(right,job,"right").basis=right.basis.inverse()
		"guard":
			right.rotation.x=-2.1*blend;right.rotation.z=-.35*blend
			left.rotation.x=-.12*blend
		"trader":
			left.rotation.x=-1.0*blend;left.rotation.z=.6*blend
			right.rotation.x=(-.85+sin(phase*1.4)*.08)*blend;right.rotation.z=-.6*blend
			get_prop(left,job,"left").basis=left.basis.inverse()*Basis(Vector3.RIGHT,-.2)

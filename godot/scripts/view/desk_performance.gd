class_name DeskPerformance
extends RefCounted
# Lift held materials clear of the desk while keeping their grip attached.
static func bounds(node: Node3D) -> AABB:
	var points: Array[Vector3]=[]
	var nodes: Array[Node]=[node]
	while not nodes.is_empty():
		var child: Node=nodes.pop_back()
		if child is MeshInstance3D:
			var box: AABB=child.get_aabb()
			for corner in 8: points.append(child.global_transform*box.get_endpoint(corner))
		for item in child.get_children(): nodes.append(item)
	if points.is_empty(): return AABB()
	var box:=AABB(points[0],Vector3.ZERO)
	for p in points: box=box.expand(p)
	return box
static func pose(job: String,right: Node3D,left: Node3D,phase: float) -> void:
	if job!="researcher": left.rotation.z=.6;right.rotation.z=-.75 if job=="cook" else -.6
	var arm:=right if job=="researcher" else left
	var prop: Node3D=right.get_node("acc_tool_book") if job=="researcher" else CareerProps.get_prop(left,job,"left")
	var low:=0.0;var high:=-1.6
	for i in 12:
		arm.rotation.x=(low+high)*.5
		if job!="researcher": prop.basis=arm.basis.inverse()
		if bounds(prop).position.y<.835: low=arm.rotation.x
		else: high=arm.rotation.x
	arm.rotation.x=(low+high)*.5
	if job!="researcher": prop.basis=arm.basis.inverse()
	# The reading hand makes a small turn above the surface, never through it.
	if job=="researcher": arm.rotation.x-=.025*(1+sin(phase*1.2))
	if job in ["cook","tailor"]:
		var utensil:=CareerProps.get_prop(right,job,"right")
		var target: float=.94 if job=="cook" else .86+.025*(.5+.5*sin(phase*3.5))
		low=0;high=-1.6
		for i in 12:
			right.rotation.x=(low+high)*.5;utensil.basis=right.basis.inverse()
			if bounds(utensil).position.y<target: low=right.rotation.x
			else: high=right.rotation.x
		right.rotation.x=(low+high)*.5;utensil.basis=right.basis.inverse()

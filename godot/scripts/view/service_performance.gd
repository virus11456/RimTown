class_name ServicePerformance
extends RefCounted
# Presentation only: no clock, movement, reward or save writes.
var phase := 0.0
var observed := ""
var outcome_count := -1
var message := ""
var remaining := 0.0
var previous_completed := 0
var previous_job := ""
const TOOLS := {"miner":"acc_tool_pickaxe", "carpenter":"acc_tool_hammer", "blacksmith":"acc_tool_hammer", "researcher":"acc_tool_book"}
const LABELS := {"doctor":"照護中", "priest":"談心陪伴中", "miner":"採集原料中", "carpenter":"製備構件中", "blacksmith":"打造工具中", "researcher":"整理資料中", "farmer":"澆灌農田中", "cook":"製作餐食中", "tailor":"縫製衣物中", "guard":"觀察巡查點", "trader":"核對交易中"}

static func articulate(body: MeshInstance3D, child: bool) -> void:
	var h := .78 if child else 1.0
	var groups: Array = [SurfaceTool.new(), SurfaceTool.new(), SurfaceTool.new()]
	for group in groups: group.begin(Mesh.PRIMITIVE_TRIANGLES)
	for surface in body.mesh.get_surface_count():
		var arrays := body.mesh.surface_get_arrays(surface)
		var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
		if indices.is_empty():
			for i in vertices.size(): indices.append(i)
		for triangle in range(0, indices.size(), 3):
			var side := 0
			for candidate in [1, 2]:
				var fits := true
				for corner in 3:
					var v := vertices[indices[triangle + corner]]
					fits = fits and v.y >= .534*h and v.y <= .986*h and (v.x >= .249 if candidate == 1 else v.x <= -.249)
				if fits: side = candidate
			var pivot := Vector3(.32 if side == 1 else -.32, .985*h, 0) if side > 0 else Vector3.ZERO
			for corner in 3:
				var i := indices[triangle + corner]
				groups[side].set_normal(arrays[Mesh.ARRAY_NORMAL][i])
				groups[side].set_uv(arrays[Mesh.ARRAY_TEX_UV][i])
				groups[side].add_vertex(vertices[i] - pivot)
	body.mesh = groups[0].commit()
	for side in [1, 2]:
		var shoulder := Node3D.new()
		shoulder.name = "ServiceRight" if side == 1 else "ServiceLeft"
		shoulder.position = Vector3(.32 if side == 1 else -.32, .985*h, 0)
		body.add_child(shoulder)
		var arm := MeshInstance3D.new()
		arm.mesh = groups[side].commit()
		arm.material_override = body.material_override
		shoulder.add_child(arm)

func update(town: TownView, w: SimWorld, m: SimMotion, delta: float) -> void:
	if not town.actors.has("player"): return
	var actor: Node3D = town.actors.player
	var body: MeshInstance3D = actor.get_node("Body")
	var right: Node3D = body.get_node("ServiceRight")
	var left: Node3D = body.get_node("ServiceLeft")
	var label: Label3D = actor.get_node("ServiceStatus")
	var marker: Label3D = actor.get_node("TravelerMarker")
	for arm in [right,left]:
		for tool in arm.get_children():
			if tool.has_meta("career_tool"): tool.visible=false
	right.rotation = Vector3.ZERO; left.rotation = Vector3.ZERO
	actor.rotation.x = 0
	var book: Dictionary = w.quest_balance.get("careers", {})
	var task: Dictionary = book.get("active", {})
	if not observed.is_empty() and previous_job not in ["doctor","priest"] and task.is_empty():
		message = "值勤完成" if int(book.get("completed",0)) > previous_completed else "值勤中止"
		remaining = 2.5
	var serial := int(w.quest_balance.get("service_outcome_serial", 0))
	if outcome_count >= 0 and serial != outcome_count:
		var history: Array = w.quest_balance.get("service_outcomes", [])
		if not observed.is_empty() and not history.is_empty():
			var last: Dictionary = history.back()
			message = "服務完成" if last.state == "completed" else "服務中止"
			remaining = 2.5
	outcome_count = serial
	remaining = maxf(0, remaining - delta)
	var job := str(task.get("job", ""))
	var valid: bool = LABELS.has(job) and m.positions.has("player")
	if valid and job in ["doctor", "priest"]: valid = m.positions.has(str(task.get("target", "")))
	if valid: valid = str(w.data.agents.player.get("jobKey", "")) == job
	if valid:
		valid = SimCareerPresence.task_error(m, task).is_empty() and SimCareerPresence.service_need_error(w, task).is_empty()
		if task.get("stay", false): valid = valid and SimServiceStay.priority(w, str(task.target)).is_empty()
	if not valid:
		observed = ""; phase = 0
		label.text = message if remaining > 0 else ""
		label.visible = remaining > 0
		marker.visible = not label.visible
		return
	var key := str(task.id) + ":" + str(task.finish)
	if observed != key: phase = 0; remaining = 0
	observed = key
	previous_job = job
	previous_completed = int(book.get("completed",0))
	phase += delta
	label.visible = true
	marker.visible = false
	label.text = LABELS[job] + "\n尚未完成"
	# Manual motion always owns the player's facing and feet while walking.
	if m.positions.player.get("walking", false): return
	if job in ["doctor", "priest"]:
		var target: Dictionary = m.positions[str(task.target)]
		var direction := Vector2(float(target.x)-float(m.positions.player.x), float(target.y)-float(m.positions.player.y))
		if direction.length() > .1: actor.rotation.y = atan2(direction.x, direction.y)
	if job in SimWorkstation.JOBS: actor.rotation.y=PI
	var blend := smoothstep(0, .45, phase)
	if task.job == "doctor":
		actor.rotation.x = .07 * blend
		right.rotation.x = (-.85 + sin(phase * 2.2) * .10) * blend
		left.rotation.x = -.45 * blend
	elif job == "priest":
		right.rotation.x = (-.55 + sin(phase * 1.5) * .12) * blend
		right.rotation.z = -.15 * blend
		left.rotation.x = -.25 * blend

	elif TOOLS.has(job):
		var tool_name: String = TOOLS[job]
		var tool: MeshInstance3D = right.get_node_or_null(tool_name)
		if tool == null:
			tool = town._instance(tool_name,Vector3(0,-.42,.02),Vector3.ONE*.65,right)
			tool.name=tool_name;tool.set_meta("career_tool",true)
			# Align the grip to the palm; the shaft extends away from the forearm.
			if job == "researcher": tool.position=Vector3(0,-.56,.04)
			else:
				tool.position=Vector3(0,-.43,-.16)
				tool.rotation.x=PI/2
		tool.visible=true
		if job == "researcher":
			right.rotation.x=(-.95+sin(phase*1.2)*.025)*blend
			left.rotation.x=-.85*blend
		else:
			var cadence := 2.2 if job=="miner" else 3.0
			right.rotation.x=(-.85+sin(phase*cadence)*.40)*blend
			left.rotation.x=-.3*blend
			if job in SimWorkstation.HAMMER_JOBS:
				# Solve the hammer-head bottom against the actual .92-high work slab.
				var low:=0.0;var high:=-1.6
				for i in 12:
					var angle: float=(low+high)*.5
					right.rotation.x=angle
					if hammer_bottom(tool)<.92: low=angle
					else: high=angle
				var impact: float=(low+high)*.5
				right.rotation.x=lerpf(impact-.5,impact-.5*(.5+.5*sin(phase*3)),blend)

	elif job in CareerProps.JOBS:
		CareerProps.pose(job,right,left,phase,blend)

	if job in ["cook","tailor","researcher"]:
		DeskPerformance.pose(job,right,left,phase)

static func hammer_bottom(tool: MeshInstance3D) -> float:
	if not tool.has_meta("head_vertices"):
		var points: Array[Vector3]=[]
		for surface in tool.mesh.get_surface_count():
			for v in tool.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]:
				if v.y>.60: points.append(v)
		tool.set_meta("head_vertices",points)
	var bottom:=INF
	for v in tool.get_meta("head_vertices"): bottom=minf(bottom,(tool.global_transform*v).y)
	return bottom

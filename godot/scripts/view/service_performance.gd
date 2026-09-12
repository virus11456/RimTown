class_name ServicePerformance
extends RefCounted
# Presentation only: no clock, movement, reward or save writes.
var phase := 0.0
var observed := ""
var outcome_count := -1
var message := ""
var remaining := 0.0

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
	right.rotation = Vector3.ZERO; left.rotation = Vector3.ZERO
	actor.rotation.x = 0
	var serial := int(w.quest_balance.get("service_outcome_serial", 0))
	if outcome_count >= 0 and serial != outcome_count:
		var history: Array = w.quest_balance.get("service_outcomes", [])
		if not observed.is_empty() and not history.is_empty():
			var last: Dictionary = history.back()
			message = "服務完成" if last.state == "completed" else "服務中止"
			remaining = 2.5
	outcome_count = serial
	remaining = maxf(0, remaining - delta)
	var task: Dictionary = w.quest_balance.get("careers", {}).get("active", {})
	var valid: bool = task.get("job", "") in ["doctor", "priest"] and m.positions.has(str(task.get("target", ""))) and m.positions.has("player")
	if valid:
		valid = SimCareerPresence.task_error(m, task).is_empty() and SimCareerPresence.service_need_error(w, task).is_empty()
		if task.get("stay", false): valid = valid and SimServiceStay.priority(w, str(task.target)).is_empty()
	if not valid:
		observed = ""; phase = 0
		label.text = message if remaining > 0 else ""
		label.visible = remaining > 0
		return
	var key := str(task.id) + ":" + str(task.finish)
	if observed != key: phase = 0; remaining = 0
	observed = key
	phase += delta
	label.visible = true
	label.text = ("照護中" if task.job == "doctor" else "談心陪伴中") + " · 尚未完成"
	# Manual motion always owns the player's facing and feet while walking.
	if m.positions.player.get("walking", false): return
	var target: Dictionary = m.positions[str(task.target)]
	var direction := Vector2(float(target.x)-float(m.positions.player.x), float(target.y)-float(m.positions.player.y))
	if direction.length() > .1: actor.rotation.y = atan2(direction.x, direction.y)
	var blend := smoothstep(0, .45, phase)
	if task.job == "doctor":
		actor.rotation.x = .07 * blend
		right.rotation.x = (-.85 + sin(phase * 2.2) * .10) * blend
		left.rotation.x = -.45 * blend
	else:
		right.rotation.x = (-.55 + sin(phase * 1.5) * .12) * blend
		right.rotation.z = -.15 * blend
		left.rotation.x = -.25 * blend

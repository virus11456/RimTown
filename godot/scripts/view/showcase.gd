extends Node3D

func _ready() -> void:
	var spec: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://tools/asset_manifest.json"))
	var material := StandardMaterial3D.new()
	material.albedo_texture = load("res://assets/palette/palette.png")
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	material.roughness = 1.0
	for i in spec.assets.size():
		var asset: Dictionary = spec.assets[i]
		var model: Node3D = load("res://assets/models/%s.glb" % asset.name).instantiate()
		add_child(model)
		model.position = Vector3((i % 10) * 5, 0, (i / 10 as int) * 5)
		_shared_material(model, material)
		var label := Label3D.new()
		label.text = asset.name
		label.font_size = 22
		label.pixel_size = 0.013
		label.position = model.position + Vector3(0, 0.1, 1.8)
		label.rotation_degrees.x = -70
		add_child(label)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-55,-25,0)
	light.light_color = Color("ffecd0")
	light.shadow_enabled = true
	add_child(light)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color("182d32")
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color("e4e9df")
	env.environment.ambient_light_energy = 0.65
	add_child(env)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 57
	add_child(camera)
	camera.position = Vector3(51,55,72)
	camera.look_at(Vector3(22,0,19))
	camera.current = true
	if DisplayServer.get_name() != "headless":
		await get_tree().create_timer(2).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://docs/showcase.png")
		if "--capture" in OS.get_cmdline_user_args():
			get_tree().quit()

func _shared_material(node: Node, material: Material) -> void:
	if node is MeshInstance3D:
		node.material_override = material
	for child in node.get_children():
		_shared_material(child, material)

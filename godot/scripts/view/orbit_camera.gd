class_name TownCamera
extends Node3D
var camera: Camera3D
var angle := 45.0
var width := 40.0
var touches: Dictionary = {}
var enabled := true
var follow_player := false

func _ready() -> void:
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.keep_aspect = Camera3D.KEEP_WIDTH
	camera.near = 0.1
	camera.far = 300
	add_child(camera)
	position = Vector3(40,0,27)
	_sync()

func _sync() -> void:
	rotation_degrees = Vector3(0,angle,0)
	camera.position = Vector3(0,57.3576,81.9152)
	camera.rotation_degrees.x = -35
	camera.size = width

func turn(direction: float) -> void:
	angle = fposmod(angle + direction * 90, 360)
	_sync()

func zoom_by(factor: float) -> void:
	width = clampf(width * factor, 8, 40)
	_sync()

func pan(delta: Vector2) -> void:
	follow_player=false
	var scale_factor := width / maxf(get_viewport().get_visible_rect().size.x,1)
	var right := global_transform.basis.x
	var forward := global_transform.basis.z
	position -= right * delta.x * scale_factor + forward * delta.y * scale_factor / sin(deg_to_rad(35))
	position.x = clampf(position.x, 0, 80)
	position.z = clampf(position.z, 0, 60)

func _unhandled_input(event: InputEvent) -> void:
	if not enabled:
		return
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP: zoom_by(0.9)
		if event.button_index == MOUSE_BUTTON_WHEEL_DOWN: zoom_by(1.1)
	if event is InputEventMouseMotion and event.button_mask & (MOUSE_BUTTON_MASK_LEFT | MOUSE_BUTTON_MASK_MIDDLE | MOUSE_BUTTON_MASK_RIGHT):
		pan(event.relative)
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_Q: turn(-1)
		if event.keycode == KEY_E: turn(1)
	if event is InputEventScreenTouch:
		if event.pressed: touches[event.index] = event.position
		else: touches.erase(event.index)
	if event is InputEventScreenDrag:
		if not touches.has(event.index): return
		if touches.size() == 2:
			var keys := touches.keys()
			var before: float = touches[keys[0]].distance_to(touches[keys[1]])
			touches[event.index] = event.position
			var after: float = touches[keys[0]].distance_to(touches[keys[1]])
			if after > 1: zoom_by(before / after)
		else:
			touches[event.index] = event.position
			pan(event.relative)

func _input(event: InputEvent) -> void:
	# Always clean released touches even if release occurs over a UI panel.
	if event is InputEventScreenTouch and not event.pressed:
		touches.erase(event.index)

func follow_position(target: Vector3,delta: float) -> void:
	if not follow_player: return
	position=position.lerp(Vector3(target.x,0,target.z),1.0-pow(.88,maxf(delta,0)*60.0))
	position.x=clampf(position.x,0,80)
	position.z=clampf(position.z,0,60)

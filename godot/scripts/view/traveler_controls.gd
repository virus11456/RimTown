class_name TravelerControls
extends Node
# Keyboard state belongs to the view, never to a saved simulation.
const MOVEMENT_KEYS = [KEY_W,KEY_A,KEY_S,KEY_D,KEY_UP,KEY_LEFT,KEY_DOWN,KEY_RIGHT]
var held: Dictionary = {}
var modal_open: Callable
func _ready() -> void:
	get_window().focus_exited.connect(clear)
func clear() -> void:
	held.clear()
func blocked() -> bool:
	if modal_open.is_valid() and modal_open.call(): return true
	var focus := get_viewport().gui_get_focus_owner()
	return focus is LineEdit or focus is TextEdit
func direction() -> Vector2:
	if blocked():
		clear()
		return Vector2.ZERO
	return Vector2(
		int(held.has(KEY_D) or held.has(KEY_RIGHT))-int(held.has(KEY_A) or held.has(KEY_LEFT)),
		int(held.has(KEY_S) or held.has(KEY_DOWN))-int(held.has(KEY_W) or held.has(KEY_UP))).limit_length()
func _input(event: InputEvent) -> void:
	if not event is InputEventKey: return
	var code: int = event.physical_keycode if event.physical_keycode!=0 else event.keycode
	if code not in MOVEMENT_KEYS: return
	# Release always clears, including releases over a text field or file dialog.
	if not event.pressed:
		held.erase(code)
		return
	if event.ctrl_pressed or event.meta_pressed or event.alt_pressed or blocked():
		clear()
		return
	held[code]=true
	get_viewport().set_input_as_handled()

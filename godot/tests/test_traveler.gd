extends SceneTree
var checks:=0
var failures: Array[String]=[]
var app: Node
func check(value: bool,message: String) -> void:
	checks+=1
	if not value: failures.append(message)
func flat_motion() -> SimMotion:
	var layout:=TownLayout.new()
	for y in 60: layout.grid.append([]); layout.grid[y].resize(80); layout.grid[y].fill(0)
	var motion:=SimMotion.new(); motion.configure(layout)
	motion.positions.player={"x":640.0,"y":480.0,"targetX":640.0,"targetY":480.0,"walking":false,"walkStep":0,"activity":"idle","doorPhase":null}
	return motion
func point(m: SimMotion) -> Vector2: return Vector2(m.positions.player.x,m.positions.player.y)
func _initialize() -> void: call_deferred("run")
func settle() -> void:
	for i in 4: await process_frame
func send_key(code: Key,pressed: bool,unicode_value:=0) -> void:
	var event:=InputEventKey.new(); event.keycode=code; event.pressed=pressed; event.unicode=unicode_value
	root.push_input(event,true)
	await process_frame
func find_button(node: Node,text: String) -> Button:
	if node is Button and node.text==text: return node
	for child in node.get_children():
		var found:=find_button(child,text)
		if found!=null: return found
	return null
func run() -> void:
	for fps in [30,60,120]:
		for direction in [Vector2.RIGHT,Vector2.LEFT,Vector2.UP,Vector2.DOWN,Vector2(1,1)]:
			var m:=flat_motion()
			for frame in fps: m.move_player(direction,1.0/fps)
			check(absf(point(m).distance_to(Vector2(640,480))-72)<.001,"72 px/s at %d fps direction %s"%[fps,direction])
	var wall:=flat_motion()
	for tile in [5,6,41,15,16,17,18]:
		wall.layout.grid[10][11]=tile
		wall.positions.player.x=175; wall.positions.player.y=168
		wall.move_player(Vector2.RIGHT,.05)
		check(wall.positions.player.x==175,"blocks wall/roof/fence tile %d"%tile)
	wall.move_player(Vector2(1,1),.05)
	check(wall.positions.player.x==175 and wall.positions.player.y>168,"slides along wall")
	wall.layout.grid[11][10]=5
	wall.positions.player.x=175; wall.positions.player.y=175
	wall.move_player(Vector2(1,1),.05)
	check(point(wall)==Vector2(175,175),"blocked corner cannot be crossed")
	var border:=flat_motion()
	border.positions.player.x=1275; border.positions.player.y=955
	border.move_player(Vector2(1,1),.05)
	check(point(border)==Vector2(1276,956),"map maximum margin")
	border.positions.player.x=5; border.positions.player.y=5
	border.move_player(Vector2(-1,-1),.05)
	check(point(border)==Vector2(4,4),"map minimum margin")
	border.move_player(Vector2.ZERO,.05)
	check(not border.positions.player.walking and border.manual_player,"release stops but manual mode stays sticky")
	var missing:=SimMotion.new()
	check(not missing.move_player(Vector2.RIGHT,.016),"no player is safe")
	# Event-driven integration uses a flat collision fixture to isolate input/camera behavior.
	root.size=Vector2i(1280,800)
	app=load("res://scenes/main.tscn").instantiate(); root.add_child(app)
	await settle(); app.set_process(false)
	var original: String=app.document.serialize()
	app.motion=flat_motion()
	app.motion.layout.buildings={"town_square":{"x":38,"y":25,"w":5,"h":5}}
	app.rig.angle=0; app.rig._sync()
	find_button(app,"1×").grab_focus()
	await send_key(KEY_W,true)
	for i in 60: app._process(1.0/60)
	await send_key(KEY_W,false)
	check(absf(point(app.motion).y-408)<.001 and not app.running,"W moves traveler while world paused")
	check(app.simulation.data.tickCount==0,"walking does not advance paused clock")
	check(app.simulation.data.agents.player.currentLocation=="town_square","walking updates logical player location")
	check(app.rig.follow_player and app.rig.position.z<27,"camera follows traveler")
	check(app.document.serialize()==original,"walking preserves original save bytes")
	var stopped:=point(app.motion)
	for i in 60: app._process(1.0/60)
	check(point(app.motion)==stopped and not app.motion.positions.player.walking,"key release stops movement")
	app.rig.pan(Vector2(20,0))
	check(not app.rig.follow_player,"manual camera pan disables follow")
	await send_key(KEY_RIGHT,true)
	app._process(1.0/60)
	await send_key(KEY_RIGHT,false)
	check(app.rig.follow_player and point(app.motion).x>stopped.x,"arrow moves and resumes follow even with button focus")
	for angle in [45,135,225,315]:
		app.rig.angle=angle; app.rig._sync()
		var before:=point(app.motion)
		await send_key(KEY_W,true)
		app._process(1.0/30)
		await send_key(KEY_W,false)
		var delta:=point(app.motion)-before
		var expected: Vector3=-app.rig.global_transform.basis.z
		check(delta.normalized().dot(Vector2(expected.x,expected.z))>.9999,"screen up after camera angle %d"%angle)
	app.rig.angle=0; app.rig._sync()
	var text:=LineEdit.new(); app.hud.add_child(text); text.position=Vector2(300,200); text.size=Vector2(200,40); text.grab_focus()
	stopped=point(app.motion)
	await send_key(KEY_W,true,119)
	app._process(.05)
	await send_key(KEY_W,false)
	check(point(app.motion)==stopped and text.text=="w","typing W in text field does not move traveler")
	text.release_focus(); text.queue_free(); await settle()
	await send_key(KEY_D,true)
	app.get_window().focus_exited.emit()
	stopped=point(app.motion); app._process(.05)
	check(point(app.motion)==stopped and app.traveler.held.is_empty(),"focus loss clears held input")
	app.dialog.popup_centered_ratio(.8)
	await settle()
	await send_key(KEY_D,true)
	app._process(.05)
	check(point(app.motion)==stopped,"file dialog blocks movement")
	await send_key(KEY_D,false); app.dialog.hide(); await settle()
	# World speed must not scale direct player input.
	app.running=true; app.speed=16
	app.simulation.data.agents.player.currentLocation="tavern"
	await send_key(KEY_D,true)
	stopped=point(app.motion)
	for i in 60: app._process(1.0/60)
	await send_key(KEY_D,false)
	check(absf(point(app.motion).distance_to(stopped)-72)<.01,"16x world still moves traveler at real-time 4.5 tiles/s")
	app.running=false
	app.motion.update(app.simulation.data.agents)
	check(point(app.motion).distance_to(stopped)>71,"NPC routing does not override manual traveler")
	# Save the real layout so the restored location checks use the same map geometry.
	app.motion.layout=app.world_view.layout
	app.motion.pathfinder.grid=app.motion.layout.grid
	var saved: Dictionary=app.progress_snapshot()
	var saved_point:=point(app.motion)
	app._load_document(JSON.stringify(saved,"",false,true),"測試")
	check(app.motion.manual_player and point(app.motion).distance_to(saved_point)<.0001,"manual position survives export/reload")
	check(app.traveler.held.is_empty() and not app.motion.positions.player.walking,"reload never replays held keys")
	check(app.world_view.actors.player.get_node_or_null("TravelerMarker")!=null,"traveler has visible marker")
	root.size=Vector2i(375,812); await settle()
	check(app.playback.get_global_rect().end.x<=375,"locate traveler button fits 375px")
	app.load_demo("harbor")
	check(not app.motion.manual_player and app.traveler.held.is_empty(),"town switch resets manual state")
	var report:={"checks":checks,"failures":failures,"method":"pure collision checks plus Godot keyboard input dispatch","scope":"desktop keyboard control; mobile hardware not tested"}
	FileAccess.open("res://docs/TRAVELER_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report)); quit(0 if failures.is_empty() else 1)

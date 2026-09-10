extends "res://tests/test_appointments_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	w.data.agents.chen_wei.jobKey="" # Controlled free-day fixture for the stricter return-time check.
	SimAppointments.offer(w,"chen_wei");app.show_tab("居民",true);app.show_appointment("chen_wei")
	check(not has_text(app.drawer_body,"赴約狀態"),"unaccepted offer has no active guidance")
	press(app.drawer_body,"接受邀約");await settle();var a:=SimAppointments.current(w)
	check(has_text(app.drawer_body,"赴約狀態") and has_text(app.drawer_body,"距結束還有"),"accepted appointment shows deadline")
	var positions: Dictionary=app.motion.positions.duplicate(true);var saved:=w.snapshot()
	press(app.drawer_body,"查看約定地點");await settle()
	var point: Vector2=app.motion.layout._center(a.place)
	check(app.rig.position.distance_to(Vector3(point.x/16,0,point.y/16))<.01 and not app.rig.follow_player,"camera focuses real venue")
	check(equal(saved,w.snapshot()) and equal(positions,app.motion.positions),"camera lookup cannot move anyone or spend resources")
	check(not app.drawer.visible and app.active_tab=="","phone drawer closes to reveal map")
	# Actual-position fixtures exercise labels independently of logical destination.
	w.data.agents.chen_wei.currentLocation=a.place
	app.motion.positions.chen_wei.x=0;app.motion.positions.chen_wei.y=0
	app.show_tab("居民",true);app.show_appointment("chen_wei")
	check(has_text(app.drawer_body,"對方：尚未到"),"logical destination not presented as arrival")
	app.motion.positions.chen_wei.x=point.x;app.motion.positions.chen_wei.y=point.y
	check(walk_player(app,point),"player collision-walks to venue")
	app.show_appointment("chen_wei");await settle()
	check(has_text(app.drawer_body,"你：已到") and has_text(app.drawer_body,"對方：已在"),"physical venue arrival shown for both")
	check(a.state=="accepted" and has_text(app.drawer_body,"到約定時間後"),"early arrival does not complete meeting")
	var fits:=true
	for c in app.drawer_body.get_children():
		if c is Control and c.size.x>app.drawer.size.x: fits=false
	check(fits,"375px guidance fits")
	w.data.tickCount=a.until;app.show_appointment("chen_wei")
	check(has_text(app.drawer_body,"赴約時段已結束"),"expired window not displayed as extra two-hour wait")
	saved=w.snapshot();var camera: Vector3=app.rig.position;press(app.drawer_body,"查看約定地點")
	check(equal(saved,w.snapshot()) and app.rig.position==camera,"stale locate callback is harmless")
	var report:={"checks":checks,"failures":failures,"scope":"controlled free-day NPC for return availability; real accept and camera buttons, physical-position fixtures vs logical destinations, collision-based player arrival, no world changes or early completion, expired callback and phone width"}
	FileAccess.open("res://docs/APPOINTMENT_GUIDANCE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

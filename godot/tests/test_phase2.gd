extends SceneTree
var failures: Array[String] = []
var checks := 0
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message)
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	for theme in ["frontier","harbor"]:
		for day in [1,7,30]:
			var raw := FileAccess.get_file_as_string("res://tests/golden/%s-day-%02d.json" % [theme,day])
			var doc := SaveDocument.new()
			check(doc.parse(raw),"parse %s/%s" % [theme,day])
			check(doc.serialize() == raw,"byte exact round-trip")
			var snapshot := doc.snapshot()
			var old_tick: float = doc.data.tickCount
			snapshot.tickCount += 100
			check(doc.data.tickCount == old_tick,"snapshot isolation")
			check(not doc.parse("broken"),"invalid JSON rejected")
			check(doc.serialize() == raw,"invalid input retains document")
	var future := '{"version":999,"clock":{},"tickCount":42,"agents":{},"townMap":{"locations":{}},"future":{"unknown":[null,true,"繁中",{"x":1.23456789012345}]}}'
	var future_doc := SaveDocument.new()
	check(future_doc.parse(future),"future schema readable")
	check(future_doc.serialize() == future,"unknown nested fields preserved")
	var api := ApiClient.new()
	api.persist_session = false
	api.base_url = OS.get_cmdline_user_args()[0]
	root.add_child(api)
	var result := await api.login("fixture-user","fixture-password")
	check(result.ok and not api.token.is_empty(),"login stores returned nonce")
	result = await api.me()
	check(result.ok and result.data.logged_in,"Bearer me")
	result = await api.saves()
	check(result.ok and result.data.size() == 1,"cloud list")
	result = await api.load_save("fixture-town")
	var loaded := SaveDocument.new()
	check(result.ok and loaded.parse(result.data.save_data),"download JSON dictionary")
	result = await api.save("fixture-town",loaded.data)
	check(not result.ok and result.status == 0,"viewer blocks cloud write")
	api.read_only = false
	result = await api.save("fixture-town",loaded.data)
	check(not result.ok and result.get("stale",false),"stale is not an overwrite")
	result = await api.settings()
	check(result.ok,"GET settings")
	result = await api.set_settings(20)
	check(result.ok,"POST settings contract")
	for lane in ["chat","background"]:
		result = await api.chat("fixture prompt",lane)
		check(result.ok and result.data.lane == lane,"chat lane "+lane)
	result = await api.chat("fixture prompt","invalid")
	check(not result.ok,"invalid lane rejected")
	result = await api.request_json("invalid-json")
	check(not result.ok,"malformed response rejected")
	result = await api.request_json("denied")
	check(not result.ok and api.token.is_empty(),"401 clears session")
	result = await api.register("fixture-user","fixture-password","fixture@example.invalid")
	check(result.ok,"register contract")
	var rig := TownCamera.new()
	root.add_child(rig)
	rig.zoom_by(0.001)
	check(rig.width == 8,"zoom minimum")
	rig.zoom_by(100)
	check(rig.width == 40,"zoom maximum")
	var angle := rig.angle
	for i in 4: rig.turn(1)
	check(rig.angle == angle,"four rotations")
	var report := {"checks":checks,"failures":failures,"round_trip_fixtures":6,"lost_keys":0 if failures.is_empty() else -1,"live_production_login":"not tested"}
	var file := FileAccess.open("res://docs/PHASE2_TESTS.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

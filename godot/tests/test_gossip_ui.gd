extends SceneTree
var checks:=0
var failures: Array=[]
func check(value: bool,message: String) -> void:
	checks+=1
	if not value: failures.append(message)
func press(parent: Node,text: String) -> void:
	for child in parent.get_children():
		if child is Button and child.text==text: child.pressed.emit();return
	check(false,"missing button "+text)
func _initialize() -> void: call_deferred("run")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false)
	app.simulation.trace_enabled=false # Isolate prior suites.
	app.simulation.mourning_enabled=false # Isolate earlier suites.
	app.simulation.mischief_enabled=false # Isolate earlier suites.
	app.simulation.stargazing_enabled=false # Isolate the existing feature suite.
	app.simulation.inner_voice_enabled=false # Preserve the older suite scope.
	app.simulation.thoughts_enabled=false # Earlier feature suites keep their original scope.
	app.simulation.factions_enabled=false # This suite isolates its historical subsystem.
	app.simulation.feuds_enabled=false # Keep this historical suite within its original scope.
	app.simulation.romance_enabled=false # This suite isolates pre-romance behavior.
	var raw: String=app.document.serialize()
	check(app.simulation.gossip_enabled and app.simulation.social_enabled,"fresh import enables gossip with socializing")
	app.show_tab("設定",true);press(app.drawer_body,"八卦傳播：開啟")
	check(not app.simulation.gossip_enabled,"toggle off")
	var before: Array=app.simulation.data.gossip.duplicate(true)
	for i in 96: app._tick_simulation()
	check(app.simulation.data.gossip==before,"disabled gossip stays unchanged while NPC chat continues")
	var saved: Dictionary=app.progress_snapshot()
	app._load_document(JSON.stringify(saved,"",false,true),"resume")
	check(not app.simulation.gossip_enabled and app.simulation.social_enabled,"gossip mode saved separately")
	app.show_tab("設定",true);press(app.drawer_body,"八卦傳播：關閉")
	app.show_tab("故事",true);press(app.drawer_body,"八卦與鎮民動態")
	for i in 96: app._tick_simulation()
	check(app.gossip_page and not app.conversation_page,"gossip page retained while ticking")
	check(app.simulation.data.gossip!=before,"enabled gossip spreads")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"gossip content fits 375px")
	press(app.drawer_body,"返回故事");press(app.drawer_body,"村民對話紀錄")
	check(app.conversation_page and not app.gossip_page,"dialogue navigation clears gossip subpage")
	app._load_document(raw,"fresh")
	var data: Dictionary=app.simulation.data
	var ids: Array=data.agents.keys().filter(func(id): return id!="player")
	data.gossip=[{"about":data.agents[ids[1]].name,"source":data.agents[ids[0]].name,"content":"最近行為很奇怪。","spreadCount":3,"isTrue":false,"tickCreated":0,"future":{"keep":true}}]
	data.agents[ids[0]].personality.traits=["gossip"]
	# Seed a near-confrontation fixture, then resume and compare the exact next spread.
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(app.simulation.snapshot(),"",false,true)))
	SimGossip.spread(data.agents[ids[0]],data.agents.player,data,app.simulation.rng)
	SimGossip.spread(resumed.data.agents[ids[0]],resumed.data.agents.player,resumed.data,resumed.rng)
	check(JSON.parse_string(JSON.stringify(app.simulation.snapshot(),"",true,true))==JSON.parse_string(JSON.stringify(resumed.snapshot(),"",true,true)),"fourth-hand event resumes exactly")
	check(data.gossip[0]._confronted and data.gossip[0].future.keep,"confrontation flag and unknown fields retained")
	check(data.townFeed.posts.size()>0,"NPC posts after confrontation")
	var affinity: float=data.agents[ids[1]].relationships[ids[0]].affinity
	SimGossip.spread(data.agents[ids[0]],data.agents.player,data,app.simulation.rng)
	check(data.agents[ids[1]].relationships[ids[0]].affinity==affinity,"confrontation effect not repeated")
	check(app.document.serialize()==raw,"original bytes retained")
	FileAccess.open("res://tests/gossip/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	var report:={"checks":checks,"failures":failures,"scope":"gossip toggles, fourth-hand resume, original/unknown fields and mobile story panel; button signals"}
	FileAccess.open("res://docs/GOSSIP_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends SceneTree
var checks:=0
var failures: Array=[]
func check(value: bool,message: String) -> void:
	checks+=1
	if not value: failures.append(message)
func press(parent: Node,text: String) -> void:
	for child in parent.get_children():
		if child is Button and child.text==text:
			child.pressed.emit();return
	check(false,"missing button "+text)
func _initialize() -> void: call_deferred("run")
func run() -> void:
	var viewport:=SubViewport.new()
	viewport.size=Vector2i(375,812)
	viewport.own_world_3d=true
	root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate()
	viewport.add_child(app)
	await process_frame
	app.set_process(false)
	var raw: String=app.document.serialize()
	check(app.simulation.social_enabled,"new web import enables local socializing")
	app.show_tab("設定",true)
	press(app.drawer_body,"NPC 本地社交：開啟")
	check(not app.simulation.social_enabled,"toggle off")
	var previous: Dictionary=app.simulation.data.agents.duplicate(true)
	for i in 96: app._tick_simulation()
	for id in previous:
		check(app.simulation.data.agents[id].memory==previous[id].memory,"disabled memory unchanged "+id)
		check(app.simulation.data.agents[id].relationships==previous[id].relationships,"disabled relationships unchanged "+id)
	var disabled: Dictionary=app.progress_snapshot()
	check(disabled._godot4a.social_enabled==false,"off mode saved")
	app._load_document(JSON.stringify(disabled,"",false,true),"reload")
	check(not app.simulation.social_enabled,"off mode restored")
	app.show_tab("設定",true)
	press(app.drawer_body,"NPC 本地社交：關閉")
	check(app.simulation.social_enabled,"toggle on")
	app.show_tab("故事",true)
	press(app.drawer_body,"村民對話紀錄")
	for i in 96: app._tick_simulation()
	check(app.conversation_page and app.active_tab=="故事","dialogue page survives ticks")
	check(app.simulation.data.npcConversationLog.size()>0,"autonomous conversations generated")
	check(app.document.serialize()==JSON.stringify(disabled,"",false,true),"simulation preserves imported original")
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"dialogue wraps within mobile drawer")
	var save: Dictionary=app.progress_snapshot()
	save.futureSocialField={"unknown":[1,2,3]}
	var other:=SimWorld.new();other.load_snapshot(save)
	check(other.social_enabled,"enabled mode restored")
	for i in 96: app.simulation.tick();other.tick()
	check(JSON.stringify(app.simulation.data.agents,"",true,true)==JSON.stringify(other.data.agents,"",true,true),"social state resumes deterministically")
	check(other.snapshot().futureSocialField==save.futureSocialField,"future fields survive social ticks")
	FileAccess.open("res://tests/social/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(other.snapshot(),"",false,true))
	app._load_document(raw,"fresh")
	check(app.simulation.social_enabled and app.simulation.data.tickCount==0,"fresh import resets world and re-enables default")
	var report:={"checks":checks,"failures":failures,"scope":"local social toggle, story dialogue page, save/resume, mobile layout; button signals, not OS input"}
	FileAccess.open("res://docs/NPC_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

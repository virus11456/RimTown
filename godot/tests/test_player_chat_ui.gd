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
func has_text(parent: Node,text: String) -> bool:
	for child in parent.get_children():
		if child is Label and text in child.text: return true
	return false
func _initialize() -> void: call_deferred("run")
func equal(a: Variant,b: Variant) -> bool:
	if (a is float or a is int) and (b is float or b is int): return absf(float(a)-float(b))<.00000001
	if a is Dictionary and b is Dictionary:
		if a.size()!=b.size(): return false
		for key in a:
			if not b.has(key) or not equal(a[key],b[key]): return false
		return true
	if a is Array and b is Array:
		if a.size()!=b.size(): return false
		for i in a.size():
			if not equal(a[i],b[i]): return false
		return true
	return a==b
signal release_reply
var requests:=0
var last_prompt:=""
var reply: Dictionary={"ok":true,"data":{"reply":"今天在鎮上過得很好。\nEFFECTS: {\"affinity_change\":3,\"romantic_change\":0,\"summary\":\"聊起小鎮生活。\"}"}}
func mock(prompt: String) -> Dictionary:
	requests+=1;last_prompt=prompt
	await release_reply
	return reply
func settle() -> void:
	for i in 3: await process_frame
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app)
	await process_frame
	app.set_process(false);app.chat_transport=mock
	var raw: String=app.document.serialize()
	var w: SimWorld=app.simulation
	SimFeuds._memory(w.data.agents.chen_wei,w,"observation","看到林美正忙著工作",2,["林美"])
	app.show_tab("居民",true);app.show_player_chat("chen_wei")
	app.chat_drafts.chen_wei="林美今天在做什麼？"
	app._tick_simulation()
	check(app.resident_page=="chat" and app.chat_drafts.chen_wei=="林美今天在做什麼？","ticks preserve chat draft")
	var huge: String=w.data.agents.chen_wei.personality.background
	w.data.agents.chen_wei.personality.background="長背景".repeat(5000)
	var bounded:=SimPlayerChat.prompt(w,"chen_wei","重要問題".repeat(200))
	check(bounded.to_utf16_buffer().size()<=11600 and "EFFECTS:" in bounded and "重要問題" in bounded,"server prompt budget retains question and format")
	w.data.agents.chen_wei.personality.background=huge
	var before: Dictionary=w.snapshot()
	app.send_player_chat("chen_wei","林美今天在做什麼？")
	app.send_player_chat("chen_wei","重複傳送")
	check(requests==1 and app.chat_busy,"one in-flight request")
	check(equal(before,w.snapshot()),"no mutation before response")
	check("看到林美正忙著工作" in last_prompt,"relevant observation reaches prompt")
	check("relevantMemories" in last_prompt and "recentChat" in last_prompt,"prompt contains memory and history context")
	release_reply.emit();await settle()
	check(not app.chat_busy and w.data.agents.player.chatHistory.size()==2,"one message pair committed")
	check(has_text(app.drawer_body,"今天在鎮上過得很好"),"reply visible")
	check(not app.chat_drafts.has("chen_wei"),"successful draft cleared")
	FileAccess.open("res://tests/player_chat/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px chat width")
	before=w.snapshot()
	reply={"ok":false,"status":429,"error":"今日額度已用完"}
	app.send_player_chat("chen_wei","失敗訊息");release_reply.emit();await settle()
	check(equal(before,w.snapshot()),"quota failure has no game effects")
	check(app.chat_drafts.chen_wei=="失敗訊息" and has_text(app.drawer_body,"今日額度已用完"),"failure keeps draft and shows reason")
	reply={"ok":true,"data":{"reply":"EFFECTS: {}"}}
	app.send_player_chat("chen_wei","空回覆");release_reply.emit();await settle()
	check(equal(before,w.snapshot()),"invalid dialogue has no effects")
	reply={"ok":true,"data":{"reply":"你好。\nEFFECTS: {\"affinity_change\":1}"}}
	app.send_player_chat("chen_wei","等待時換鎮")
	app.load_demo("harbor")
	var harbor: Dictionary=w.snapshot()
	release_reply.emit();await settle()
	check(equal(harbor,w.snapshot()) and not app.chat_busy,"late response cannot mutate new town")
	check(app.document.serialize()!=raw,"different town loaded")
	var saved: String=FileAccess.get_file_as_string("res://tests/player_chat/compatibility-save.json.tmp")
	app._load_document(saved,"chat resume")
	check(w.data.agents.player.chatHistory.size()==2,"chat history restored")
	var resumed:=SimWorld.new();resumed.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	for i in 96: app._tick_simulation();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"post-chat all-mode resume")
	var report:={"checks":checks,"failures":failures,"scope":"mock transport only: context, draft preservation, double submit, success, quota/invalid failures, stale town response, mobile UI and save resume; no production API"}
	FileAccess.open("res://docs/PLAYER_CHAT_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

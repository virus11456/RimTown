extends Node3D
var document := SaveDocument.new()
var api: ApiClient
var rig: TownCamera
var world_view: Node3D
var hud: Control
var header: PanelContainer
var heading: Label
var summary: Label
var status: Label
var navigation: HBoxContainer
var drawer: PanelContainer
var drawer_body: VBoxContainer
var dialog: FileDialog
var active_tab := ""
var desktop_camera: VBoxContainer
var mobile_turn: Button
var busy := false
var import_callback: JavaScriptObject
var demo_theme := "frontier"
var simulation := SimWorld.new()
var motion := SimMotion.new()
var running := false
var has_simulated := false
var speed := 1
var frame_accumulator := 0.0
var tick_accumulator := 0.0
var playback: HBoxContainer
var play_button: Button
var speed_button: Button
var selected_agent := ""
var chat_offline:=false
var chat_epoch:=0
var chat_busy:=false
var chat_transport: Callable
var chat_drafts: Dictionary={}
var chat_notice: Dictionary={}
var resident_page := "summary"
var export_directory := "user://" # Tests can use a writable temporary directory.
var memory_target := ""
var conversation_page := false
var gossip_page := false
var romance_page := false
var factions_page := false
var traveler: TravelerControls

func _ready() -> void:
	TranslationServer.set_locale("zh_TW")
	api = ApiClient.new()
	add_child(api)
	rig = TownCamera.new()
	add_child(rig)
	_make_world_view()
	_build_ui()
	traveler=TravelerControls.new()
	traveler.modal_open=func(): return dialog.visible
	traveler.interact_requested.connect(interact_nearby)
	add_child(traveler)
	load_demo("frontier")
	get_viewport().size_changed.connect(_responsive)
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_matrix.flag"): _capture_demo()
	_responsive()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_playtest.flag"): _capture_playtest()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_traveler.flag"): _capture_traveler()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_social.flag"): _capture_social()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_npc.flag"): _capture_npc()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_gossip.flag"): _capture_gossip()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_romance.flag"): _capture_romance()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_feuds.flag"): _capture_feuds()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_factions.flag"): _capture_factions()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_thoughts.flag"): _capture_thoughts()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_inner_voice.flag"): _capture_inner_voice()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_stargazing.flag"): _capture_stargazing()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_mischief.flag"): _capture_mischief()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_mourning.flag"): _capture_mourning()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_trace.flag"): _capture_trace()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_perception.flag"): _capture_perception()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_player_interaction.flag"): _capture_player_interaction()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_player_chat.flag"): _capture_player_chat()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_player_intents.flag"): _capture_player_intents()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_player_offline.flag"): _capture_player_offline()
	if "--smoke" in OS.get_cmdline_user_args():
		await get_tree().process_frame
		get_tree().quit()

func _make_world_view() -> void:
	# Rendering consumes snapshots; the Phase 4a core remains independent of Nodes.
	if ResourceLoader.exists("res://scripts/view/town_view.gd"):
		world_view = load("res://scripts/view/town_view.gd").new()
		add_child(world_view)

func _panel(color: Color, radius := 14) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	return style

func _button(text: String, parent: Node, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size.y = 42
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.add_theme_stylebox_override("normal", _panel(Color("294542"),8))
	button.add_theme_stylebox_override("hover", _panel(Color("3b6256"),8))
	button.add_theme_stylebox_override("pressed", _panel(Color("526d56"),8))
	button.pressed.connect(action)
	parent.add_child(button)
	return button

func _label(text: String, parent: Node, size := 16) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size)
	parent.add_child(label)
	return label

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	hud = Control.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(hud)
	var theme := Theme.new()
	if ResourceLoader.exists("res://assets/fonts/NotoSansTC.ttf"):
		theme.default_font = load("res://assets/fonts/NotoSansTC.ttf")
	theme.default_font_size = 16
	theme.set_color("font_color", "Label", Color("ede8d4"))
	theme.set_color("font_color", "Button", Color("ede8d4"))
	hud.theme = theme
	header = PanelContainer.new()
	header.add_theme_stylebox_override("panel", _panel(Color("172e2eea")))
	hud.add_child(header)
	var title_row := HBoxContainer.new()
	title_row.add_theme_constant_override("separation",18)
	header.add_child(title_row)
	var title_stack := VBoxContainer.new()
	title_stack.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_row.add_child(title_stack)
	var eyebrow := _label("R I M T O W N   /   3 D",title_stack,12)
	eyebrow.modulate = Color("d6ba80")
	heading = _label("邊境鎮",title_stack,25)
	summary = _label("",title_stack,13)
	summary.clip_text=true
	summary.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	var controls := VBoxContainer.new()
	desktop_camera = controls
	title_row.add_child(controls)
	var rotate := HBoxContainer.new()
	controls.add_child(rotate)
	_button("↶",rotate,func(): rig.turn(-1))
	_button("↷",rotate,func(): rig.turn(1))
	_button("＋",rotate,func(): rig.zoom_by(0.8))
	_button("－",rotate,func(): rig.zoom_by(1.25))
	_label("拖曳平移 · 滾輪縮放",controls,11)
	mobile_turn = _button("↻",title_row,func(): rig.turn(1))
	navigation = HBoxContainer.new()
	navigation.add_theme_constant_override("separation",8)
	hud.add_child(navigation)
	for tab in ["小鎮","居民","故事","設定"]:
		var button := _button(tab,navigation,func(): show_tab(tab))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status = _label("",hud,13)
	status.autowrap_mode = TextServer.AUTOWRAP_OFF
	status.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	status.clip_text=true
	status.mouse_filter = Control.MOUSE_FILTER_IGNORE
	playback = HBoxContainer.new()
	hud.add_child(playback)
	play_button = _button("▶ 開始",playback,toggle_simulation)
	_button("＋15 分",playback,step_simulation)
	speed_button = _button("1×",playback,func(): speed={1:4,4:16,16:1}[speed]; speed_button.text="%d×"%speed)
	var locate:=_button("找旅人",playback,focus_traveler)
	locate.tooltip_text="WASD／方向鍵移動旅人；Q／E 轉向相機。"
	drawer = PanelContainer.new()
	drawer.add_theme_stylebox_override("panel",_panel(Color("172e2ef7")))
	hud.add_child(drawer)
	var outer := VBoxContainer.new()
	drawer.add_child(outer)
	_button("收起面板 ×",outer,func(): drawer.hide(); active_tab="")
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	outer.add_child(scroll)
	drawer_body = VBoxContainer.new()
	drawer_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	drawer_body.add_theme_constant_override("separation",10)
	scroll.add_child(drawer_body)
	drawer.hide()
	dialog = FileDialog.new()
	dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	dialog.access = FileDialog.ACCESS_FILESYSTEM
	dialog.filters = PackedStringArray(["*.json ; RimTown JSON"])
	dialog.file_selected.connect(func(path):
		if FileAccess.get_file_as_bytes(path).size() > 20*1024*1024:
			status.text="檔案超過 20 MB。"
			return
		_load_document(FileAccess.get_file_as_string(path),"本機存檔"))
	add_child(dialog)

func _responsive() -> void:
	var size := get_viewport().get_visible_rect().size
	var mobile := size.x < 650
	desktop_camera.visible = not mobile
	mobile_turn.visible = mobile
	header.position = Vector2(16,16)
	header.size = Vector2(size.x-32,110)
	heading.add_theme_font_size_override("font_size",20 if mobile else 25)
	navigation.position = Vector2(maxf(16,(size.x-420)/2),size.y-64)
	navigation.size = Vector2(minf(420,size.x-32),48)
	status.position = Vector2(20,134)
	status.size = Vector2(size.x-40,24)
	playback.position=Vector2(20,158)
	playback.size=Vector2(260,42)
	drawer.position = Vector2(16 if mobile else size.x-360,212)
	drawer.size = Vector2(size.x-32 if mobile else 344,maxf(180,size.y-drawer.position.y-84))

func _load_document(text: String, source: String) -> bool:
	var incoming := SaveDocument.new()
	if not incoming.parse(text):
		status.text = incoming.error
		return false
	chat_epoch+=1;chat_busy=false;chat_drafts.clear();chat_notice.clear()
	running=false
	if traveler!=null: traveler.clear()
	rig.follow_player=false
	has_simulated=false
	frame_accumulator=0
	tick_accumulator=0
	play_button.text="▶ 開始"
	selected_agent=""
	document = incoming
	simulation.load_snapshot(document.snapshot())
	simulation.social_enabled=bool(document.data.get("_godot4a",{}).get("social_enabled",true))
	simulation.gossip_enabled=bool(document.data.get("_godot4a",{}).get("gossip_enabled",true))
	simulation.romance_enabled=bool(document.data.get("_godot4a",{}).get("romance_enabled",true))
	simulation.feuds_enabled=bool(document.data.get("_godot4a",{}).get("feuds_enabled",true))
	simulation.factions_enabled=bool(document.data.get("_godot4a",{}).get("factions_enabled",true))
	simulation.thoughts_enabled=bool(document.data.get("_godot4a",{}).get("thoughts_enabled",true))
	simulation.inner_voice_enabled=bool(document.data.get("_godot4a",{}).get("inner_voice_enabled",true))
	simulation.stargazing_enabled=bool(document.data.get("_godot4a",{}).get("stargazing_enabled",true))
	simulation.mischief_enabled=bool(document.data.get("_godot4a",{}).get("mischief_enabled",true))
	simulation.mourning_enabled=bool(document.data.get("_godot4a",{}).get("mourning_enabled",true))
	simulation.trace_enabled=bool(document.data.get("_godot4a",{}).get("trace_enabled",true))
	simulation.perception_enabled=bool(document.data.get("_godot4a",{}).get("perception_enabled",true))
	var data := document.snapshot()
	heading.text = str(data.get("townName","小鎮"))
	var clock_data: Dictionary = data.clock
	summary.text = "%s %d日 %02d:%02d · %d人" % [clock_data.get("season",""),clock_data.get("day",1),clock_data.get("hour",6),clock_data.get("minute",0),data.agents.size()]
	status.text = "%s · 時間暫停 · WASD 移動旅人" % source
	if world_view != null:
		world_view.call("display_save",data)
	if world_view != null:
		motion.configure(world_view.layout)
		var saved: Dictionary=document.data.get("_godot4a",{})
		if saved.has("motion") and saved.motion is Dictionary:
			motion.positions=saved.motion.duplicate(true)
			motion.manual_player=bool(saved.get("manual_player",false))
			if motion.manual_player and motion.positions.has("player"):
				motion.positions.player.walking=false
				motion.positions.player.walkStep=0
			if saved.get("house_map") is Dictionary: motion.layout.agent_house=saved.house_map.duplicate(true)
			tick_accumulator=float(saved.get("tick_accumulator",0))
		else: motion.update(simulation.data.agents)
		world_view.animate_agents(motion.positions)
	if not active_tab.is_empty(): show_tab(active_tab,true)
	return true

func load_demo(theme: String) -> void:
	demo_theme = theme
	_load_document(FileAccess.get_file_as_string("res://tests/golden/%s-day-01.json" % theme),"示範小鎮")

func _clear_drawer() -> void:
	for child in drawer_body.get_children():
		drawer_body.remove_child(child)
		child.queue_free()

func show_tab(tab: String, refresh := false) -> void:
	if active_tab == tab and not refresh:
		drawer.hide()
		active_tab = ""
		return
	active_tab = tab
	conversation_page=false
	gossip_page=false
	romance_page=false
	factions_page=false
	if not refresh: selected_agent=""
	drawer.show()
	_clear_drawer()
	_label(tab,drawer_body,24)
	match tab:
		"小鎮":
			_button("查看邊境鎮示範",drawer_body,func(): load_demo("frontier"))
			_button("查看海風鎮示範",drawer_body,func(): load_demo("harbor"))
			_button("匯入網頁版存檔",drawer_body,import_save)
			_button("匯出原始存檔副本",drawer_body,export_save)
			_button("匯出試玩進度",drawer_body,export_progress)
			_wrapped("試玩：作息、需求與走路已啟用。\n居民社交與關係事件可在設定開關。\n資源與任務尚未啟用。",13)
			var resources: Dictionary = _current_data().get("stockpile",{}).get("resources",{})
			for key in resources:
				if float(resources[key]) != 0: _label("%s   %d" % [_resource_name(key),resources[key]],drawer_body)
		"居民":
			for id in _current_data().get("agents",{}):
				var agent: Dictionary = _current_data().agents[id]
				_button(str(agent.get("name",id)),drawer_body,func(): show_agent(id))
		"故事":
			_button("村民對話紀錄",drawer_body,show_conversations)
			_button("八卦與鎮民動態",drawer_body,show_gossip)
			_button("關係事件",drawer_body,show_romance)
			_button("居民派系",drawer_body,show_factions)
			var logs: Array = _current_data().get("messageLog",[])
			if logs.is_empty(): _label("故事從這裡開始。",drawer_body)
			for entry in logs.slice(maxi(0,logs.size()-30)):
				var label := _label(str(entry.get("content","")),drawer_body,14)
				label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		"設定": _settings_ui()

func show_agent(id: String,focus_camera := true) -> void:
	resident_page="summary"
	selected_agent=id
	_clear_drawer()
	var agent: Dictionary = _current_data().agents[id]
	_label(str(agent.get("name",id)),drawer_body,24)
	_label("%s 歲 · %s" % [str(int(agent.get("age",0))),_job_name(str(agent.get("jobKey","旅人")))],drawer_body)
	_label("目前："+_activity_name(str(agent.get("activity","idle"))),drawer_body)
	var label := _label(str(agent.get("personality",{}).get("background","")),drawer_body)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	for key in agent.get("needs",{}):
		_label("%s    %d" % [{"hunger":"飽足","rest":"休息","social":"社交","comfort":"舒適","recreation":"娛樂","beauty":"美感"}.get(key,key),agent.needs[key]],drawer_body,14)
	if world_view != null and focus_camera:
		rig.follow_player=id=="player"
		var pos: Variant = world_view.call("agent_position",id)
		if pos is Vector3: rig.position = Vector3(pos.x,0,pos.z)
	if not agent.get("isPlayer",false): _button("與他互動",drawer_body,func(): show_player_interaction(id))
	_button("今日足跡",drawer_body,func(): show_trace(id))
	_button("近期記憶",drawer_body,func(): show_memories(id))
	_button("目前想法",drawer_body,func(): show_thoughts(id))
	if not str(agent.get("currentThought","")).is_empty(): _wrapped("此刻心聲："+str(agent.currentThought))
	_button("人際關係",drawer_body,func(): show_relationships(id))
	_button("返回居民列表",drawer_body,func(): selected_agent=""; show_tab("居民",true))

func show_factions() -> void:
	factions_page=true
	romance_page=false
	gossip_page=false
	conversation_page=false
	_clear_drawer()
	_wrapped("居民派系",22)
	_wrapped("每三個遊戲日檢查一次。志趣相近的居民可能組成圈子、結盟或起衝突。")
	_button("返回故事",drawer_body,func(): show_tab("故事",true))
	var data:=_current_data()
	var factions: Dictionary=data.get("factions",{}).get("factions",{})
	if factions.is_empty(): _wrapped("尚未形成派系。讓居民相處幾天，再回來看看。")
	for f in factions.values():
		_wrapped(str(f.icon)+" "+str(f.name),18)
		var names: PackedStringArray=[]
		for id in f.members: names.append(str(data.agents.get(id,{}).get("name",id)))
		_wrapped("成員："+"、".join(names))
		_wrapped("凝聚力：%d／100"%int(f.cohesion))
		for field in ["allyFactionId","rivalFactionId"]:
			if f.get(field): _wrapped(("盟友：" if field=="allyFactionId" else "對立：")+str(factions.get(f[field],{}).get("name","已不存在的派系")))
	_wrapped("近期派系事件",18)
	var logs: Array=data.get("messageLog",[]).filter(func(entry): return entry.get("type")=="faction")
	var recent:=logs.slice(maxi(0,logs.size()-15));recent.reverse()
	for entry in recent: _wrapped(str(entry.get("time",""))+"\n"+str(entry.get("content","")))

func show_romance() -> void:
	factions_page=false
	romance_page=true
	gossip_page=false
	conversation_page=false
	_clear_drawer()
	_wrapped("關係事件",22)
	_wrapped("每天換日時判定戀愛與仇怨。居民可能絕交、公開爭吵，旁人也可能選邊站。")
	_button("返回故事",drawer_body,func(): show_tab("故事",true))
	var logs: Array=_current_data().get("messageLog",[]).filter(func(entry): return entry.get("type")=="relationship" or SimFeuds.is_event(entry))
	if logs.is_empty(): _wrapped("尚無關係事件。按「開始」讓居民相處，再過幾天回來看看。")
	var recent:=logs.slice(maxi(0,logs.size()-30))
	recent.reverse()
	for entry in recent:
		_wrapped(str(entry.get("time","")),12)
		_wrapped(str(entry.get("content","")),16)

func show_gossip() -> void:
	romance_page=false
	factions_page=false
	gossip_page=true
	conversation_page=false
	_clear_drawer()
	_wrapped("八卦與鎮民動態",22)
	_wrapped("傳聞可能失真；傳到第四手可能引起當事人回應。")
	_button("返回故事",drawer_body,func(): show_tab("故事",true))
	var data:=_current_data()
	var gossip: Array=data.get("gossip",[])
	_wrapped("最近 %d 則傳聞／共 %d 則"%[mini(20,gossip.size()),gossip.size()])
	var recent:=gossip.slice(maxi(0,gossip.size()-20))
	recent.reverse()
	if recent.is_empty(): _wrapped("目前沒有傳聞。")
	for item in recent:
		_wrapped("%s · 來源：%s · 轉述 %d 次"%[item.get("about",""),item.get("source",""),item.get("spreadCount",0)],12)
		_wrapped(str(item.get("content","")),16)
		if item.get("_mutated",false): _wrapped("這則傳聞曾被誇大。",12)
	var posts: Array=data.get("townFeed",{}).get("posts",[])
	_wrapped("鎮民動態",20)
	if posts.is_empty(): _wrapped("尚無動態。")
	var latest:=posts.slice(maxi(0,posts.size()-10))
	latest.reverse()
	for post in latest:
		_wrapped(str(post.get("authorName",""))+" · "+str(post.get("time","")),12)
		_wrapped(str(post.get("text","")))

func show_conversations() -> void:
	romance_page=false
	factions_page=false
	gossip_page=false
	conversation_page=true
	_clear_drawer()
	_wrapped("村民對話紀錄",22)
	_wrapped("本地規則對話，不使用 AI 額度。新對話會隨模擬時間產生。")
	_button("返回故事",drawer_body,func(): show_tab("故事",true))
	var logs: Array=_current_data().get("npcConversationLog",[])
	_wrapped("最近 %d 段／共 %d 段"%[mini(10,logs.size()),logs.size()])
	if logs.is_empty(): _wrapped("還沒有對話。按「開始」讓居民作息運行，稍後回來看看。")
	var recent:=logs.slice(maxi(0,logs.size()-10))
	recent.reverse()
	for conversation in recent:
		_wrapped(str(conversation.get("time","")),12)
		_wrapped(str(conversation.get("summary","")),16)
		for line in conversation.get("dialogue",[]):
			_wrapped(str(line.get("speaker",""))+"："+str(line.get("text","")))

func _wrapped(text: String,size := 14) -> Label:
	var item := _label(text,drawer_body,size)
	item.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	return item

func show_memories(id: String,target_id := "") -> void:
	selected_agent=id
	resident_page="memory"
	memory_target=target_id
	_clear_drawer()
	var data := _current_data()
	var agent: Dictionary=data.agents[id]
	var memory := SimMemory.new()
	memory.load_entries(agent.get("memory",[]))
	_wrapped(str(agent.get("name",id))+" · 記憶",22)
	_button("返回居民資料",drawer_body,func(): show_agent(id,false))
	var entries: Array
	if target_id.is_empty():
		entries=memory.recent(20)
		_wrapped("最近 %d 則／共 %d 則（由新到舊）" % [entries.size(),memory.entries.size()])
	else:
		var target_name := str(data.agents.get(target_id,{}).get("name",target_id))
		entries=memory.retrieve(target_name,[target_name],5,int(data.get("tickCount",0)))
		_wrapped("與「%s」相關的記憶檢索：按人物、內容、重要度與時間選出最多 5 則；可能包含背景記憶。" % target_name)
	entries.reverse()
	if entries.is_empty(): _wrapped("尚無記憶。")
	for entry in entries:
		_wrapped("%s · %s · 重要度 %s" % [str(entry.get("timeStr","")),{"mourning":"弔念","mischief":"惡作劇","witness":"目擊","discovery":"發現","arrival":"抵達","conversation":"交談","departure":"離開","family":"家庭","milestone":"里程碑","observation":"見聞","raid":"襲擊","reflection":"反思","relationship":"關係","social":"社交","whisper":"耳語"}.get(str(entry.get("category","")),"記憶"),str(int(entry.get("importance",5)))],12)
		_wrapped(str(entry.get("content","")))
	if not target_id.is_empty():
		_button("返回人際關係",drawer_body,func(): show_relationships(id))
	_button("返回居民資料",drawer_body,func(): show_agent(id,false))

func show_thoughts(id: String) -> void:
	selected_agent=id
	resident_page="thoughts"
	_clear_drawer()
	var data:=_current_data()
	var a: Dictionary=data.agents[id]
	var today:=SimClock.total_days(data.clock)
	_wrapped(str(a.name)+" · 目前想法",22)
	_wrapped("心情：%d"%int(a.get("mood",0)),18)
	_wrapped("此刻心聲",18)
	_wrapped(str(a.get("currentThought","")) if not str(a.get("currentThought","")).is_empty() else "暫時沒有新的心聲。")
	_wrapped("日常心聲是當下念頭，不直接改變心情或好感。",12)
	_wrapped("持續影響的想法",18)
	_button("返回居民資料",drawer_body,func(): show_agent(id,false))
	if a.get("isPlayer",false) or a.get("isDead",false):
		_wrapped("依目前規則，此角色不套用想法心情影響，也不執行每日清理與好感變化。")
	elif not simulation.thoughts_enabled:
		_wrapped("每日想法更新已關閉；到期清理與好感變化暫停。")
	else: _wrapped("想法的心情影響逐日淡化；針對某人的好感變化在換日時套用，直到想法到期。")
	var thoughts: Array=a.get("thoughts",[]) if a.get("thoughts") is Array else []
	if thoughts.is_empty(): _wrapped("目前沒有持續影響的想法。")
	for thought in thoughts:
		var remaining:=maxf(0,float(thought.get("days",0))-(today-float(thought.get("start",today))))
		_wrapped(str(thought.get("label",thought.get("kind","想法"))),18)
		_wrapped("剩餘 %s 天 · 當前心情影響 %+0.1f"%[str(int(remaining)) if remaining==floor(remaining) else str(snappedf(remaining,.1)),0.0 if a.get("isPlayer",false) or a.get("isDead",false) else SimThoughts.mood_effect(thought,today)])
		if remaining<=0: _wrapped("已到期；下次每日更新時清理。",12)
		var target: String=str(thought.get("targetId","")) if thought.get("targetId")!=null else ""
		var opinion:=float(thought.get("opinion",0))
		if not target.is_empty() and opinion!=0:
			var name: String=str(data.agents.get(target,{}).get("name",thought.get("targetName",target)))
			_wrapped("對「%s」的好感：每日 %+0.1f"%[name,opinion])
			if not a.get("relationships",{}).has(target): _wrapped("缺少這段關係，目前不套用好感變化。",12)

func show_relationships(id: String) -> void:
	selected_agent=id
	resident_page="relationships"
	_clear_drawer()
	var data := _current_data()
	var agent: Dictionary=data.agents[id]
	var manager := SimRelationships.new()
	manager.load_relationships(agent.get("relationships",{}))
	_wrapped(str(agent.get("name",id))+" · 人際關係",22)
	_button("返回居民資料",drawer_body,func(): show_agent(id,false))
	_wrapped("以下是這位居民對他人的感受，雙方數值可能不同。")
	if manager.relationships.is_empty(): _wrapped("尚無關係紀錄。")
	for target_id in manager.relationships:
		var relation: Dictionary=manager.relationships[target_id]
		var target_name := str(data.agents.get(target_id,{}).get("name",relation.get("targetName",target_id)))
		_wrapped(target_name+" · "+SimRelationships.relationship_type(relation),18)
		if relation.get("isFeud",false): _wrapped("已絕交",14)
		_wrapped("好感 %s · 信任 %s · 戀慕 %s\n互動 %s 次" % [str(snappedf(float(relation.get("affinity",0)),.1)),str(snappedf(float(relation.get("trust",0)),.1)),str(snappedf(float(relation.get("romanticInterest",0)),.1)),str(int(relation.get("interactionCount",0)))])
		if data.agents.has(target_id):
			_button("查看「%s」資料" % target_name,drawer_body,func(): show_agent(target_id))
			_button("檢索相關記憶",drawer_body,func(): show_memories(id,target_id))
	_button("返回居民資料",drawer_body,func(): show_agent(id,false))

func _line(placeholder: String, secret := false) -> LineEdit:
	var field := LineEdit.new()
	field.placeholder_text = placeholder
	field.secret = secret
	field.custom_minimum_size.y = 42
	drawer_body.add_child(field)
	return field

func _settings_ui() -> void:
	_button("居民環境感知："+("開啟" if simulation.perception_enabled else "關閉"),drawer_body,func(): simulation.perception_enabled=not simulation.perception_enabled; show_tab("設定",true))
	_button("居民足跡："+("開啟" if simulation.trace_enabled else "關閉"),drawer_body,func(): simulation.trace_enabled=not simulation.trace_enabled; show_tab("設定",true))
	_button("居民弔念："+("開啟" if simulation.mourning_enabled else "關閉"),drawer_body,func(): simulation.mourning_enabled=not simulation.mourning_enabled; show_tab("設定",true))
	_button("夜間惡作劇："+("開啟" if simulation.mischief_enabled else "關閉"),drawer_body,func(): simulation.mischief_enabled=not simulation.mischief_enabled; show_tab("設定",true))
	_button("觀星互動："+("開啟" if simulation.stargazing_enabled else "關閉"),drawer_body,func(): simulation.stargazing_enabled=not simulation.stargazing_enabled; show_tab("設定",true))
	_button("居民日常心聲："+("開啟" if simulation.inner_voice_enabled else "關閉"),drawer_body,func(): simulation.inner_voice_enabled=not simulation.inner_voice_enabled; show_tab("設定",true))
	_button("每日想法更新："+("開啟" if simulation.thoughts_enabled else "關閉"),drawer_body,func(): simulation.thoughts_enabled=not simulation.thoughts_enabled; show_tab("設定",true))
	_wrapped("想法更新控制到期清理與每日好感變化；心情影響仍隨時間淡化。")
	_button("居民派系："+("開啟" if simulation.factions_enabled else "關閉"),drawer_body,func(): simulation.factions_enabled=not simulation.factions_enabled; show_tab("設定",true))
	_button("每日仇怨事件："+("開啟" if simulation.feuds_enabled else "關閉"),drawer_body,func(): simulation.feuds_enabled=not simulation.feuds_enabled; show_tab("設定",true))
	_button("每日關係事件："+("開啟" if simulation.romance_enabled else "關閉"),drawer_body,func(): simulation.romance_enabled=not simulation.romance_enabled; show_tab("設定",true))
	_wrapped("關係在換日時判定；交往和結婚需要感情累積與機會。")
	_button("八卦傳播："+("開啟" if simulation.gossip_enabled else "關閉"),drawer_body,func(): simulation.gossip_enabled=not simulation.gossip_enabled; show_tab("設定",true))
	_wrapped("八卦需同時開啟 NPC 本地社交才會在聊天時傳播。")
	_button("NPC 本地社交："+("開啟" if simulation.social_enabled else "關閉"),drawer_body,func(): simulation.social_enabled=not simulation.social_enabled; show_tab("設定",true))
	var description := _label("使用網頁版帳號，讀取同一份小鎮。",drawer_body,14)
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if api.token.is_empty():
		var username := _line("帳號")
		var password := _line("密碼",true)
		_button("登入",drawer_body,func():
			if busy or username.text.is_empty() or password.text.is_empty(): return
			busy=true
			status.text="登入中…"
			var result := await api.login(username.text,password.text)
			if is_instance_valid(password): password.clear()
			busy=false
			status.text="登入成功" if result.ok else str(result.error)
			if result.ok: show_tab("設定",true))
	else:
		_button("讀取雲端城鎮列表",drawer_body,show_cloud_saves)
		_button("登出",drawer_body,func(): api.logout(); show_tab("設定",true))
	_button("繁體中文 / English",drawer_body,func():
		TranslationServer.set_locale("en" if TranslationServer.get_locale().begins_with("zh") else "zh_TW")
		show_tab("設定",true))
	var note := _label("本地社交會更新記憶、好感與戀慕；可匯出續玩。八卦可傳播並引發回應；AI 對話、建設及完整婚戀仍在後續階段。",drawer_body,14)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

func show_cloud_saves() -> void:
	if busy: return
	busy=true
	status.text="讀取城鎮列表…"
	var result := await api.saves()
	busy=false
	if not result.ok:
		status.text=str(result.error)
		return
	if not result.data is Array:
		status.text="城鎮列表格式不正確。"
		return
	_clear_drawer()
	_label("雲端城鎮",drawer_body,24)
	if result.data.is_empty(): _label("這個帳號還沒有雲端存檔。",drawer_body)
	for save_info in result.data:
		if not save_info is Dictionary or not save_info.get("town_id") is String: continue
		var town_id: String = save_info.town_id
		_button(str(save_info.get("town_name",town_id)),drawer_body,func(): load_cloud(town_id))
	status.text="已讀取 %d 個城鎮" % result.data.size()

func load_cloud(town_id: String) -> void:
	if busy: return
	busy=true
	status.text="下載存檔…"
	var result := await api.load_save(town_id)
	busy=false
	if not result.ok:
		status.text=str(result.error)
		return
	if not result.data is Dictionary or not result.data.get("save_data") is String:
		status.text="雲端存檔格式不正確。"
		return
	if _load_document(result.data.save_data,"雲端存檔"):
		drawer.hide()
		active_tab=""

func import_save() -> void:
	if OS.has_feature("web"):
		import_callback = JavaScriptBridge.create_callback(func(args): _load_document(str(args[0]),"本機存檔"))
		JavaScriptBridge.get_interface("window").rimtownImport = import_callback
		JavaScriptBridge.eval("const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{if(input.files[0] && input.files[0].size<=20971520)window.rimtownImport(await input.files[0].text());};input.click();",true)
	else:
		dialog.popup_centered_ratio(0.8)

func export_save() -> void:
	_write_export(document.serialize(),"rimtown-copy")

func progress_snapshot() -> Dictionary:
	var progress:=simulation.snapshot()
	progress._godot4a.motion=motion.positions.duplicate(true)
	progress._godot4a.house_map=motion.layout.agent_house.duplicate(true)
	progress._godot4a.tick_accumulator=tick_accumulator
	progress._godot4a.manual_player=motion.manual_player
	return progress

func export_progress() -> void:
	_write_export(JSON.stringify(progress_snapshot(),"",false,true),"rimtown-playtest")

func _write_export(text: String,prefix: String) -> void:
	if text.is_empty(): return
	if OS.has_feature("web"):
		JavaScriptBridge.download_buffer(text.to_utf8_buffer(),prefix+".json","application/json")
		status.text="已下載原始存檔副本。"
	else:
		var path := export_directory.path_join("%s-%d.json" % [prefix,Time.get_unix_time_from_system()])
		var file := FileAccess.open(path,FileAccess.WRITE)
		if file:
			file.store_string(text)
			status.text="副本已儲存於 " + ProjectSettings.globalize_path(path)
			status.tooltip_text=status.text
		else: status.text="無法寫入副本。"

func _capture_demo() -> void:
	await get_tree().create_timer(3).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/frontier-preview.png")
	if FileAccess.file_exists("res://tests/capture_matrix.flag"):
		load_demo("harbor")
		await get_tree().create_timer(1).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://docs/harbor-preview.png")
		var viewport := SubViewport.new()
		viewport.size = Vector2i(375,812)
		viewport.own_world_3d = true
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		add_child(viewport)
		var mobile: Node = load("res://scenes/main.tscn").instantiate()
		viewport.add_child(mobile)
		mobile.show_tab("小鎮",true)
		await get_tree().create_timer(1).timeout
		await RenderingServer.frame_post_draw
		viewport.get_texture().get_image().save_png("res://docs/mobile-preview.png")
		viewport.queue_free()
		load_demo("frontier")
		drawer.hide()
		active_tab = ""

func _resource_name(key: String) -> String:
	return tr({"food":"食物","wood":"木材","stone":"石材","metal":"金屬","cloth":"布料","herbs":"草藥","silver":"銀幣","meals":"餐食","tools":"工具","clothing":"衣物","medicine":"藥品","furniture":"家具","research_points":"研究","wheat":"小麥","cotton":"棉花","grapes":"葡萄","tea":"茶葉","sugarcane":"甘蔗","sugar":"砂糖","bread":"麵包","beer":"啤酒","wine":"葡萄酒","flowers":"花卉","plank":"木板","hardwood":"硬木","brick":"磚塊","marble":"大理石","steel":"鋼鐵","gold":"黃金","rice":"稻米","corn":"玉米","potato":"馬鈴薯","mushroom":"蘑菇","golden_wheat":"金色小麥","dragon_fruit":"火龍果","pastry":"糕點","perfume":"香水","fine_tea":"精品茶","herbal_tea":"草本茶","jam":"果醬","luxury_furniture":"高級家具"}.get(key,key))

func _job_name(key: String) -> String:
	return tr({"mayor":"鎮長","doctor":"醫生","blacksmith":"鐵匠","cook":"廚師","farmer":"農夫","trader":"商人","guard":"守衛","researcher":"研究員","miner":"礦工","priest":"牧師","carpenter":"木匠","tailor":"裁縫","null":"旅人"}.get(key,key))

func _current_data() -> Dictionary:
	return simulation.data if has_simulated else document.data

func toggle_simulation() -> void:
	var error:=simulation.validation_error()
	if not error.is_empty(): status.text=error; return
	running=not running
	play_button.text="Ⅱ 暫停" if running else "▶ 繼續"
	status.text="試玩中 · 作息與移動" if running else "已暫停 · 可匯出試玩進度"

func step_simulation() -> void:
	var error:=simulation.validation_error()
	if not error.is_empty(): status.text=error; return
	running=false
	play_button.text="▶ 繼續"
	_tick_simulation()
	motion.update(simulation.data.agents)
	world_view.animate_agents(motion.positions)
	status.text="已前進 15 分鐘 · 已暫停"

func _tick_simulation() -> void:
	has_simulated=true
	var events:=simulation.tick()
	var clock_data: Dictionary=simulation.data.clock
	summary.text="%s %d日 %02d:%02d · %d人"%[clock_data.season,clock_data.day,clock_data.hour,clock_data.minute,simulation.data.agents.size()]
	if "new_season" in events:
		var house_map:=motion.layout.agent_house.duplicate(true)
		world_view.display_save(simulation.data)
		motion.layout=world_view.layout
		motion.layout.agent_house=house_map
		motion.pathfinder.grid=world_view.layout.grid
	for event in simulation.presentation_events: world_view.dispute_bubbles.show_dispute(event.a,event.b)
	world_view._light_clock(clock_data)
	if "new_hour" in events: world_view._weather(simulation.data)
	if active_tab=="故事":
		if factions_page: show_factions()
		elif romance_page: show_romance()
		elif gossip_page: show_gossip()
		elif conversation_page: show_conversations()
		else: show_tab("故事",true)
	if active_tab=="居民" and not selected_agent.is_empty():
		match resident_page:
			"chat": pass # Preserve draft, focus and scroll while the world ticks.
			"interaction": show_player_interaction(selected_agent)
			"trace": show_trace(selected_agent)
			"thoughts": show_thoughts(selected_agent)
			"memory": show_memories(selected_agent,memory_target)
			"relationships": show_relationships(selected_agent)
			_: show_agent(selected_agent,false)

func _process(delta: float) -> void:
	_process_traveler(delta)
	if not running: return
	frame_accumulator+=minf(delta,.25)*speed
	while frame_accumulator>=1.0/60:
		frame_accumulator-=1.0/60
		tick_accumulator+=1.0/60
		if tick_accumulator>=2.0-0.000001:
			tick_accumulator-=2.0
			_tick_simulation()
		motion.update(simulation.data.agents)
	world_view.animate_agents(motion.positions)

func _activity_name(activity: String) -> String:
	return {"idle":"休息","sleeping":"睡覺","eating":"進食","working":"工作","socializing":"社交","wandering":"閒逛","recreation":"娛樂","stargazing":"看星星","night_stroll":"夜間散步","night_mischief":"夜間惡作劇","mourning":"弔念","commuting":"前往工作","heading_home":"回家"}.get(activity,activity)

func _capture_playtest() -> void:
	await get_tree().create_timer(1).timeout
	speed=4
	speed_button.text="4×"
	toggle_simulation()
	await get_tree().create_timer(4).timeout
	toggle_simulation()
	show_tab("居民",true)
	show_agent(str(simulation.data.agents.keys()[0]),false)
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/playtest-desktop.png")
	var viewport:=SubViewport.new()
	viewport.size=Vector2i(375,812)
	viewport.own_world_3d=true
	viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	var mobile: Node=load("res://scenes/main.tscn").instantiate()
	viewport.add_child(mobile)
	mobile.step_simulation()
	mobile.show_tab("小鎮",true)
	await get_tree().create_timer(1).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/playtest-mobile.png")
	viewport.queue_free()
	print("PLAYTEST_RENDER_CAPTURE_OK ticks=",simulation.data.tickCount)

func focus_traveler() -> void:
	if not motion.positions.has("player"):
		status.text="這份存檔沒有旅人。"
		return
	var p: Dictionary=motion.positions.player
	rig.follow_player=true
	rig.position=Vector3(float(p.x)/16,0,float(p.y)/16)
	status.text="WASD／方向鍵移動 · F 與附近居民互動"

func _process_traveler(delta: float) -> void:
	if traveler==null or not motion.positions.has("player"): return
	var input:=traveler.direction()
	# Screen-relative movement remains intuitive after each 90-degree camera rotation.
	var world_direction:=rig.global_transform.basis.x*input.x+rig.global_transform.basis.z*input.y
	var moved:=motion.move_player(Vector2(world_direction.x,world_direction.z),delta)
	if not input.is_zero_approx(): rig.follow_player=true
	if moved:
		has_simulated=true
		var p: Dictionary=motion.positions.player
		var location:=motion.location_at(Vector2(p.x,p.y))
		if not location.is_empty(): simulation.data.agents.player.currentLocation=location
		simulation.data.agents.player.activity="wandering"
	if motion.manual_player: world_view.animate_agents(motion.positions)
	var player: Dictionary=motion.positions.player
	rig.follow_position(Vector3(float(player.x)/16,0,float(player.y)/16),delta)

func _capture_traveler() -> void:
	await get_tree().create_timer(1).timeout
	focus_traveler()
	rig.zoom_by(.6)
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/traveler-preview.png")
	print("TRAVELER_RENDER_CAPTURE_OK")

func _capture_social() -> void:
	await get_tree().create_timer(1).timeout
	_load_document(FileAccess.get_file_as_string("res://tests/golden/frontier-day-07.json"),"記憶與關係展示")
	show_tab("居民",true)
	show_relationships(str(simulation.data.agents.keys()[0]))
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/social-desktop.png")
	var viewport:=SubViewport.new()
	viewport.size=Vector2i(375,812)
	viewport.own_world_3d=true
	viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate()
	viewport.add_child(mobile)
	mobile._load_document(FileAccess.get_file_as_string("res://tests/golden/frontier-day-07.json"),"記憶與關係展示")
	mobile.show_tab("居民",true)
	mobile.show_memories(str(mobile.simulation.data.agents.keys()[0]))
	await get_tree().create_timer(1).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/social-mobile.png")
	viewport.queue_free()

func _capture_npc() -> void:
	await get_tree().create_timer(1).timeout
	_load_document(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json"),"本地社交展示")
	for i in 96: _tick_simulation()
	show_tab("故事",true)
	show_conversations()
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/npc-desktop.png")
	var viewport:=SubViewport.new()
	viewport.size=Vector2i(375,812)
	viewport.own_world_3d=true
	viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate()
	viewport.add_child(mobile)
	mobile._load_document(JSON.stringify(progress_snapshot(),"",false,true),"本地社交展示")
	mobile.show_tab("故事",true)
	mobile.show_conversations()
	await get_tree().create_timer(1).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/npc-mobile.png")
	viewport.queue_free()

func _capture_gossip() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/gossip/compatibility-save.json.tmp")
	_load_document(example,"八卦對質測試情境")
	show_tab("故事",true)
	show_gossip()
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/gossip-desktop.png")
	var viewport:=SubViewport.new()
	viewport.size=Vector2i(375,812)
	viewport.own_world_3d=true
	viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate()
	viewport.add_child(mobile)
	mobile._load_document(example,"八卦對質測試情境")
	mobile.show_tab("故事",true)
	mobile.show_gossip()
	await get_tree().create_timer(1).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/gossip-mobile.png")
	viewport.queue_free()

func _capture_romance() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/romance/compatibility-save.json.tmp")
	_load_document(example,"婚禮測試情境")
	show_tab("故事",true)
	show_romance()
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/romance-desktop.png")
	var viewport:=SubViewport.new()
	viewport.size=Vector2i(375,812)
	viewport.own_world_3d=true
	viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate()
	viewport.add_child(mobile)
	mobile._load_document(example,"婚禮測試情境")
	mobile.show_tab("故事",true)
	mobile.show_romance()
	await get_tree().create_timer(1).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/romance-mobile.png")
	viewport.queue_free()

func _capture_feuds() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/feuds/compatibility-save.json.tmp")
	_load_document(example,"仇怨測試情境")
	show_tab("故事",true)
	show_romance()
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/feuds-desktop.png")
	var viewport:=SubViewport.new()
	viewport.size=Vector2i(375,812)
	viewport.own_world_3d=true
	viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate()
	viewport.add_child(mobile)
	mobile._load_document(example,"仇怨測試情境")
	mobile.show_tab("故事",true)
	mobile.show_romance()
	await get_tree().create_timer(1).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/feuds-mobile.png")
	viewport.queue_free()

func _prepare_dispute_preview() -> void:
	simulation.social_enabled=false;simulation.romance_enabled=false;simulation.factions_enabled=false;simulation.feuds_enabled=true
	for a in simulation.data.agents.values(): a.relationships={}
	SimSocial.relationship(simulation.data.agents.chen_wei,simulation.data.agents.lin_mei).affinity=-35
	SimSocial.relationship(simulation.data.agents.lin_mei,simulation.data.agents.chen_wei).affinity=-35
	simulation.data.feudCooldown={};simulation.data.clock.hour=23;simulation.data.clock.minute=45;simulation.rng.state=11456
	_tick_simulation()
	drawer.hide();active_tab=""
	rig.position=Vector3(40,1.5,30);rig.width=18;rig._sync()
	world_view.actors.chen_wei.position=Vector3(39,.16,30)
	world_view.actors.lin_mei.position=Vector3(41,.16,30)
	world_view.dispute_bubbles._process(0)
	status.text="爭吵對話框測試 · 固定站位"
func _capture_factions() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/factions/compatibility-save.json.tmp")
	_load_document(example,"派系測試情境")
	show_tab("故事",true);show_factions()
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/factions-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile._load_document(example,"派系測試情境");mobile.show_tab("故事",true);mobile.show_factions()
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/factions-mobile.png")
	_prepare_dispute_preview();mobile._prepare_dispute_preview()
	await get_tree().create_timer(.3).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/dispute-desktop.png")
	viewport.get_texture().get_image().save_png("res://docs/dispute-mobile.png")
	viewport.queue_free()

func _capture_thoughts() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/thoughts/compatibility-save.json.tmp")
	_load_document(example,"想法效果測試情境")
	show_tab("居民",true);show_thoughts("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/thoughts-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile._load_document(example,"想法效果測試情境");mobile.show_tab("居民",true);mobile.show_thoughts("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/thoughts-mobile.png")
	viewport.queue_free()

func _capture_inner_voice() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/inner_voice/compatibility-save.json.tmp")
	_load_document(example,"居民心聲測試情境")
	show_tab("居民",true);show_thoughts("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/inner-voice-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile._load_document(example,"居民心聲測試情境");mobile.show_tab("居民",true);mobile.show_thoughts("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/inner-voice-mobile.png")
	viewport.queue_free()

func _capture_stargazing() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/stargazing/compatibility-save.json.tmp")
	_load_document(example,"觀星發現測試情境")
	show_tab("居民",true);show_memories("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/stargazing-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile._load_document(example,"觀星發現測試情境");mobile.show_tab("居民",true);mobile.show_memories("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/stargazing-mobile.png")
	viewport.queue_free()

func _capture_mischief() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/mischief/compatibility-save.json.tmp")
	_load_document(example,"惡作劇目擊測試情境")
	show_tab("居民",true);show_memories("lin_mei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/mischief-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile._load_document(example,"惡作劇目擊測試情境");mobile.show_tab("居民",true);mobile.show_memories("lin_mei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/mischief-mobile.png")
	viewport.queue_free()

func _capture_mourning() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/mourning/compatibility-save.json.tmp")
	_load_document(example,"居民弔念測試情境")
	show_tab("居民",true);show_memories("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/mourning-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile._load_document(example,"居民弔念測試情境");mobile.show_tab("居民",true);mobile.show_memories("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/mourning-mobile.png")
	viewport.queue_free()

func show_trace(id: String) -> void:
	selected_agent=id;resident_page="trace";_clear_drawer()
	var data:=_current_data();var a: Dictionary=data.agents[id]
	_wrapped(str(a.name)+" · 今日足跡",22)
	_button("返回居民資料",drawer_body,func(): show_agent(id,false))
	if not simulation.trace_enabled: _wrapped("足跡記錄已暫停。")
	var entries: Array=a.get("todayTrace",[]) if a.get("_traceDay","")==SimTrace.day_key(data.clock) else []
	if entries.is_empty(): _wrapped("今天尚無足跡；開始模擬後會記錄居民活動。")
	else: _wrapped("今日 %d 筆（由早到晚，最多保留 160 筆）"%entries.size())
	for entry in entries:
		var location: Dictionary=data.get("townMap",{}).get("locations",{}).get(str(entry.loc),{})
		_wrapped("%02d:%02d · %s"%[int(entry.m)/60,int(entry.m)%60,str(entry.text)],18)
		_wrapped(str(location.get("name",entry.loc)))

func _capture_trace() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/trace/compatibility-save.json.tmp")
	_load_document(example,"居民足跡試玩情境")
	show_tab("居民",true);show_trace("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/trace-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile._load_document(example,"居民足跡試玩情境");mobile.show_tab("居民",true);mobile.show_trace("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/trace-mobile.png")
	viewport.queue_free()

func _capture_perception() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/perception/compatibility-save.json.tmp")
	_load_document(example,"居民見聞測試情境")
	show_tab("居民",true);show_memories("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/perception-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile._load_document(example,"居民見聞測試情境");mobile.show_tab("居民",true);mobile.show_memories("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/perception-mobile.png")
	viewport.queue_free()

func interact_nearby() -> void:
	var id:=SimPlayerInteraction.nearby(motion.positions,simulation.data.agents)
	if id.is_empty(): status.text="附近沒有居民；走近居民後按 F。";return
	show_tab("居民",true);show_player_interaction(id)
func show_player_interaction(id: String) -> void:
	selected_agent=id;resident_page="interaction";_clear_drawer()
	if not simulation.data.agents.has(id): _wrapped("這位居民已離開。");return
	var a: Dictionary=simulation.data.agents[id]
	_wrapped("與"+str(a.name)+"互動",22)
	_wrapped("走近居民後按 F，也可從居民資料開啟。")
	if not SimPlayerInteraction.in_range(id,motion.positions,simulation.data.agents):
		_wrapped("距離太遠，請先走近這位居民。")
	else:
		_wrapped("安慰：增加社交需求 15、對你好感 2，並留下愉快的聊天想法。")
		_button("安慰他",drawer_body,func(): comfort_resident(id))
	_button("自由交談",drawer_body,func(): show_player_chat(id))
	_button("返回居民資料",drawer_body,func(): show_agent(id,false))
func comfort_resident(id: String) -> void:
	if not SimPlayerInteraction.in_range(id,motion.positions,simulation.data.agents):
		show_player_interaction(id);status.text="距離已改變，請走近後再互動。";return
	SimPlayerInteraction.comfort(simulation.data.agents[id],simulation)
	has_simulated=true
	show_player_interaction(id)
	_wrapped(str(simulation.data.agents[id].name)+"覺得被支持了。")
	status.text="安慰完成 · 好感 +2"

func _capture_player_interaction() -> void:
	await get_tree().create_timer(1).timeout
	var p: Dictionary=motion.positions.chen_wei
	motion.positions.player.x=float(p.x)+16;motion.positions.player.y=p.y
	world_view.animate_agents(motion.positions)
	show_tab("居民",true);show_player_interaction("chen_wei");comfort_resident("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/player-interaction-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile.motion.positions.player.x=float(mobile.motion.positions.chen_wei.x)+16;mobile.motion.positions.player.y=mobile.motion.positions.chen_wei.y
	mobile.show_tab("居民",true);mobile.show_player_interaction("chen_wei");mobile.comfort_resident("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/player-interaction-mobile.png")
	viewport.queue_free()

func show_player_chat(id: String) -> void:
	selected_agent=id;resident_page="chat";_clear_drawer()
	if not simulation.data.agents.has(id) or not simulation.data.agents.has("player") or id=="player": _wrapped("找不到交談對象。");return
	var a: Dictionary=simulation.data.agents[id]
	_wrapped("與"+str(a.name)+"交談",22)
	var mode:=CheckButton.new();mode.text="離線交談（本機台詞）";mode.button_pressed=chat_offline;mode.disabled=chat_busy;mode.custom_minimum_size.y=42;drawer_body.add_child(mode)
	mode.toggled.connect(func(value): chat_offline=value;show_player_chat(id))
	_wrapped("目前使用本機預寫台詞，不連線、不使用 AI 額度。" if chat_offline else "傳送會使用既有 AI 服務與帳號／訪客額度。",12)
	var history: Array=simulation.data.agents.player.get("chatHistory",[]).filter(func(m): return m.speaker==a.name or m.target==a.name)
	if history.is_empty(): _wrapped("還沒有對話，說聲你好吧。")
	for entry in history.slice(maxi(0,history.size()-20)):
		_wrapped(str(entry.speaker)+("（離線台詞）：" if entry.get("_godotOffline",false) else "：")+str(entry.text))
	if chat_notice.has(id): _wrapped(chat_notice[id])
	if chat_busy: _wrapped("等待回覆中…")
	var input:=LineEdit.new();input.placeholder_text="想對他說什麼？";input.max_length=1200;input.editable=not chat_busy;input.text=str(chat_drafts.get(id,""));input.custom_minimum_size.y=42;drawer_body.add_child(input)
	input.text_changed.connect(func(value): chat_drafts[id]=value)
	input.text_submitted.connect(func(value): send_player_chat(id,value))
	var send:=_button("傳送",drawer_body,func(): send_player_chat(id,str(chat_drafts.get(id,""))))
	send.disabled=chat_busy
	_wrapped("交談意圖：選擇後立即傳送，成功回覆後套用額外影響。威脅會降低信任；委託目前只記錄承諾。",12)
	for key in SimPlayerInteraction.INTENTS:
		var option: Array=SimPlayerInteraction.INTENTS[key]
		var intent_button:=_button(option[0],drawer_body,func(): send_player_chat(id,option[1],key))
		intent_button.disabled=chat_busy
	_button("返回互動",drawer_body,func(): show_player_interaction(id))
func send_player_chat(id: String,message: String,intent: String="") -> void:
	if not intent.is_empty() and not SimPlayerInteraction.INTENTS.has(intent): return
	message=message.strip_edges()
	if chat_busy or message.is_empty(): return
	if message.length()>1200: chat_notice[id]="訊息請控制在 1200 字內。";show_player_chat(id);return
	if not simulation.data.agents.has("player") or not simulation.data.agents.has(id) or id=="player" or simulation.data.agents[id].get("isDead",false): return
	if chat_offline:
		var local_result:=SimPlayerOffline.apply(simulation,id,message)
		simulation.data.agents.player.chatHistory.back()["_godotOffline"]=true
		has_simulated=true;chat_drafts.erase(id)
		chat_notice[id]="離線交談完成 · 好感 %+.0f · 戀慕 %+.0f"%[local_result.affinity,local_result.romantic]
		if not intent.is_empty(): chat_notice[id]+="\n意圖效果："+SimPlayerInteraction.apply_intent(simulation.data.agents[id],simulation,intent)
		show_player_chat(id);return
	chat_drafts[id]=message;chat_notice.erase(id);chat_busy=true
	var epoch:=chat_epoch
	var target: Dictionary=simulation.data.agents[id]
	var prompt:=SimPlayerChat.prompt(simulation,id,message)
	show_player_chat(id)
	var response: Dictionary
	if chat_transport.is_valid(): response=await chat_transport.call(prompt)
	else: response=await api.chat(prompt,"chat",600,.9,"zh")
	if epoch!=chat_epoch: return
	chat_busy=false
	if not simulation.data.agents.has(id) or not is_same(simulation.data.agents[id],target) or target.get("isDead",false):
		chat_notice[id]="對方已離開，回覆未套用。"
	elif not response.get("ok",false): chat_notice[id]=str(response.get("error","連線失敗，請重試。"))+"\n草稿已保留，也可切換離線交談後重試。"
	elif not response.get("data") is Dictionary or not response.data.get("reply") is String:
		chat_notice[id]="伺服器回覆格式不正確，未套用變化。"
	else:
		var parsed:=SimPlayerChat.parse(response.data.reply)
		if not parsed.ok: chat_notice[id]=parsed.error
		else:
			var result:=SimPlayerChat.apply(simulation,id,message,parsed)
			has_simulated=true
			if chat_drafts.get(id,"")==message: chat_drafts.erase(id)
			chat_notice[id]="交談完成 · 好感 %+.0f · 戀慕 %+.0f"%[result.affinity,result.romantic]
			if not intent.is_empty(): chat_notice[id]+="\n意圖效果："+SimPlayerInteraction.apply_intent(target,simulation,intent)
	if active_tab=="居民" and resident_page=="chat" and selected_agent==id: show_player_chat(id)

func _capture_player_chat() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/player_chat/compatibility-save.json.tmp")
	_load_document(example,"模擬 API 對話驗證")
	show_tab("居民",true);show_player_chat("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/player-chat-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile._load_document(example,"模擬 API 對話驗證");mobile.show_tab("居民",true);mobile.show_player_chat("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/player-chat-mobile.png")
	viewport.queue_free()

func _capture_player_intents() -> void:
	await get_tree().create_timer(1).timeout
	var example:=document.serialize()
	_load_document(example,"交談意圖介面驗證")
	show_tab("居民",true);show_player_chat("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/player-intents-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile._load_document(example,"交談意圖介面驗證");mobile.show_tab("居民",true);mobile.show_player_chat("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/player-intents-mobile.png")
	viewport.queue_free()

func _capture_player_offline() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/player_offline/compatibility-save.json.tmp")
	chat_offline=true
	_load_document(example,"離線交談驗證")
	show_tab("居民",true);show_player_chat("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/player-offline-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile.chat_offline=true;mobile._load_document(example,"離線交談驗證");mobile.show_tab("居民",true);mobile.show_player_chat("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/player-offline-mobile.png")
	viewport.queue_free()

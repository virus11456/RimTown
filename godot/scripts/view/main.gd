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
var placement_preview: MeshInstance3D
var running := false
var has_simulated := false
var speed := 1
var frame_accumulator := 0.0
var tick_accumulator := 0.0
var playback: HBoxContainer
var play_button: Button
var speed_button: Button
var selected_agent := ""
var whisper_drafts: Dictionary={}
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
	if DisplayServer.get_name() != "headless" and get_viewport()==get_tree().root and FileAccess.file_exists("res://tests/capture_sites.flag"): _capture_sites()
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
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_player_whisper.flag"): _capture_player_whisper()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_player_rumor.flag"): _capture_player_rumor()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_player_gift.flag"): _capture_player_gift()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_stockpile.flag"): _capture_stockpile()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_economy.flag"): _capture_economy()
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and (FileAccess.file_exists("res://tests/capture_progress.flag") or FileAccess.file_exists("res://tests/capture_industry.flag") or FileAccess.file_exists("res://tests/capture_farm.flag") or FileAccess.file_exists("res://tests/capture_processing.flag")): _capture_progress()
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
	_button("收起面板 ×",outer,func(): _clear_site_preview();drawer.hide(); active_tab="")
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
	_clear_site_preview()
	var incoming := SaveDocument.new()
	if not incoming.parse(text):
		status.text = incoming.error
		return false
	chat_epoch+=1;chat_busy=false;chat_drafts.clear();chat_notice.clear();whisper_drafts.clear()
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
	simulation.economy_enabled=bool(document.data.get("_godot4a",{}).get("economy_enabled",true))
	simulation.buildings_enabled=bool(document.data.get("_godot4a",{}).get("buildings_enabled",true))
	simulation.trade_enabled=bool(document.data.get("_godot4a",{}).get("trade_enabled",true))
	simulation.research_enabled=bool(document.data.get("_godot4a",{}).get("research_enabled",true))
	simulation.supply_enabled=bool(document.data.get("_godot4a",{}).get("supply_enabled",true))
	simulation.processing_enabled=bool(document.data.get("_godot4a",{}).get("processing_enabled",true))
	simulation.farm_enabled=bool(document.data.get("_godot4a",{}).get("farm_enabled",true))
	simulation.industry_enabled=bool(document.data.get("_godot4a",{}).get("industry_enabled",true))
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
	_clear_site_preview()
	for child in drawer_body.get_children():
		drawer_body.remove_child(child)
		child.queue_free()

func show_tab(tab: String, refresh := false) -> void:
	_clear_site_preview()
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
			_button("公共庫存與收支",drawer_body,show_stockpile)
			_button("建築工程",drawer_body,show_buildings)
			_button("商人交易",drawer_body,show_trade)
			_button("研究",drawer_body,show_research)
			_button("產業",drawer_body,show_industry)
			_button("農田",drawer_body,show_farm)
			_button("加工",drawer_body,show_processing)
			_wrapped("試玩：作息、移動與居民互動已啟用。\n送禮會消耗公共庫存；每日經濟可在設定開關。建築、交易、研究、產業、農田與加工已啟用；任務仍待完成。",13)
			var resources: Dictionary = _current_data().get("stockpile",{}).get("resources",{})
			for key in resources:
				if float(resources[key]) != 0: _label("%s   %s" % [_resource_name(key),str(resources[key])],drawer_body)
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
	_button("試玩原料補給："+("開啟" if simulation.relief_enabled else "關閉"),drawer_body,func(): simulation.relief_enabled=not simulation.relief_enabled;has_simulated=true;show_tab("設定",true))
	_wrapped("開啟時每天將木材、石材、金屬、布料與草藥補至 40；關閉後需依靠採集、產業、收成或交易。",12)
	_button("廚房使用主食作物："+("開啟" if simulation.kitchen_crops_enabled else "關閉"),drawer_body,func(): simulation.kitchen_crops_enabled=not simulation.kitchen_crops_enabled;has_simulated=true;show_tab("設定",true))
	_wrapped("食材不足時，可使用公共庫存的馬鈴薯、稻米、玉米、小麥、蘑菇；若要留給加工或交易可關閉。",12)
	_button("每日加工營運："+("開啟" if simulation.processing_enabled else "關閉"),drawer_body,func(): simulation.processing_enabled=not simulation.processing_enabled;show_tab("設定",true))
	_button("每日農田生長："+("開啟" if simulation.farm_enabled else "關閉"),drawer_body,func(): simulation.farm_enabled=not simulation.farm_enabled;show_tab("設定",true))
	_button("每日產業產出："+("開啟" if simulation.industry_enabled else "關閉"),drawer_body,func(): simulation.industry_enabled=not simulation.industry_enabled;show_tab("設定",true))
	_button("每日研究："+("開啟" if simulation.research_enabled else "關閉"),drawer_body,func(): simulation.research_enabled=not simulation.research_enabled;show_tab("設定",true))
	_button("商人每日來訪："+("開啟" if simulation.trade_enabled else "關閉"),drawer_body,func(): simulation.trade_enabled=not simulation.trade_enabled;show_tab("設定",true))
	_button("每日建築施工："+("開啟" if simulation.buildings_enabled else "關閉"),drawer_body,func(): simulation.buildings_enabled=not simulation.buildings_enabled;show_tab("設定",true))
	_button("每日生產與消耗："+("開啟" if simulation.economy_enabled else "關閉"),drawer_body,func(): simulation.economy_enabled=not simulation.economy_enabled; show_tab("設定",true))
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
	var old_geometry:=JSON.stringify([simulation.data.buildings,simulation.data.processing])
	var events:=simulation.tick()
	var clock_data: Dictionary=simulation.data.clock
	summary.text="%s %d日 %02d:%02d · %d人"%[clock_data.season,clock_data.day,clock_data.hour,clock_data.minute,simulation.data.agents.size()]
	if "new_season" in events or old_geometry!=JSON.stringify([simulation.data.buildings,simulation.data.processing]):
		_refresh_building_world()
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
			"chat", "whisper", "rumor": pass # Preserve draft, focus and scroll while the world ticks.
			"gift": show_player_gift(selected_agent)
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
	_button("耳語",drawer_body,func(): show_player_whisper(id))
	_button("偷偷爆料",drawer_body,func(): show_player_rumor(id))
	_button("送禮",drawer_body,func(): show_player_gift(id))
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
	elif active_tab=="居民" and resident_page=="whisper": show_player_whisper(selected_agent)

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

func show_player_whisper(id: String) -> void:
	selected_agent=id;resident_page="whisper";_clear_drawer()
	if not simulation.data.agents.has(id) or id=="player" or simulation.data.agents[id].get("isDead",false): _wrapped("這位居民已離開。");return
	_wrapped("向"+str(simulation.data.agents[id].name)+"耳語",22)
	_wrapped("把一句話留在他的內心記憶。現在使用本機原文，不連線、不耗 AI 額度。")
	_wrapped("提到居民姓名會建立記憶關聯；本機耳語不直接加減好感，也還不會立即改變行程。",12)
	var input:=LineEdit.new();input.max_length=1200;input.placeholder_text="想讓他記住什麼？";input.text=str(whisper_drafts.get(id,""));input.custom_minimum_size.y=42;drawer_body.add_child(input)
	input.text_changed.connect(func(value): whisper_drafts[id]=value)
	input.text_submitted.connect(func(value): send_player_whisper(id,value))
	var send:=_button("留下耳語",drawer_body,func(): send_player_whisper(id,str(whisper_drafts.get(id,""))))
	send.disabled=chat_busy;input.editable=not chat_busy
	if chat_busy: _wrapped("請先等待目前的交談完成。")
	_button("查看耳語記憶",drawer_body,func(): show_memories(id))
	_button("返回互動",drawer_body,func(): show_player_interaction(id))
func send_player_whisper(id: String,text: String) -> void:
	text=text.strip_edges()
	if chat_busy or text.is_empty() or text.length()>1200: return
	if not simulation.data.agents.has("player") or not simulation.data.agents.has(id) or id=="player" or simulation.data.agents[id].get("isDead",false): return
	SimPlayerWhisper.apply(simulation,id,text)
	simulation.data.agents.player.chatHistory.back()["_godotOffline"]=true
	whisper_drafts.erase(id);has_simulated=true
	show_player_whisper(id);_wrapped("已留下耳語："+text)
	status.text="耳語已存入居民記憶"

func _capture_player_whisper() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/player_whisper/compatibility-save.json.tmp")
	chat_offline=true
	_load_document(example,"耳語互動驗證")
	show_tab("居民",true);show_player_whisper("chen_wei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/player-whisper-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile.chat_offline=true;mobile._load_document(example,"耳語互動驗證");mobile.show_tab("居民",true);mobile.show_player_whisper("chen_wei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/player-whisper-mobile.png")
	viewport.queue_free()

func show_player_rumor(id: String,about_id: String="") -> void:
	selected_agent=id;resident_page="rumor";_clear_drawer()
	if not simulation.data.agents.has(id): _wrapped("這位居民已離開。");return
	_wrapped("偷偷向"+str(simulation.data.agents[id].name)+"爆料",22)
	_wrapped("每天限一次，不需連線。消息可能傳回當事人耳裡，影響他對你的看法。",12)
	if not SimPlayerRumor.available(simulation): _wrapped("今天已經爆過料了，明天再來。")
	elif about_id.is_empty():
		_wrapped("要談論誰？")
		var candidates:=SimPlayerRumor.candidates(simulation,id)
		if candidates.is_empty(): _wrapped("目前沒有其他居民。")
		for a in candidates: _button(str(a.name),drawer_body,func(): show_player_rumor(id,a.id))
	elif simulation.data.agents.has(about_id):
		_wrapped("關於"+str(simulation.data.agents[about_id].name)+"…")
		_wrapped("亂點鴛鴦會隨機選一位其他單身居民，並不代表兩人會開始交往。",12)
		for tone in SimPlayerRumor.TONES: _button(SimPlayerRumor.TONES[tone],drawer_body,func(): send_player_rumor(id,about_id,tone))
		_button("重選對象",drawer_body,func(): show_player_rumor(id))
	_button("返回互動",drawer_body,func(): show_player_interaction(id))
func send_player_rumor(id: String,about_id: String,tone: String) -> void:
	var result:=SimPlayerRumor.send(simulation,id,about_id,tone)
	show_player_rumor(id)
	if not result.ok: _wrapped(result.error);return
	has_simulated=true;_wrapped("你偷偷說："+result.content);_wrapped(result.reaction)
	status.text="消息已進入八卦網路 · 聽眾好感 %+.0f"%result.affinity

func _capture_player_rumor() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/player_rumor/compatibility-save.json.tmp")
	chat_offline=true
	_load_document(example,"八卦爆料驗證")
	simulation.data._godot4a.erase("last_rumor_day");show_tab("居民",true);show_player_rumor("chen_wei","lin_mei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/player-rumor-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile.chat_offline=true;mobile._load_document(example,"八卦爆料驗證");mobile.simulation.data._godot4a.erase("last_rumor_day");mobile.show_tab("居民",true);mobile.show_player_rumor("chen_wei","lin_mei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/player-rumor-mobile.png")
	viewport.queue_free()

func show_player_gift(id: String) -> void:
	selected_agent=id;resident_page="gift";_clear_drawer()
	if not simulation.data.agents.has(id): _wrapped("這位居民已離開。");return
	_wrapped("送禮給"+str(simulation.data.agents[id].name),22)
	_wrapped("花費來自小鎮公共庫存。每位居民每天一次，點選禮物後立即送出。",12)
	if not SimPlayerGift.available(simulation,id): _wrapped("今天已經送過了，明天再來。")
	for key in SimPlayerGift.GIFTS:
		var gift: Dictionary=SimPlayerGift.GIFTS[key];var have:=SimPlayerGift.stock(simulation,key)
		_wrapped(str(gift.name)+(" ★ 最愛" if SimPlayerGift.favorite(simulation.data.agents[id])==key else ""))
		var button:=_button("送出 · 花費 %d／庫存 %d"%[gift.cost,floori(have)],drawer_body,func(): send_player_gift(id,key))
		button.disabled=have<float(gift.cost) or not SimPlayerGift.available(simulation,id)
	_button("返回互動",drawer_body,func(): show_player_interaction(id))
func send_player_gift(id: String,key: String) -> void:
	var result:=SimPlayerGift.send(simulation,id,key)
	show_player_gift(id)
	if not result.ok: _wrapped(result.error);return
	has_simulated=true;_wrapped(result.reply);status.text="送禮完成 · 好感 +%d"%result.gain

func _capture_player_gift() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/player_gift/compatibility-save.json.tmp")
	chat_offline=true
	_load_document(example,"送禮介面驗證")
	show_tab("居民",true);show_player_gift("lin_mei")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/player-gift-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile.chat_offline=true;mobile._load_document(example,"送禮介面驗證");mobile.show_tab("居民",true);mobile.show_player_gift("lin_mei")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/player-gift-mobile.png")
	viewport.queue_free()

func show_stockpile(resource: String="",show_zero: bool=false) -> void:
	active_tab="小鎮";drawer.show();_clear_drawer()
	_wrapped("公共庫存與收支",22)
	_button("加工排班",drawer_body,show_work_policy)
	_wrapped("送禮從這裡扣除；每日生產與消耗在午夜結算，可於設定開關。農田收成直接入庫，工廠成品需先從加工頁領取。",12)
	if simulation.supply_enabled: _wrapped("公共廚房依人口備餐，1 食材製成 1.5 餐食；設定允許時，食材不足會改用主食作物。缺料、身體無法工作或排班休工就停煮。其他居民也會在缺料時停工，不會憑空產出商品。自動生產依全鎮存量補貨；餐食備約 3 天，建材至少可支付一項高階工程並留餘量。已持有物資不會因目標下調被刪除。",12)
	if simulation.supply_enabled: _wrapped("城鎮基本補助只補到 %.0f 銀；出售與訂單收入不受此門檻限制。"%SimEconomy.passive_target(simulation),12)
	if simulation.supply_enabled: _wrapped("原料來源："+("試玩補給開啟，每日部分原料補至 40。" if simulation.relief_enabled else "自給模式，沒有每日原料補給。")+"可在設定切換。",12)
	var stockpile: Dictionary=_current_data().get("stockpile",{})
	var resources: Dictionary=stockpile.get("resources",{})
	var history: Array=stockpile.get("history",[])
	var keys: Array=resources.keys()
	for entry in history:
		if not keys.has(str(entry.get("resource",""))): keys.append(str(entry.get("resource","")))
	var filter:=OptionButton.new();filter.custom_minimum_size.y=42;filter.add_item("全部資源");drawer_body.add_child(filter)
	for key in keys: filter.add_item(_resource_name(str(key)))
	filter.select(keys.find(resource)+1 if not resource.is_empty() else 0)
	filter.item_selected.connect(func(index): show_stockpile("" if index==0 else str(keys[index-1]),show_zero))
	var zeros:=CheckButton.new();zeros.text="顯示零庫存";zeros.button_pressed=show_zero;zeros.custom_minimum_size.y=42;drawer_body.add_child(zeros)
	zeros.toggled.connect(func(value): show_stockpile(resource,value))
	_wrapped("目前庫存",18)
	var visible:=0
	for key in resources:
		if not resource.is_empty() and key!=resource: continue
		if not show_zero and resource.is_empty() and float(resources[key])==0: continue
		_wrapped(_resource_name(str(key))+"："+str(resources[key]));visible+=1
		if simulation.supply_enabled and key!="silver": _wrapped("全鎮 %.1f · 上游備貨目標 %.0f"%[SimSupply.total(simulation,key),SimSupply.reserve(simulation,key)],12)
	if visible==0: _wrapped("目前沒有符合條件的庫存。")
	_wrapped("收支紀錄 · 較新在前",18)
	var entries: Array=history.filter(func(entry): return resource.is_empty() or entry.get("resource","")==resource)
	_wrapped("符合條件 %d 筆，顯示最近 50 筆；紀錄不代表所有歷史，匯入前可能已有截短。"%entries.size(),12)
	if entries.is_empty(): _wrapped("尚無收支紀錄。")
	entries=entries.slice(maxi(0,entries.size()-50));entries.reverse()
	for entry in entries:
		var amount:=float(entry.get("amount",0))
		_wrapped(_resource_name(str(entry.get("resource","")))+" "+("+" if amount>0 else "")+str(amount))
		var reason: String=str(entry.get("reason",""));reason={"daily consumption":"每日餐食消耗","tool wear":"工具磨耗","clothing wear":"衣物磨耗","research":"研究投入"}.get(reason,reason)
		if reason.begins_with("natural ("): reason="自然採集 · "+str(_current_data().get("townMap",{}).get("locations",{}).get(reason.trim_prefix("natural (").trim_suffix(")"),{}).get("name",reason))
		var source: String=str(entry.get("source",""))
		_wrapped(("未記錄原因" if reason.is_empty() else reason)+(" · "+source if not source.is_empty() else ""),12)
	_button("重新整理",drawer_body,func(): show_stockpile(resource,show_zero))
	_button("返回小鎮",drawer_body,func(): show_tab("小鎮",true))

func _capture_stockpile() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/player_gift/compatibility-save.json.tmp")
	chat_offline=true
	_load_document(example,"公共庫存驗證")
	show_tab("居民",true);show_stockpile("food")
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/stockpile-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile.chat_offline=true;mobile._load_document(example,"公共庫存驗證");mobile.show_tab("居民",true);mobile.show_stockpile("food")
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/stockpile-mobile.png")
	viewport.queue_free()

func show_work_policy() -> void:
	active_tab="小鎮";drawer.show();_clear_drawer();_wrapped("加工排班",22)
	_wrapped("下一次午夜結算生效。休工讓工坊居民休息；加班每人付 8 銀幣、產能乘 1.5，心情降低。銀幣不足時照常排班。",12)
	if not simulation.economy_enabled: _wrapped("每日經濟目前關閉，請先到設定開啟。")
	var jobs:={"meals":"cook","tools":"blacksmith","clothing":"tailor","medicine":"doctor","furniture":"carpenter"}
	for good in jobs:
		var makers: Array=simulation.data.agents.values().filter(func(a): return not a.get("isPlayer",false) and a.get("jobKey")==jobs[good]).map(func(a): return str(a.name))
		_wrapped(_resource_name(good)+" · "+("無人手" if makers.is_empty() else "、".join(makers)))
		var choice:=OptionButton.new();choice.custom_minimum_size.y=42;drawer_body.add_child(choice)
		for label in ["休工","正常排班","加班"]: choice.add_item(label)
		choice.select(maxi(0,["off","normal","extra"].find(simulation.data.get("workPolicy",{}).get(good,"normal"))))
		choice.item_selected.connect(func(index):
			if SimEconomy.set_policy(simulation,good,["off","normal","extra"][index]): has_simulated=true;status.text="排班已儲存 · 下次午夜生效")
	_button("返回公共庫存",drawer_body,show_stockpile)

func _capture_economy() -> void:
	await get_tree().create_timer(1).timeout
	var example:=FileAccess.get_file_as_string("res://tests/economy/compatibility-save.json.tmp")
	chat_offline=true
	_load_document(example,"每日經濟驗證")
	show_tab("居民",true);show_work_policy()
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://docs/economy-desktop.png")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
	var mobile=load("res://scenes/main.tscn").instantiate();viewport.add_child(mobile)
	mobile.chat_offline=true;mobile._load_document(example,"每日經濟驗證");mobile.show_tab("居民",true);mobile.show_work_policy()
	await get_tree().create_timer(.5).timeout
	await RenderingServer.frame_post_draw
	viewport.get_texture().get_image().save_png("res://docs/economy-mobile.png")
	viewport.queue_free()

func show_buildings() -> void:
	_clear_site_preview()
	active_tab="小鎮";drawer.show();_clear_drawer();_wrapped("建築工程",22)
	_wrapped("開工立即扣公共庫存，木匠、礦工與鐵匠每天午夜施工。3D 選址先挑安全空地，確認後才扣料；地圖會呈現工地、完工與等級外觀。",12)
	if not simulation.buildings_enabled: _wrapped("每日施工目前關閉，請至設定開啟。")
	var manager: Dictionary=simulation.data.buildings;var definitions:=SimBuildings.rules()
	_wrapped("施工中",18)
	if manager.projects.is_empty(): _wrapped("目前沒有工程。")
	for p in manager.projects: _wrapped(str(p.name)+" · %s／%s 工量"%[str(p.workDone),str(p.workRequired)])
	_wrapped("已完工",18)
	if manager.completed.is_empty(): _wrapped("目前沒有已完工建築。")
	for p in manager.completed:
		_wrapped(str(p.name)+" · 等級 "+str(int(p.get("level",1))))
		var key: String=str(p.get("buildingKey",""));var upgrade: Dictionary=definitions.upgrades.get(key,{}).get(str(int(p.get("level",1))+1),{})
		if not upgrade.is_empty() and not manager.projects.any(func(project): return project.get("upgradeKey")==key): _building_offer(key,upgrade,true)
	_wrapped("可新建",18)
	for key in definitions.templates:
		var template: Dictionary=definitions.templates[key]
		if (manager.projects+manager.completed).any(func(p): return p.get("buildingKey")==key or p.name==template.name): continue
		_building_offer(key,template,false)
	_button("重新整理",drawer_body,show_buildings)
	_button("返回小鎮",drawer_body,func(): show_tab("小鎮",true))
func _building_offer(key: String,template: Dictionary,upgrade: bool) -> void:
	var costs: Array=[]
	for resource in template.costs: costs.append(_resource_name(resource)+" "+str(template.costs[resource]))
	_wrapped(str(template.name)+" · "+str(template.description))
	_wrapped("花費："+"、".join(costs)+" · 需要 "+str(template.work)+" 工量",12)
	var button:=_button(("升級：" if upgrade else "開工：")+str(template.name),drawer_body,func():
		if not upgrade: show_building_site(key);return
		var project:=SimBuildings.start(simulation,key,upgrade)
		if not project.is_empty(): has_simulated=true;status.text="工程已開始 · 材料已扣除";_refresh_building_world()
		else: status.text="無法開工：庫存不足或已有相同工程"
		show_buildings())
	button.disabled=not SimBuildings.affordable(simulation,template.costs)

func show_trade() -> void:
	active_tab="小鎮";drawer.show();_clear_drawer();_wrapped("商人交易",22)
	_wrapped("交易使用小鎮公共庫存與銀幣。商人會在午夜到訪或離開；點選交易後立即結算。",12)
	if not simulation.trade_enabled: _wrapped("商人每日來訪目前關閉。")
	var merchant: Variant=simulation.data.trade.get("merchant")
	if not merchant is Dictionary: _wrapped("目前沒有商人，過幾天再看看。")
	else:
		_wrapped(str(merchant.name));_wrapped("停留剩餘 %d 天 · 銀幣 %s"%[merchant.daysRemaining,str(SimEconomy.amount(simulation,"silver"))])
		for index in merchant.offers.size():
			var offer: Dictionary=merchant.offers[index]
			_wrapped(("賣出給商人：" if offer.isBuying else "向商人買入：")+_resource_name(offer.resource))
			_wrapped("單價 %s 銀幣 · 商人剩餘額度 %s · 公共庫存 %s"%[str(offer.price),str(offer.amount),str(SimEconomy.amount(simulation,offer.resource))],12)
			var qty:=SpinBox.new();qty.min_value=1;qty.max_value=maxf(1,float(offer.amount));qty.step=1;qty.value=1;qty.custom_minimum_size.y=42;drawer_body.add_child(qty)
			var button:=_button("賣出" if offer.isBuying else "買入",drawer_body,func():
				var result:=SimTrade.execute(simulation,index,qty.value,offer)
				show_trade()
				if result.get("ok",false): has_simulated=true;status.text="交易完成"
				else: _wrapped(str(result.error)))
			button.disabled=float(offer.price)<0 or float(offer.amount)<1
	_button("重新整理",drawer_body,show_trade)
	_button("返回小鎮",drawer_body,func(): show_tab("小鎮",true))

func show_research() -> void:
	active_tab="小鎮";drawer.show();_clear_drawer();_wrapped("研究",22)
	_wrapped("研究員每天午夜推進，並最多消耗 5 點公共研究點數。切換項目保留已累積進度；沒有指定項目時會自動選擇可研究項目。",12)
	_wrapped("完成後保存研究效果；尚未移植的建築外觀等功能不會因此自動出現。",12)
	if not simulation.research_enabled: _wrapped("每日研究目前關閉。")
	var research: Dictionary=simulation.data.research
	for p in research.projects.values():
		_wrapped(str(p.name)+" · "+str({"available":"可研究","locked":"尚未解鎖","researching":"研究中","complete":"已完成"}.get(p.status,p.status)),18)
		_wrapped(str(p.description)+" · %s／%s"%[str(p.progress),str(p.cost)],12)
		if not p.prerequisites.is_empty():
			var required: Array=p.prerequisites.map(func(key): return str(research.projects.get(key,{}).get("name",key)))
			_wrapped("前置："+"、".join(required),12)
		if p.status=="available": _button("研究："+str(p.name),drawer_body,func():
			if SimResearch.start(simulation,p.key): has_simulated=true
			show_research())
	_button("重新整理",drawer_body,show_research)
	_button("返回小鎮",drawer_body,func(): show_tab("小鎮",true))

func _capture_progress() -> void:
	await get_tree().create_timer(1).timeout
	var pages: Array=["processing"] if FileAccess.file_exists("res://tests/capture_processing.flag") else ["farm"] if FileAccess.file_exists("res://tests/capture_farm.flag") else ["industry"] if FileAccess.file_exists("res://tests/capture_industry.flag") else ["buildings","trade","research"]
	for page in pages:
		for dimensions in [Vector2i(1280,800),Vector2i(375,812)]:
			var viewport:=SubViewport.new();viewport.size=dimensions;viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
			var preview=load("res://scenes/main.tscn").instantiate();viewport.add_child(preview)
			preview._load_document(FileAccess.get_file_as_string("res://tests/"+page+"/compatibility-save.json.tmp"),"經濟建設驗收")
			preview.call("show_"+page)
			await get_tree().create_timer(.5).timeout
			await RenderingServer.frame_post_draw
			viewport.get_texture().get_image().save_png("res://docs/"+page+("-mobile.png" if dimensions.x==375 else "-desktop.png"))
			viewport.queue_free()

func show_industry() -> void:
	active_tab="小鎮";drawer.show();_clear_drawer();_wrapped("產業",22)
	var manager: Dictionary=simulation.data.industry;var defs:=SimIndustry.rules()
	_wrapped(str(manager.townLevelName)+" · 產業 %d／%d"%[manager.industries.size(),manager.maxIndustries])
	_wrapped("開啟產業不扣材料；升級立即扣公共庫存。每天午夜按職業人手與組合加成產出，無人手仍有 30% 基礎產能。",12)
	if not simulation.industry_enabled: _wrapped("每日產業產出目前關閉。")
	for level in defs.levels:
		if int(level.lv)>int(manager.townLevel): _wrapped("下一城鎮等級：%s · 人口 %d／%d · 完工建築 %d／%d"%[level.name,simulation.data.agents.size(),level.population,simulation.data.buildings.completed.size(),level.buildings],12);break
	for key in defs.industries:
		var def: Dictionary=defs.industries[key];_wrapped(str(def.name),18);_wrapped(str(def.description),12)
		if manager.industries.has(key):
			var ind: Dictionary=manager.industries[key];_wrapped("等級 "+str(int(ind.level)))
			var outputs: Array=[]
			for resource in ind.dailyOutput: outputs.append(_resource_name(resource)+" +"+str(ind.dailyOutput[resource]))
			_wrapped("最近一次產出："+("尚未結算" if outputs.is_empty() else "、".join(outputs)),12)
			var next:=SimIndustry.next_level(simulation,key)
			if not next.is_empty():
				var costs: Array=[]
				for resource in next.cost: costs.append(_resource_name(resource)+" "+str(next.cost[resource]))
				_wrapped("升級花費："+"、".join(costs),12)
				var button:=_button("升級："+str(next.name),drawer_body,func():
					if SimIndustry.upgrade(simulation,key): has_simulated=true
					show_industry())
				button.disabled=not SimBuildings.affordable(simulation,next.cost)
		else:
			var button:=_button("開啟："+str(def.name),drawer_body,func():
				if SimIndustry.choose(simulation,key): has_simulated=true
				show_industry())
			button.disabled=manager.industries.size()>=int(manager.maxIndustries)
	_button("重新整理",drawer_body,show_industry)
	_button("返回小鎮",drawer_body,func(): show_tab("小鎮",true))

func show_farm() -> void:
	active_tab="小鎮";drawer.show();_clear_drawer();_wrapped("農田",22)
	var farm: Dictionary=simulation.data.farm;var crops: Dictionary=SimFarm.rules().crops
	var level:=int(simulation.data.industry.industries.get("farming",{}).get("level",0))
	_wrapped(str(simulation.data.clock.season)+" · 農業 Lv"+str(level)+" · 農地 "+str(farm.plots.size()))
	_wrapped("先開啟農業，下一次午夜配置農地。翻土後選作物播種；種子扣銀幣，施肥扣 2 草藥。換季不合時令會枯萎，成熟後請盡快收成。",12)
	_wrapped("限產時會計入在田作物的最高品質預估收成，備貨足夠就暫停播種；既有作物仍可完整收成。收成先存為個別作物；允許廚房使用時，主食作物可在食材不足時煮成餐食，也能送往加工。",12)
	if not simulation.farm_enabled: _wrapped("每日農田生長目前關閉。")
	if level==0: _button("前往產業",drawer_body,show_industry)
	for p in farm.plots:
		var id:=int(p.id);var crop: Dictionary=crops.get(str(p.crop),{})
		_wrapped("農地 %d · %s"%[id,{"empty":"空地","tilled":"已翻土","growing":"生長中","ready":"可收成","withered":"已枯萎"}.get(p.state,p.state)],18)
		if not crop.is_empty(): _wrapped(str(crop.name)+" · 生長 %.1f%% · 水分 %.0f%%"%[p.growthProgress,p.waterLevel]+(" · 已施肥" if p.fertilized else ""),12)
		match p.state:
			"empty": _button("翻土 #%d"%id,drawer_body,func(): SimFarm.till(simulation,id);has_simulated=true;show_farm())
			"tilled":
				var select:=OptionButton.new();select.size_flags_horizontal=Control.SIZE_EXPAND_FILL;drawer_body.add_child(select)
				for key in crops:
					var c: Dictionary=crops[key]
					if int(c.reqLevel)<=level and simulation.data.clock.season in c.seasons and SimSupply.crop_space(simulation,key):
						select.add_item(str(c.name)+" · 種子 "+str(int(c.sellPrice)*2)+" 銀 · "+str(int(c.growDays))+" 天")
						select.set_item_metadata(select.item_count-1,key)
				if select.item_count==0: _wrapped("目前沒有可播種的作物：需符合季節、農業等級與備貨目標。",12)
				var button:=_button("播種 #%d"%id,drawer_body,func():
					if select.selected>=0 and SimFarm.plant(simulation,id,str(select.get_item_metadata(select.selected))): has_simulated=true;show_farm()
					else: _wrapped("播種失敗：請檢查種子費、季節或全鎮作物備貨目標（含在田作物）。",12))
				button.disabled=select.item_count==0
			"growing":
				_button("澆水 #%d"%id,drawer_body,func(): SimFarm.water(simulation,id);has_simulated=true;show_farm())
				var button:=_button("施肥 #%d · 2 草藥"%id,drawer_body,func():
					if SimFarm.fertilize(simulation,id): has_simulated=true
					show_farm())
				button.disabled=p.fertilized or SimEconomy.amount(simulation,"herbs")<2
			"ready": _button("收成 #%d"%id,drawer_body,func(): SimFarm.harvest(simulation,id);has_simulated=true;show_farm())
			"withered": _button("清除 #%d"%id,drawer_body,func(): SimFarm.clear(simulation,id);has_simulated=true;show_farm())
	if not farm.harvestLog.is_empty():
		_wrapped("最近收成",18)
		for entry in farm.harvestLog.slice(maxi(0,farm.harvestLog.size()-10)):
			_wrapped("%s · %s +%d（%s）"%[entry.season,entry.cropName,entry.amount,SimFarm.rules().quality[entry.quality]],12)
	_button("重新整理",drawer_body,show_farm)
	_button("返回小鎮",drawer_body,func(): show_tab("小鎮",true))

func show_processing() -> void:
	active_tab="小鎮";drawer.show();_clear_drawer();_wrapped("加工",22)
	var manager: Dictionary=simulation.data.processing;var defs:=SimProcessing.rules()
	_wrapped("建廠立即扣材料，午夜施工。完工隔日自動招工並選第一份配方。成品先存工廠倉庫，可領取、出售或交訂單。",12)
	_wrapped("切換配方會清除該廠生產進度；原料於每批完成時扣除。移除人手後，隔日仍會自動補位。市集會每天自動出售部分成品。",12)
	if simulation.supply_enabled: _wrapped("產量控制：全鎮同商品保留約 3 批，另備工程、下游配方與未完成訂單需求；下一批超標就停產，消耗後恢復。手動與市集販售共用每商品每日 4 件需求。",12)
	if not simulation.processing_enabled: _wrapped("每日加工營運目前關閉。")
	for key in defs:
		var def: Dictionary=defs[key];_wrapped(str(def.name),18)
		if not manager.builtFactories.has(key):
			var costs: Array=[]
			for r in def.cost: costs.append(_resource_name(r)+" "+str(int(def.cost[r])))
			_wrapped("、".join(costs)+" · 工程量 "+str(int(def.buildDays)),12)
			var button:=_button("建造："+str(def.name),drawer_body,func():
				if SimProcessing.build(simulation,key): has_simulated=true
				show_processing())
			button.disabled=not SimBuildings.affordable(simulation,def.cost)
			continue
		var f: Dictionary=manager.builtFactories[key]
		if f.status=="building": _wrapped("施工 %.0f／%.0f"%[f.buildProgress,f.buildRequired]);continue
		var names: Array=[]
		for id in f.workers: names.append(str(simulation.data.agents.get(id,{}).get("name",id)))
		_wrapped("人手 %d／%d · %s"%[f.workers.size(),def.workerSlots,"、".join(names)],12)
		for recipe in def.recipes:
			var inputs: Array=[];var outputs: Array=[]
			for r in recipe.input: inputs.append(_resource_name(r)+" "+str(int(recipe.input[r])))
			for r in recipe.output: outputs.append(_resource_name(r)+" "+str(int(recipe.output[r])))
			_wrapped(" + ".join(inputs)+" → "+" + ".join(outputs)+" · 所需進度 "+str(int(recipe.time)),12)
			if f.recipe==recipe.id:
				_wrapped(("庫存充足，暫停 · " if SimSupply.blocked(simulation,recipe) else "生產中 · ")+"進度 %.2f／%.0f"%[f.productionProgress,recipe.time],12)
				if simulation.supply_enabled:
					for r in recipe.output: _wrapped("全鎮 "+_resource_name(r)+" %.0f／%.0f"%[SimSupply.total(simulation,r),SimSupply.target(simulation,r,float(recipe.output[r]))],12)
				if not SimBuildings.affordable(simulation,recipe.input): _wrapped("原料不足，等待補貨。",12)
			else: _button("選用："+str(recipe.label),drawer_body,func():
				if SimProcessing.set_recipe(simulation,key,recipe.id): has_simulated=true
				show_processing())
		var candidates:=OptionButton.new();candidates.size_flags_horizontal=Control.SIZE_EXPAND_FILL;drawer_body.add_child(candidates)
		for a in simulation.data.agents.values():
			if a.get("isPlayer",false) or a.get("isDead",false) or a.id in f.workers: continue
			candidates.add_item(str(a.name)+" · "+_job_name(str(a.get("jobKey",""))));candidates.set_item_metadata(candidates.item_count-1,a.id)
		var assign_button:=_button("指派到："+str(def.name),drawer_body,func():
			if candidates.selected>=0 and SimProcessing.assign(simulation,key,str(candidates.get_item_metadata(candidates.selected))): has_simulated=true
			show_processing())
		assign_button.disabled=candidates.item_count==0 or f.workers.size()>=int(def.workerSlots)
		for id in f.workers:
			_button("移除："+str(simulation.data.agents.get(id,{}).get("name",id)),drawer_body,func(): SimProcessing.remove_worker(simulation,id);has_simulated=true;show_processing())
		if f.warehouse.is_empty(): _wrapped("工廠倉庫：尚無成品",12)
		for r in f.warehouse:
			if float(f.warehouse[r])<=0: continue
			_wrapped("工廠倉庫 · "+_resource_name(r)+" "+str(f.warehouse[r]),12)
			var quantity:=SpinBox.new();quantity.min_value=1;quantity.max_value=float(f.warehouse[r]);quantity.value=minf(1,quantity.max_value);quantity.step=1;quantity.size_flags_horizontal=Control.SIZE_EXPAND_FILL;drawer_body.add_child(quantity)
			_button("領取："+_resource_name(r),drawer_body,func():
				if SimProcessing.transfer(simulation,key,r,quantity.value): has_simulated=true
				show_processing())
			var price:=5
			for recipe in def.recipes:
				if recipe.output.has(r): price=int(recipe.outputPrice);break
			if simulation.supply_enabled: _wrapped("今日市場還收 %.0f 件（超量只賣出剩餘需求）"%SimSupply.remaining(simulation,r),12)
			_button("出售："+_resource_name(r)+" · 每件 %d 銀"%price,drawer_body,func():
				if SimProcessing.transfer(simulation,key,r,quantity.value,true): has_simulated=true
				show_processing())
	_wrapped("限時訂單",18)
	var active:=0
	for order in manager.orders:
		if order.status!="active": continue
		active+=1
		_wrapped("%s × %d · 報酬 %d 銀 · 剩 %d 天"%[_resource_name(order.product),order.amount,order.reward,order.daysLeft],12)
		var f: Dictionary=manager.builtFactories.get(order.factoryKey,{})
		var button:=_button("交付："+str(order.id),drawer_body,func():
			if SimProcessing.fulfill(simulation,order.id): has_simulated=true
			show_processing())
		button.disabled=float(f.get("warehouse",{}).get(order.product,0))<float(order.amount)
	if active==0: _wrapped("目前沒有訂單。",12)
	_button("重新整理",drawer_body,show_processing)
	_button("返回小鎮",drawer_body,func(): show_tab("小鎮",true))

func _clear_site_preview() -> void:
	if is_instance_valid(placement_preview): placement_preview.queue_free()
	placement_preview=null
func _refresh_building_world() -> void:
	var houses:=motion.layout.agent_house.duplicate(true)
	world_view.display_save(simulation.data);motion.layout=world_view.layout;motion.layout.agent_house=houses;motion.pathfinder.grid=world_view.layout.grid
	for p in motion.positions.values():
		var safe: Vector2=motion.layout._nearest(Vector2(p.x,p.y));p.x=safe.x;p.y=safe.y
		motion._path(p)
	world_view.animate_agents(motion.positions)
func show_building_site(key: String,index: int=0) -> void:
	_clear_site_preview();active_tab="小鎮";drawer.show();_clear_drawer()
	var choices:=BuildingSites.candidates(simulation.data)
	_wrapped("3D 選址 · "+str(SimBuildings.rules().templates[key].name),22)
	if choices.is_empty():
		_wrapped("沒有足夠的安全空地，未扣材料。")
		_button("返回工程",drawer_body,show_buildings);return
	index=posmod(index,choices.size());var site: Vector2i=choices[index]
	_wrapped("候選空地 %d／%d · 地圖格 (%d, %d)"%[index+1,choices.size(),site.x,site.y],12)
	_wrapped("綠色範圍為 2×2 格建築用地，已避開道路、水域、住宅與預留工廠區。確認時會再次檢查位置與材料。",12)
	placement_preview=MeshInstance3D.new();var mesh:=BoxMesh.new();mesh.size=Vector3(2,.12,2);placement_preview.mesh=mesh
	var material:=StandardMaterial3D.new();material.albedo_color=Color(.2,1,.45,.65);material.transparency=BaseMaterial3D.TRANSPARENCY_ALPHA;placement_preview.material_override=material
	placement_preview.position=Vector3(site.x+1,.3,site.y+1);add_child(placement_preview)
	rig.follow_player=false;rig.position=Vector3(site.x+1,0,site.y+1);rig.width=16;rig._sync()
	# An in-panel camera keeps the site visible even when the mobile drawer covers the map.
	var inset:=SubViewportContainer.new();inset.custom_minimum_size=Vector2(0,170);inset.size_flags_horizontal=Control.SIZE_EXPAND_FILL;inset.stretch=true;inset.mouse_filter=Control.MOUSE_FILTER_IGNORE;drawer_body.add_child(inset)
	var mini:=SubViewport.new();mini.size=Vector2i(320,170);mini.world_3d=get_world_3d();mini.render_target_update_mode=SubViewport.UPDATE_ALWAYS;inset.add_child(mini)
	var camera:=Camera3D.new();mini.add_child(camera);camera.projection=Camera3D.PROJECTION_ORTHOGONAL;camera.size=6;camera.position=Vector3(site.x+6,8,site.y+7);camera.look_at(Vector3(site.x+1,0,site.y+1));camera.current=true
	_button("上一塊空地",drawer_body,func(): show_building_site(key,index-1))
	_button("下一塊空地",drawer_body,func(): show_building_site(key,index+1))
	var active_world: Dictionary=simulation.data
	_button("確認開工",drawer_body,func():
		if not is_same(active_world,simulation.data): return
		var project:=SimBuildings.start(simulation,key,false,site)
		_clear_site_preview()
		if not project.is_empty(): has_simulated=true;status.text="已開工 · 材料已扣除";_refresh_building_world()
		else: status.text="位置或材料已改變，未開工"
		show_buildings())
	_button("取消選址",drawer_body,show_buildings)

func _capture_sites() -> void:
	await get_tree().create_timer(1).timeout
	for stage in ["building","complete","preview"]:
		for dimensions in [Vector2i(1280,800),Vector2i(375,812)]:
			var viewport:=SubViewport.new();viewport.size=dimensions;viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
			var preview=load("res://scenes/main.tscn").instantiate();viewport.add_child(preview)
			preview._load_document(FileAccess.get_file_as_string("res://tests/buildings/site-"+("complete" if stage!="building" else "building")+".json.tmp"),"建築選址驗收")
			if stage=="preview": preview.show_building_site("school")
			else:
				var items: Array=preview.simulation.data.buildings.projects if stage=="building" else preview.simulation.data.buildings.completed
				preview.rig.position=Vector3(items[0].siteX+1,0,items[0].siteY+1);preview.rig.width=10;preview.rig._sync();preview.drawer.hide()
			await get_tree().create_timer(.5).timeout
			await RenderingServer.frame_post_draw
			viewport.get_texture().get_image().save_png("res://docs/site-"+stage+("-mobile.png" if dimensions.x==375 else "-desktop.png"))
			viewport.queue_free()

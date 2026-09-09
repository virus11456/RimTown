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

func _ready() -> void:
	TranslationServer.set_locale("zh_TW")
	api = ApiClient.new()
	add_child(api)
	rig = TownCamera.new()
	add_child(rig)
	_make_world_view()
	_build_ui()
	load_demo("frontier")
	get_viewport().size_changed.connect(_responsive)
	if DisplayServer.get_name() != "headless" and get_viewport() == get_tree().root and FileAccess.file_exists("res://tests/capture_matrix.flag"): _capture_demo()
	_responsive()
	if "--smoke" in OS.get_cmdline_user_args():
		await get_tree().process_frame
		get_tree().quit()

func _make_world_view() -> void:
	# Phase 3 installs a view; no simulation is instantiated by this client.
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
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.mouse_filter = Control.MOUSE_FILTER_IGNORE
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
	status.size = Vector2(size.x-40,50)
	drawer.position = Vector2(16 if mobile else size.x-360,192 if mobile else 164)
	drawer.size = Vector2(size.x-32 if mobile else 344,maxf(180,size.y-drawer.position.y-84))

func _load_document(text: String, source: String) -> bool:
	var incoming := SaveDocument.new()
	if not incoming.parse(text):
		status.text = incoming.error
		return false
	document = incoming
	var data := document.snapshot()
	heading.text = str(data.get("townName","小鎮"))
	var clock_data: Dictionary = data.clock
	summary.text = "%s · 第 %s 天 · %s 位居民" % [clock_data.get("season",""),str(int(clock_data.get("day",1))),data.agents.size()]
	status.text = "%s · 觀賞模式" % source
	if world_view != null:
		world_view.call("display_save",data)
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
	drawer.show()
	_clear_drawer()
	_label(tab,drawer_body,24)
	match tab:
		"小鎮":
			_button("查看邊境鎮示範",drawer_body,func(): load_demo("frontier"))
			_button("查看海風鎮示範",drawer_body,func(): load_demo("harbor"))
			_button("匯入網頁版存檔",drawer_body,import_save)
			_button("匯出原始存檔副本",drawer_body,export_save)
			var resources: Dictionary = document.data.get("stockpile",{}).get("resources",{})
			for key in resources:
				if float(resources[key]) != 0: _label("%s   %d" % [_resource_name(key),resources[key]],drawer_body)
		"居民":
			for id in document.data.get("agents",{}):
				var agent: Dictionary = document.data.agents[id]
				_button(str(agent.get("name",id)),drawer_body,func(): show_agent(id))
		"故事":
			var logs: Array = document.data.get("messageLog",[])
			if logs.is_empty(): _label("故事從這裡開始。",drawer_body)
			for entry in logs.slice(maxi(0,logs.size()-30)):
				var label := _label(str(entry.get("content","")),drawer_body,14)
				label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		"設定": _settings_ui()

func show_agent(id: String) -> void:
	_clear_drawer()
	var agent: Dictionary = document.data.agents[id]
	_label(str(agent.get("name",id)),drawer_body,24)
	_label("%s 歲 · %s" % [str(int(agent.get("age",0))),_job_name(str(agent.get("jobKey","旅人")))],drawer_body)
	var label := _label(str(agent.get("personality",{}).get("background","")),drawer_body)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	for key in agent.get("needs",{}):
		_label("%s    %d" % [{"hunger":"飽足","rest":"休息","social":"社交","comfort":"舒適","recreation":"娛樂","beauty":"美感"}.get(key,key),agent.needs[key]],drawer_body,14)
	if world_view != null:
		var pos: Variant = world_view.call("agent_position",id)
		if pos is Vector3: rig.position = Vector3(pos.x,0,pos.z)
	_button("返回居民列表",drawer_body,func(): show_tab("居民",true))

func _line(placeholder: String, secret := false) -> LineEdit:
	var field := LineEdit.new()
	field.placeholder_text = placeholder
	field.secret = secret
	field.custom_minimum_size.y = 42
	drawer_body.add_child(field)
	return field

func _settings_ui() -> void:
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
	var note := _label("觀賞版可讀取小鎮與居民；模擬、聊天、建設與回存將在後續版本開放。",drawer_body,14)
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
	if document.raw_json.is_empty(): return
	if OS.has_feature("web"):
		JavaScriptBridge.download_buffer(document.serialize().to_utf8_buffer(),"rimtown-copy.json","application/json")
		status.text="已下載原始存檔副本。"
	else:
		var path := "user://rimtown-copy-%d.json" % Time.get_unix_time_from_system()
		var file := FileAccess.open(path,FileAccess.WRITE)
		if file:
			file.store_string(document.serialize())
			status.text="副本已儲存於 " + ProjectSettings.globalize_path(path)
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

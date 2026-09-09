class_name ApiClient
extends Node
## Same API contract as RimTownAuth; viewers never write cloud saves.
signal session_changed(logged_in: bool)
var base_url := "https://rimtown.cc/api/"
var token := ""
var read_only := true
var persist_session := true
var session_path := "user://session.cfg"
var timeout_seconds := 25.0

func _ready() -> void:
	if OS.has_feature("web"):
		base_url = str(JavaScriptBridge.eval("window.location.origin", true)) + "/api/"
		token = str(JavaScriptBridge.eval("localStorage.getItem('rimtown_jwt') || ''", true))
	elif persist_session:
		var cfg := ConfigFile.new()
		if cfg.load(session_path) == OK:
			token = str(cfg.get_value("auth", "jwt", ""))

func _store_token(value: String) -> void:
	token = value
	if persist_session:
		if OS.has_feature("web"):
			if token.is_empty():
				JavaScriptBridge.eval("localStorage.removeItem('rimtown_jwt')", true)
			else:
				JavaScriptBridge.eval("localStorage.setItem('rimtown_jwt', %s)" % JSON.stringify(token), true)
		else:
			var cfg := ConfigFile.new()
			cfg.set_value("auth", "jwt", token)
			cfg.save(session_path)
	session_changed.emit(not token.is_empty())

func logout() -> void:
	_store_token("")

func request_json(endpoint: String, method := HTTPClient.METHOD_GET, payload: Variant = null, authenticated := true, timeout_override := 0.0) -> Dictionary:
	var request := HTTPRequest.new()
	request.timeout = timeout_override if timeout_override>0 else timeout_seconds
	request.body_size_limit = 20 * 1024 * 1024
	add_child(request)
	var headers := PackedStringArray(["Content-Type: application/json", "Accept: application/json"])
	if authenticated and not token.is_empty():
		headers.append("Authorization: Bearer " + token)
	var body := "" if payload == null else JSON.stringify(payload)
	var start_error := request.request(base_url + endpoint, headers, method, body)
	if start_error != OK:
		request.queue_free()
		return {"ok": false, "status": 0, "error": "無法啟動網路請求。"}
	var response: Array = await request.request_completed
	request.queue_free()
	var status: int = response[1]
	if response[0] != HTTPRequest.RESULT_SUCCESS:
		return {"ok": false, "status": status, "error": "連線失敗或逾時，請稍後重試。"}
	var parser := JSON.new()
	if parser.parse(response[3].get_string_from_utf8()) != OK:
		return {"ok": false, "status": status, "error": "伺服器傳回的資料不是 JSON。"}
	var value: Variant = parser.data
	if status < 200 or status >= 300:
		if status == 401 and authenticated:
			logout()
		var message := "請求失敗（%d）" % status
		if value is Dictionary:
			message = str(value.get("message", value.get("error", message)))
		return {"ok": false, "status": status, "error": message, "data": value}
	return {"ok": true, "status": status, "data": value}

func login(username: String, password: String) -> Dictionary:
	return await _authenticate("login", {"username": username, "password": password})

func register(username: String, password: String, email := "", invite := "") -> Dictionary:
	return await _authenticate("register", {"username": username, "password": password, "email": email, "invite": invite})

func _authenticate(endpoint: String, payload: Dictionary) -> Dictionary:
	var result := await request_json(endpoint, HTTPClient.METHOD_POST, payload, false)
	if result.ok:
		var value: Variant = result.data
		if not value is Dictionary or not value.get("nonce") is String or value.nonce.is_empty() or not value.get("user") is Dictionary:
			return {"ok": false, "status": result.status, "error": "登入回應缺少有效憑證。"}
		_store_token(value.nonce)
	return result

func me() -> Dictionary:
	return await request_json("me")

func saves() -> Dictionary:
	return await request_json("saves")

func load_save(town_id: String) -> Dictionary:
	return await request_json("save/" + town_id.uri_encode())

func settings() -> Dictionary:
	return await request_json("settings")

func set_settings(npc_llm_budget: int, dialogue_lang := "") -> Dictionary:
	var payload := {"npc_llm_budget": npc_llm_budget}
	if not dialogue_lang.is_empty():
		if dialogue_lang not in ["auto", "zh", "en"]:
			return {"ok": false, "status": 0, "error": "無效的 AI 對話語言。"}
		payload.dialogue_lang = dialogue_lang
	return await request_json("settings", HTTPClient.METHOD_POST, payload)

func save(town_id: String, document: Dictionary) -> Dictionary:
	if read_only:
		return {"ok": false, "status": 0, "error": "觀賞版不寫入雲端存檔。"}
	var clock_data: Dictionary = document.get("clock", {})
	var payload := {"town_id": town_id, "town_name": document.get("townName", ""), "save_data": JSON.stringify(document), "season": clock_data.get("season", "春季"), "year": clock_data.get("year", 1), "day": clock_data.get("day", 1), "population": document.get("agents", {}).size()}
	var result := await request_json("save", HTTPClient.METHOD_POST, payload)
	if result.ok and result.data is Dictionary and result.data.get("stale", false):
		return {"ok": false, "status": result.status, "stale": true, "error": "雲端進度較新，未覆寫。請重新載入雲端存檔。"}
	return result

func chat(prompt: String, lane := "chat", max_tokens := 400, temperature := 0.7, lang := "zh") -> Dictionary:
	if lane not in ["chat", "background"]:
		return {"ok": false, "status": 0, "error": "無效的 AI 通道。"}
	if lang not in ["zh", "en"]:
		return {"ok": false, "status": 0, "error": "無效的 AI 對話語言。"}
	return await request_json("chat", HTTPClient.METHOD_POST, {"prompt": prompt, "max_tokens": max_tokens, "temperature": temperature, "lane": lane, "lang": lang},true,35.0)

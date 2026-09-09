class_name SaveDocument
extends RefCounted
## Lossless read-only envelope. Retains exact bytes and every unknown nested field.
var raw_json := ""
var data: Dictionary = {}
var error := ""

func parse(text: String) -> bool:
	var parser := JSON.new()
	if parser.parse(text) != OK:
		error = "JSON 格式錯誤（第 %d 行）" % parser.get_error_line()
		return false
	var value: Variant = parser.data
	if not value is Dictionary or not value.get("clock") is Dictionary or not value.get("agents") is Dictionary or not value.get("townMap") is Dictionary:
		error = "這不是有效的 RimTown 存檔：需要 clock、agents、townMap。"
		return false
	if not value.townMap.get("locations") is Dictionary or not value.get("tickCount", 0) is float and not value.get("tickCount", 0) is int:
		error = "存檔的地點或進度格式不正確。"
		return false
	raw_json = text
	data = value.duplicate(true)
	error = ""
	return true

func serialize() -> String:
	return raw_json

func snapshot() -> Dictionary:
	return data.duplicate(true)

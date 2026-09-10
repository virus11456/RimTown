class_name PhysicalTrace
extends RefCounted
# View-owned history: cannot be derived from the pure simulation's logical destinations.
var data: Dictionary={"day":"","entries":{},"last":{}}
func load_state(value: Variant) -> void:
	data={"day":"","entries":{},"last":{}}
	if value is Dictionary and value.get("entries") is Dictionary and value.get("last") is Dictionary: data=value.duplicate(true)
func snapshot() -> Dictionary:
	return data.duplicate(true)
func record(w: SimWorld,m: SimMotion) -> void:
	if not w.trace_enabled: return
	var day:=SimTrace.day_key(w.data.clock)
	if data.get("day","")!=day: data={"day":day,"entries":{},"last":{}}
	for id in w.data.agents:
		if w.data.agents[id].get("isDead",false) or not m.positions.has(id): continue
		var actual:=SimAgenda.current(w,m,id)
		var key: String=actual.room+"|"+actual.text+"|"+actual.destination
		if data.last.get(id,"")==key: continue
		data.last[id]=key
		var rows: Array=data.entries.get(id,[])
		rows.append({"m":int(w.data.clock.hour)*60+int(w.data.clock.minute),"text":actual.text,"location":actual.actual,"room":actual.room,"target":actual.target,"arrived":actual.arrived})
		data.entries[id]=rows.slice(-160)
	for id in data.entries.keys():
		if not w.data.agents.has(id): data.entries.erase(id);data.last.erase(id)
func entries(w: SimWorld,id: String) -> Array:
	return data.entries.get(id,[]) if data.get("day","")==SimTrace.day_key(w.data.clock) else []

class_name SimMemory
extends RefCounted
## Uses World.serialize camelCase fields; snapshots retain unknown fields.
var entries: Array = []
var capacity := 500
func load_entries(value: Array) -> void:
	entries=value.duplicate(true)
func snapshot() -> Array:
	return entries.duplicate(true)
func add(tick: int,time_str: String,category: String,content: String,importance := 5,related_agents: Array = []) -> void:
	entries.append({"tick":tick,"timeStr":time_str,"category":category,"content":content,"importance":importance,"relatedAgents":related_agents.duplicate()})
	if entries.size()>capacity: entries=_last(entries,capacity)
static func _last(values: Array,n: int) -> Array:
	# JS slice(-0) returns the full array.
	return values.slice(maxi(0,values.size()-n) if n>0 else 0).duplicate(true)
func recent(n := 10) -> Array:
	return _last(entries,n)
func about_agent(agent_name: String,n := 5) -> Array:
	return _last(entries.filter(func(e): return agent_name in e.get("relatedAgents",[])),n)
func important(minimum := 7,n := 10) -> Array:
	return _last(entries.filter(func(e): return float(e.get("importance",5))>=minimum),n)
func thoughts(n := 3) -> Array:
	return _last(entries.filter(func(e): return e.get("category","") in ["reflection","whisper"]),n)
static func _bigrams(value: String) -> Dictionary:
	var clean := ""
	for character in value:
		if character.strip_edges().is_empty() or character in "。，、！？!?,.:：;；「」『』()（）[]…~—-": continue
		clean+=character
	# JavaScript slices UTF-16 code units, including emoji surrogate pairs.
	var bytes := clean.to_utf16_buffer()
	var result := {}
	for i in range(0,bytes.size()-2,2):
		result[str(bytes.decode_u16(i))+":"+str(bytes.decode_u16(i+2))]=true
	return result
func retrieve(focal_text: String,focal_agents: Array = [],n := 5,now_tick := 0) -> Array:
	var query := _bigrams(focal_text)
	var scored: Array = []
	for index in entries.size():
		var entry: Dictionary=entries[index]
		var age := maxf(0,float(now_tick-int(entry.get("tick",0)))/96)
		var importance := float(entry.get("importance",5))
		if importance==0: importance=5 # Original JS `importance || 5`.
		var words := _bigrams(str(entry.get("content","")))
		var overlap := 0
		for word in query:
			if words.has(word): overlap+=1
		var dice := 2.0*overlap/(query.size()+words.size()) if query.size()+words.size()>0 else 0.0
		var hit := 0.0
		for agent_name in focal_agents:
			if not str(agent_name).is_empty() and (agent_name in entry.get("relatedAgents",[]) or str(agent_name) in str(entry.get("content",""))):
				hit=1; break
		var score := .5*pow(.85,age)+3*minf(1,dice*2+hit*.6)+2*minf(10,importance)/10
		scored.append({"entry":entry,"score":score,"index":index})
	scored.sort_custom(func(a,b): return a.index<b.index if a.score==b.score else a.score>b.score)
	scored=scored.slice(0,maxi(0,n))
	# Preserve score order for equal ticks, as in JS stable sort.
	for i in scored.size(): scored[i].rank=i
	scored.sort_custom(func(a,b): return a.rank<b.rank if a.entry.tick==b.entry.tick else a.entry.tick<b.entry.tick)
	return scored.map(func(item): return item.entry.duplicate(true))

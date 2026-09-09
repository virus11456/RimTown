class_name SimRelationships
extends RefCounted
var relationships: Dictionary = {}
func load_relationships(value: Dictionary) -> void:
	relationships=value.duplicate(true)
func snapshot() -> Dictionary:
	return relationships.duplicate(true)
func get_or_create(id: String,target_name: String) -> Dictionary:
	if not relationships.has(id):
		relationships[id]={"targetId":id,"targetName":target_name,"affinity":0,"trust":0,"romanticInterest":0,"interactionCount":0,"lastInteractionTick":0,"sharedMemories":[],"status":null,"statusSince":0,"isCheating":false}
	return relationships[id]
static func relationship_type(value: Dictionary) -> String:
	match value.get("status"):
		"married": return "已婚"
		"dating": return "交往中"
		"ex": return "前任"
	if float(value.get("romanticInterest",0))>50: return "暗戀"
	var affinity := float(value.get("affinity",0))
	if affinity>60: return "摯友"
	if affinity>20: return "朋友"
	if affinity> -20: return "認識" if int(value.get("interactionCount",0))>0 else "陌生人"
	if affinity> -60: return "對手"
	return "敵人"
static func modify(value: Dictionary,field: String,delta: float) -> void:
	assert(field in ["affinity","trust","romanticInterest"])
	value[field]=clampf(float(value.get(field,0))+delta,0 if field=="romanticInterest" else -100,100)
static func add_shared_memory(value: Dictionary,content: String) -> void:
	var memories: Array=value.get("sharedMemories",[])
	memories.append(content)
	value.sharedMemories=memories.slice(maxi(0,memories.size()-150))
static func record_interaction(value: Dictionary,tick: int,summary: String) -> void:
	value.interactionCount=int(value.get("interactionCount",0))+1
	value.lastInteractionTick=tick
	add_shared_memory(value,summary)
func friends() -> Array:
	return relationships.values().filter(func(r): return float(r.get("affinity",0))>20).duplicate(true)
func romantic_interests() -> Array:
	return relationships.values().filter(func(r): return float(r.get("romanticInterest",0))>40).duplicate(true)
func best_friend() -> Dictionary:
	var best: Dictionary={}
	for friend in friends():
		if best.is_empty() or float(friend.affinity)>=float(best.affinity): best=friend
	return best.duplicate(true)
func partner() -> Dictionary:
	for value in relationships.values():
		if value.get("status") in ["dating","married"]: return value.duplicate(true)
	return {}
func spouse() -> Dictionary:
	for value in relationships.values():
		if value.get("status")=="married": return value.duplicate(true)
	return {}

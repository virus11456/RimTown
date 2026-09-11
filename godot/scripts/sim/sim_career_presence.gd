class_name SimCareerPresence
extends RefCounted
static func room(m: SimMotion,id: String) -> String:
	if not m.positions.has(id): return ""
	var p: Dictionary=m.positions[id]
	for key in m.layout.houses:
		var z: Dictionary=m.layout.houses[key]
		if p.x>=z.x*16 and p.x<(z.x+z.w)*16 and p.y>=z.y*16 and p.y<(z.y+z.h)*16: return key
	return m.location_at(Vector2(p.x,p.y))
static func place(m: SimMotion,id: String) -> String:
	var key:=room(m,id)
	return str(m.layout.houses[key].parentLocId) if m.layout.houses.has(key) else key
static func together(m: SimMotion,a: String,b: String,location: String) -> bool:
	return not location.is_empty() and place(m,a)==location and place(m,b)==location and room(m,a)==room(m,b)

static func task_error(m: SimMotion,task: Dictionary) -> String:
	# Headless simulation imports without observed positions retain legacy logic.
	if m==null: return ""
	if place(m,"player")!=str(task.location): return "請先操作旅人走到工作地點。"
	if task.job not in ["doctor","priest"]: return ""
	var id:=str(task.target)
	if not together(m,"player",id,str(task.location)): return "對方尚未在同一場所到場，請等待或重新查看工作。"
	var p: Dictionary=m.positions.get("player",{});var a: Dictionary=m.positions.get(id,{})
	if p.is_empty() or a.is_empty(): return "尚未取得雙方實際位置，無法開始服務。"
	if Vector2(p.x,p.y).distance_to(Vector2(a.x,a.y))>48: return "請走近對方再照護或陪伴；需要保持在三格距離內。"
	if p.get("doorPhase")!=null or a.get("doorPhase")!=null: return "請等雙方完成進出門後再開始服務。"
	return ""

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
	if at_threshold(m,"player") or at_threshold(m,id): return "請走過門檻，等雙方完成進出門後再開始服務。"
	if not together(m,"player",id,str(task.location)): return "對方尚未在同一場所到場，請等待或重新查看工作。"
	var p: Dictionary=m.positions.get("player",{});var a: Dictionary=m.positions.get(id,{})
	if p.is_empty() or a.is_empty(): return "尚未取得雙方實際位置，無法開始服務。"
	if Vector2(p.x,p.y).distance_to(Vector2(a.x,a.y))>48: return "請走近對方再照護或陪伴；需要保持在三格距離內。"
	if p.get("doorPhase")!=null or a.get("doorPhase")!=null: return "請等雙方完成進出門後再開始服務。"
	return ""

static func service_need_error(w: SimWorld,task: Dictionary) -> String:
	if task.get("job","") not in ["doctor","priest"]: return ""
	var a: Dictionary=w.data.agents.get(str(task.get("target","")),{})
	if a.is_empty() or a.get("isDead",false): return "服務對象已不在，無法繼續這次值勤。"
	if task.job=="doctor" and float(a.needs.rest)>40: return "對方目前已不符合疲憊照護需求，這次不需要服務。"
	if task.job=="priest" and a.get("activity","")=="sleeping": return "對方正在睡覺，請等醒來後再談心；不會為了值勤叫醒居民。"
	if task.job=="priest" and float(a.mood)>=0: return "對方目前已不符合低落陪伴需求，這次不需要服務。"
	return ""

static func service_status(w: SimWorld,m: SimMotion,task: Dictionary) -> String:
	var id:=str(task.get("target",""));var a: Dictionary=w.data.agents.get(id,{})
	var need:=service_need_error(w,task)
	if not need.is_empty(): return need
	if m==null or not m.positions.has(id): return "位置尚未取得，請稍後重新查看。"
	var actual:=SimAgenda.current(w,m,id)
	var notice:=""
	if task.get("job","")=="doctor" and a.get("activity","")=="sleeping":
		notice="\n對方正在睡眠恢復體力；若照護完成前已不再疲憊，會停止服務，不計獎勵或每日次數。"
	return "實際位置："+str(actual.actual)+"\n目前："+str(actual.text)+"\n預定目的地："+str(actual.target)+"（不代表已到場）"+notice

static func service_location(w: SimWorld,a: Dictionary) -> String:
	# A changed destination is an intention, not evidence of physical departure.
	if w.social.observed_motion!=null:
		var actual:=place(w.social.observed_motion,str(a.id))
		if w.data.townMap.locations.has(actual): return actual
	return str(a.currentLocation)

static func at_threshold(m: SimMotion,id: String) -> bool:
	if m==null or not m.positions.has(id): return false
	var p: Dictionary=m.positions[id]
	var x:=floori(float(p.x)/16);var y:=floori(float(p.y)/16)
	return y>=0 and y<m.layout.grid.size() and x>=0 and x<m.layout.grid[y].size() and int(m.layout.grid[y][x])==9

static func visit(m: SimMotion,id: String) -> Dictionary:
	# Resolve the occupied room, never the assigned home or intended destination.
	if m==null or not m.positions.has(id) or not m.positions.has("player"):
		return {"text":"位置尚未取得，請稍後重新查看。"}
	var target_room:=room(m,id)
	var zone: Dictionary=m.layout.houses.get(target_room,m.layout.buildings.get(target_room,{}))
	var result:={"text":"對方目前在戶外，請走近居民；查看位置不會移動旅人。"}
	if zone.has("doorPixelX"):
		result.entrance={"x":zone.doorPixelX,"y":zone.doorPixelY}
		result.text="對方目前在室內。查看這間房屋入口後，用方向鍵或 WASD 穿過門口，再走近居民。"
		if room(m,"player")==target_room:
			result.text="你已進入同一間房屋，請走過門檻並靠近居民，保持三格以內。"
	if at_threshold(m,id) or m.positions[id].get("doorPhase")!=null:
		result.text+=" 對方仍在進出門，請等他站定；位置會隨行程更新。"
	if not result.has("entrance") and not target_room.is_empty():
		result.text+=" 若居民走進房屋，請重新查看目前入口。"
	return result

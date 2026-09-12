class_name SimWorkstation
extends RefCounted
const HAMMER_JOBS := ["carpenter","blacksmith"]
const JOBS := ["carpenter","blacksmith","cook","tailor","researcher"]
const LOCATIONS := {"carpenter":"workshop","blacksmith":"workshop","cook":"tavern","tailor":"workshop","researcher":"library"}
static func label(job: String) -> String:
	return {"cook":"餐館料理台","tailor":"工房裁縫台","researcher":"研究桌"}.get(job,"工房工作台")
static func slots(layout: TownLayout,zone: Dictionary,limit: int) -> Array[Vector2i]:
	var result: Array[Vector2i]=[]
	var xs: Array=range(int(zone.x)+1,int(zone.x+zone.w)-1)
	var center: float=float(zone.x)+float(zone.w)/2
	xs.sort_custom(func(a,b):return absf(float(a)+.5-center)<absf(float(b)+.5-center))
	for x in xs:
		var y:=int(zone.y)
		var point:=Vector2((x+.5)*16,(y+.5)*16)
		if layout._walkable(point): continue
		if Vector2(zone.doorPixelX,zone.doorPixelY).distance_to(point)<32: continue
		result.append(Vector2i(x,y))
		if result.size()>=limit: break
	return result
static func resolve(layout: TownLayout,job: String) -> Dictionary:
	if job not in JOBS or not layout.buildings.has(LOCATIONS[job]): return {}
	var zone: Dictionary=layout.buildings[LOCATIONS[job]]
	if not zone.has("doorPixelX"): return {}
	var columns:=slots(layout,zone,3)
	if job=="tailor": columns=columns.slice(1,2)
	else: columns=columns.slice(0,1)
	for column in columns:
		for y in range(column.y,int(zone.y+zone.h)-1):
			var cell:=Vector2i(column.x,y)
			var bench:=Vector2(float(cell.x)+.5,float(cell.y)+.5)
			var stand: Vector2=(bench+Vector2(.32 if job in HAMMER_JOBS or job=="researcher" else 0,.72 if job=="tailor" else .82))*16
			if not layout._walkable(bench*16) and layout._walkable(stand): return {"bench":bench,"stand":stand,"cell":cell}
	return {}
static func error(m: SimMotion,job: String) -> String:
	if job not in JOBS or m==null: return ""
	var station:=resolve(m.layout,job)
	if station.is_empty(): return "目前沒有可使用的"+label(job)+"。"
	var p: Dictionary=m.positions.get("player",{})
	if p.is_empty(): return "尚未取得旅人的位置。"
	if p.get("doorPhase")!=null or SimCareerPresence.at_threshold(m,"player"): return "請先走過門口，再到"+label(job)+"標記。"
	if Vector2(p.x,p.y).distance_to(station.stand)>2: return "請操作旅人走到"+label(job)+"的圓形標記；離開標記會中止值勤。"
	return ""

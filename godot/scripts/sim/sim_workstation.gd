class_name SimWorkstation
extends RefCounted
const JOBS := ["carpenter","blacksmith"]
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
	if job not in JOBS or not layout.buildings.has("workshop"): return {}
	var zone: Dictionary=layout.buildings.workshop
	if not zone.has("doorPixelX"): return {}
	for column in slots(layout,zone,3):
		for y in range(column.y,int(zone.y+zone.h)-1):
			var cell:=Vector2i(column.x,y)
			var bench:=Vector2(float(cell.x)+.5,float(cell.y)+.5)
			var stand: Vector2=(bench+Vector2(.32,.82))*16
			if not layout._walkable(bench*16) and layout._walkable(stand): return {"bench":bench,"stand":stand,"cell":cell}
	return {}
static func error(m: SimMotion,job: String) -> String:
	if job not in JOBS or m==null: return ""
	var station:=resolve(m.layout,job)
	if station.is_empty(): return "目前沒有可使用的工房工作台。"
	var p: Dictionary=m.positions.get("player",{})
	if p.is_empty(): return "尚未取得旅人的位置。"
	if p.get("doorPhase")!=null or SimCareerPresence.at_threshold(m,"player"): return "請先走進工房，再到工作台標記。"
	if Vector2(p.x,p.y).distance_to(station.stand)>2: return "請操作旅人走到工房工作台的圓形標記；離開標記會中止值勤。"
	return ""

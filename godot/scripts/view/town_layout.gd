class_name TownLayout
extends RefCounted
## View-only reconstruction of PixelTileMap. Never edits the save dictionary.
var grid: Array = []
var buildings: Dictionary = {}
var houses: Dictionary = {}
var nature: Dictionary = {}
var labels: Dictionary = {}
var agent_house: Dictionary = {}
var partners: Dictionary = {}
var agent_positions: Dictionary = {}
var factory_plots: Array = []
var decorations: Array = []
var projects: Array = []
var completed: Array = []
var coach := {"x":73,"y":18,"w":5,"h":5}
var extra_count := 0
var rules: Dictionary

func rebuild(save: Dictionary) -> void:
	rules = JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/layout_rules.json"))
	grid = rules.base.duplicate(true)
	for y in 60:
		for x in 80: grid[y][x] = int(grid[y][x])
	buildings.clear(); houses.clear(); nature.clear(); labels.clear(); agent_house.clear(); partners.clear(); agent_positions.clear(); factory_plots.clear()
	extra_count = 0
	for id in save.townMap.locations:
		if not rules.rules.has(id): continue
		var recipe: Dictionary = rules.rules[id]
		for op in recipe.ops:
			if op[0] == "road": _road(int(op[1]),int(op[2]))
			else: _set_tile(int(op[1]),int(op[2]),int(op[3]),bool(op[4]))
		buildings.merge(recipe.buildings.duplicate(true),true)
		houses.merge(recipe.houses.duplicate(true),true)
		nature.merge(recipe.nature.duplicate(true),true)
		labels.merge(recipe.labels.duplicate(true),true)
		if labels.has(id): labels[id].name = save.townMap.locations[id].get("name",id)
	for i in 30:
		var x := 3 + ((i*17+7)%74)
		var y := 4 + ((i*13+11)%52)
		if grid[y][x] in [0,1,2]: grid[y][x] = [22,23,24,25][i%4]
	decorations = save.get("decorations",[])
	projects = save.get("buildings",{}).get("projects",[]).filter(func(p): return p.has("siteX") and p.siteX != null)
	completed = save.get("buildings",{}).get("completed",[]).filter(func(p): return p.has("siteX") and p.siteX != null)
	_sync_housing(save.agents)
	_place_agents(save.agents)

func _set_tile(x: int,y: int,tile: int,only_grass := false) -> void:
	if x<0 or y<0 or x>=80 or y>=60: return
	if not only_grass or grid[y][x] in [0,1,2]: grid[y][x]=tile

func _road(x: int,y: int) -> void:
	var distances := [absi(y-20),absi(y-38),absi(x-26),absi(x-46)]
	var nearest: int = distances.min()
	if nearest == distances[0] or nearest == distances[1]:
		var target := 20 if nearest == distances[0] else 38
		for py in range(y,target,1 if target>y else -1): _set_tile(x,py,3,true)
	else:
		var target := 26 if nearest == distances[2] else 46
		for px in range(x,target,1 if target>x else -1): _set_tile(px,y,3,true)

func _rects() -> Array:
	var rects := buildings.values().duplicate(true)
	rects.append(coach)
	for p in projects + completed: rects.append({"x":p.siteX,"y":p.get("siteY",0),"w":2,"h":2})
	for d in decorations: rects.append({"x":d.x,"y":d.y,"w":1,"h":1})
	return rects

func _overlap(x: int,y: int,w: int,h: int,rects: Array) -> bool:
	for zone in rects:
		if x+w+1>zone.x and x-1<zone.x+zone.get("w",4) and y+h+1>zone.y and y-1<zone.y+zone.get("h",4): return true
	return false

func _clear(x: int,y: int,w: int,h: int) -> bool:
	for py in range(y-1,y+h+1):
		for px in range(x-1,x+w+1):
			if py<1 or px<1 or py>=59 or px>=79 or grid[py][px] in [3,10,11]: return false
	return true

func _factory_plots() -> void:
	var zones := _rects()
	var anchor: Dictionary = buildings.get("workshop",buildings.get("town_square",{"x":40,"y":30,"w":4,"h":4}))
	var ax: float = anchor.x+float(anchor.w)/2
	var ay: float = anchor.y+float(anchor.h)/2
	var candidates: Array = []
	var order := 0
	for y in range(2,55,2):
		for x in range(2,74,2):
			candidates.append([x,y,pow(x+2-ax,2)+pow(y+1.5-ay,2),order])
			order+=1
	candidates.sort_custom(func(a,b): return a[2]<b[2] if a[2]!=b[2] else a[3]<b[3])
	for candidate in candidates:
		if factory_plots.size()>=7: break
		var x: int=candidate[0]; var y: int=candidate[1]
		if _overlap(x,y,4,3,zones) or not _clear(x,y,4,3): continue
		var plot := {"x":x,"y":y,"w":4,"h":3}
		factory_plots.append(plot)
		zones.append(plot)

func _sync_housing(agents: Dictionary) -> void:
	var npcs: Array = []
	var by_name: Dictionary = {}
	for id in agents:
		var a: Dictionary = agents[id]
		if not a.get("isPlayer",false) and not a.get("isDead",false) and not str(id).begins_with("visit_"):
			npcs.append(id)
			by_name[a.get("name",id)] = id
	var couples: Dictionary = {}
	for id in npcs:
		for relationship in agents[id].get("relationships",{}).values():
			if relationship.get("status") == "married":
				var pid: String = by_name.get(relationship.get("targetName",""),"")
				if not pid.is_empty() and pid != id:
					partners[id]=pid
					var pair: Array = [id,pid]; pair.sort()
					couples["|".join(pair)] = true
				break
	var needed := npcs.size()-couples.size()+1
	# Factory plots are cached before extra housing, exactly as ensureHouseCapacity.
	if houses.size() < needed:
		_factory_plots()
		var rects := _rects()
		rects.append_array(factory_plots)
		for y in range(2,49,2):
			for x in range(2,70,2):
				if houses.size()>=needed: break
				if _overlap(x,y,8,9,rects) or not _clear(x,y,8,9): continue
				_extra_house(x+1,y+1)
				rects.append({"x":x,"y":y,"w":8,"h":9})
	if factory_plots.is_empty(): _factory_plots()

func _extra_house(x: int,y: int) -> void:
	extra_count+=1
	var house: Dictionary=rules.house
	for rx in 6: _set_tile(x+rx,y,15)
	for ty in 5:
		for tx in 6: _set_tile(x+tx,y+ty+1,int(house.tiles[ty][tx]))
	var dx:=x+3; var dy:=y+6
	for oy in 2:
		for ox in range(-1,2): _set_tile(dx+ox,dy+oy,3,true)
	_road(dx,dy)
	var id:="residential_extra_%d"%extra_count
	var zone:={"x":x,"y":y,"w":6,"h":6,"doorPixelX":(dx+.5)*16,"doorPixelY":(dy+.5)*16,"parentLocId":"residential_extra"}
	buildings[id]=zone
	houses[id]=zone.duplicate(true)
	houses[id].merge({"interiorX":(x+3)*16,"interiorY":(y+3.5)*16,"houseIndex":extra_count})

func _house_id(id: String,location: String) -> String:
	if not location.begins_with("residential_"): return ""
	var options: Array = houses.keys().filter(func(key): return houses[key].parentLocId == location)
	if options.is_empty(): return ""
	var partner: String=partners.get(id,"")
	if agent_house.has(partner):
		if not agent_house.has(id) or (agent_house[id]!=agent_house[partner] and id>partner): agent_house[id]=agent_house[partner]
	if agent_house.has(id): return agent_house[id]
	var occupied := agent_house.values()
	var target := ""
	for key in options:
		if key not in occupied: target=key; break
	if target.is_empty():
		for key in houses:
			if key not in occupied: target=key; break
	if target.is_empty():
		target=options[0]
		for key in options:
			if occupied.count(key)<occupied.count(target): target=key
	agent_house[id]=target
	return target

func _walkable(point: Vector2) -> bool:
	var x:=int(floor(point.x/16)); var y:=int(floor(point.y/16))
	return x>=0 and y>=0 and x<80 and y<60 and grid[y][x] not in [5,6,41,15,16,17,18]

func _nearest(point: Vector2) -> Vector2:
	if _walkable(point): return point
	for r in range(1,11):
		for dy in range(-r,r+1):
			for dx in range(-r,r+1):
				if absi(dx)!=r and absi(dy)!=r: continue
				var candidate := point+Vector2(dx*16,dy*16)
				if _walkable(candidate): return candidate
	return point

func _center(location: String) -> Vector2:
	var zone: Dictionary=buildings.get(location,nature.get(location,{}))
	if zone.is_empty(): return Vector2(640,480)
	return Vector2((zone.x+float(zone.w)/2)*16,(zone.y+float(zone.h)/2)*16)

func _place_agents(agents: Dictionary) -> void:
	var targets: Array[Vector2]=[]
	for id in agents:
		var location: String=agents[id].get("currentLocation","")
		var point: Vector2
		var hid:=""
		if location.begins_with("residential_"):
			hid=_house_id(id,location)
			if not hid.is_empty():
				var offset:=str(id).unicode_at(0)%4
				point=Vector2(houses[hid].interiorX+(offset%2-.5)*16,houses[hid].interiorY+(floori(offset/2.0)-.5)*16)
			else: point=_center(location)
		else:
			point=_center(location)
			var count:=0
			for other in targets:
				if absf(other.x-point.x)<48 and absf(other.y-point.y)<48: count+=1
			point+=Vector2((count%4-1.5)*16,(floori(count/4.0)-.5)*16)
		point=_nearest(point)
		targets.append(point)
		var door: Dictionary=houses.get(location,{})
		if door.is_empty() and not hid.is_empty(): door=houses[hid]
		if door.is_empty(): door=buildings.get(location,{})
		if door.has("doorPixelX"): point=Vector2(door.doorPixelX,door.doorPixelY)
		agent_positions[id]={"x":point.x,"y":point.y}

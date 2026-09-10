class_name BuildingSites
extends RefCounted
static func allowed(save: Dictionary,site: Vector2i,footprint: int=2) -> bool:
	var layout:=TownLayout.new();layout.rebuild(save)
	if site.x<2 or site.y<2 or site.x>76 or site.y>56: return false
	if not layout._clear(site.x,site.y,footprint,footprint): return false
	var zones:=reserved(layout,save)
	if layout._overlap(site.x,site.y,footprint,footprint,zones): return false
	for y in range(site.y,site.y+footprint):
		for x in range(site.x,site.x+footprint):
			if layout.grid[y][x] not in [0,1,2]: return false
	return true
static func candidates(save: Dictionary,footprint: int=2) -> Array[Vector2i]:
	var result: Array[Vector2i]=[]
	# A single layout keeps candidate enumeration cheap.
	var layout:=TownLayout.new();layout.rebuild(save)
	var zones:=reserved(layout,save)
	for y in range(2,57,2):
		for x in range(2,77,2):
			if not layout._clear(x,y,footprint,footprint) or layout._overlap(x,y,footprint,footprint,zones): continue
			var clear:=true
			for py in range(y,y+footprint):
				for px in range(x,x+footprint):
					if layout.grid[py][px] not in [0,1,2]: clear=false
			if clear: result.append(Vector2i(x,y))
	result.sort_custom(func(a,b): return a.distance_squared_to(Vector2i(40,30))<b.distance_squared_to(Vector2i(40,30)) if a.distance_squared_to(Vector2i(40,30))!=b.distance_squared_to(Vector2i(40,30)) else (a.y<b.y if a.y!=b.y else a.x<b.x))
	return result

static func reserved(layout: TownLayout,save: Dictionary) -> Array:
	var zones:=layout._rects();zones.append_array(layout.factory_plots)
	var anchors: Dictionary={"watchtower":["guardpost",-2,-2],"granary":["farm",8,-1],"marketplace":["town_square",9,-1],"well_upgrade":["well",0,-1],"training_ground":["guardpost",7,0],"brewery":["tavern",-3,-1],"garden":["clinic",-3,-1],"school":["library",-3,0],"farm_irrigation":["farm",-2,5],"forge_bellows":["workshop",-3,-1],"clinic_upgrade":["clinic",6,-1],"town_walls":["town_square",-5,-3]}
	for p in save.buildings.completed:
		if p.get("siteX")!=null: continue
		var key: String=p.get("buildingKey",p.get("key",""))
		if not anchors.has(key): continue
		var anchor: Array=anchors[key];var zone: Dictionary=layout.buildings.get(anchor[0],layout.nature.get(anchor[0],{}))
		if not zone.is_empty(): zones.append({"x":zone.x+anchor[1],"y":zone.y+anchor[2],"w":2,"h":2})
	return zones

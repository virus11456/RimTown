class_name SimResidentField
extends RefCounted
# Imported legacy farms include a farmhouse and fenced crop beds in one zone.
# Farmers work at a crop bed, rather than the generic zone center inside the house.
static func destination(layout: TownLayout,a: Dictionary,agents: Dictionary={}) -> Dictionary:
	var job: String=a.get("jobKey","")
	var location: String="quarry" if job=="miner" else "farm"
	if job not in ["farmer","miner"] or a.get("currentLocation","")!=location or a.get("activity","")!="working" or a.get("_serviceStay",false): return {}
	for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
		if a.get(key,"")==location: return {}
	if job=="miner":
		var quarry: Dictionary=layout.buildings.get("quarry",{})
		if quarry.is_empty(): return {}
		var stand:=Vector2((quarry.x+quarry.w/2+.5)*16,(quarry.y+quarry.h-.5)*16)
		return {"target":stand,"key":"field:quarry"} if layout._walkable(stand) else {}
	if layout.work_sites.has("farm") or not layout.buildings.has("farm"): return {}
	var zone: Dictionary=layout.buildings.farm
	var candidates: Array[Vector2]=[]
	for y in range(int(zone.y),int(zone.y+zone.h)):
		for x in range(int(zone.x),int(zone.x+zone.w)):
			if y<0 or y>=layout.grid.size() or x<0 or x>=layout.grid[y].size() or layout.grid[y][x] not in [19,20,21]: continue
			var point:=Vector2((x+.5)*16,(y+.5)*16)
			if layout._walkable(point): candidates.append(point)
	if candidates.is_empty(): return {}
	var center:=layout._center("farm")
	candidates.sort_custom(func(left,right):return left.distance_squared_to(center)<right.distance_squared_to(center))
	var workers: Array=[]
	for id in agents:
		var worker: Dictionary=agents[id]
		if id=="player" or worker.get("jobKey","")!="farmer" or worker.get("activity","")!="working" or worker.get("currentLocation","")!="farm" or worker.get("_serviceStay",false): continue
		var social:=false
		for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
			if worker.get(key,"")=="farm": social=true
		if not social: workers.append(id)
	workers.sort()
	var rank:=maxi(0,workers.find(a.get("id","")))
	return {} if rank>=candidates.size() else {"target":candidates[rank],"key":"field:farm:"+str(a.get("id",""))}

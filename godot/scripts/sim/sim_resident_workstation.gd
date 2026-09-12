class_name SimResidentWorkstation
extends RefCounted
# Ephemeral spatial assignment. Never grants work, spends stock or awards output.
static func eligible(a: Dictionary) -> bool:
	var location: String=a.get("currentLocation","")
	if a.get("activity","")!="working" or a.get("_serviceStay",false): return false
	if SimWorkstation.LOCATIONS.get(a.get("jobKey",""),"")!=location: return false
	for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
		if a.get(key,"")==location: return false
	return true

static func assignments(layout: TownLayout,agents: Dictionary,positions: Dictionary) -> Dictionary:
	var result: Dictionary={};var occupied: Dictionary={}
	var ids: Array=agents.keys();ids.sort()
	for id in ids:
		if id=="player" or not eligible(agents[id]): continue
		var job: String=agents[id].get("jobKey","")
		var station:=SimWorkstation.resolve(layout,job)
		if station.is_empty(): continue
		var key:=str(station.cell)
		var stand: Vector2=station.stand
		var player: Dictionary=positions.get("player",{})
		var reserved: bool=not player.is_empty() and Vector2(player.x,player.y).distance_to(stand)<24
		var waiting: bool=reserved or occupied.has(key)
		var target:=stand
		if waiting:
			# Keep waiting workers clear of all benches and the player's work area.
			var found:=false
			for offset in [Vector2(0,32),Vector2(16,32),Vector2(-16,32),Vector2(0,48),Vector2(32,32),Vector2(-32,32)]:
				var candidate: Vector2=stand+offset
				if not layout._walkable(candidate): continue
				var clear:=true
				for other in result.values():
					if candidate.distance_to(other.target)<12: clear=false
				if clear: target=candidate;found=true;break
			if not found: continue # No safe waiting space: retain ordinary routing.
		else: occupied[key]=id
		result[id]={"job":job,"stand":stand,"target":target,"working":not waiting,"key":"station:"+key+(":wait:"+str(id) if waiting else ":work")}
	return result

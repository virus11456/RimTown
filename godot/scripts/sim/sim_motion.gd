class_name SimMotion
extends RefCounted
# Source uses 0.3 px per rendered frame. Drive this port at a fixed 60 Hz.
var layout: TownLayout
var pathfinder:=SimPath.new()
var positions: Dictionary={}
var manual_player := false
func configure(value: TownLayout) -> void:
	layout=value
	pathfinder.grid=layout.grid
	positions.clear()
	manual_player=false
func door(location: String,id: String) -> Variant:
	var zone: Dictionary=layout.houses.get(location,{})
	if zone.is_empty() and location.begins_with("residential_"):
		zone=layout.houses.get(layout._house_id(id,location),{})
	if zone.is_empty(): zone=layout.buildings.get(location,{})
	return {"x":zone.doorPixelX,"y":zone.doorPixelY} if zone.has("doorPixelX") else null
func inside(point: Vector2) -> String:
	for zones in [layout.houses,layout.buildings]:
		for id in zones:
			var z: Dictionary=zones[id]
			if zones==layout.buildings and z.has("parentLocId"): continue
			if point.x>=z.x*16 and point.x<=(z.x+z.w)*16 and point.y>=z.y*16 and point.y<=(z.y+z.h)*16: return id
	return ""
func _path(p: Dictionary) -> void:
	p._pathWaypoints=pathfinder.find_path(Vector2(p.x,p.y),Vector2(p.targetX,p.targetY))
	p._pathIdx=0
func _set_point(p: Dictionary,value: Vector2) -> void:
	p.x=value.x; p.y=value.y
func update(agents: Dictionary,chat_target: String="") -> void:
	for id in agents:
		if id=="player" and manual_player: continue
		var a: Dictionary=agents[id]
		var location: String=a.currentLocation
		var target: Vector2
		if location.begins_with("residential_"):
			var hid:=layout._house_id(id,location)
			if layout.houses.has(hid):
				var sub: Dictionary=layout.houses[hid]
				var offset:=str(id).unicode_at(0)%4
				target=Vector2(sub.interiorX+(offset%2-.5)*16,sub.interiorY+(floori(offset/2.0)-.5)*16)
			else: target=layout._center(location)
		else:
			target=layout._center(location)
			var count:=0
			for p in positions.values():
				if absf(p.targetX-target.x)<48 and absf(p.targetY-target.y)<48: count+=1
			target+=Vector2((count%4-1.5)*16,(floori(count/4.0)-.5)*16)
		target=layout._nearest(target)
		var activity: String=a.get("activity","")
		if not positions.has(id):
			var destination: Variant=door(location,id)
			positions[id]={"x":destination.x if destination!=null else target.x,"y":destination.y if destination!=null else target.y,"targetX":target.x,"targetY":target.y,"walking":true,"walkStep":0,"activity":activity,"doorPhase":"entering" if destination!=null else null,"_pathWaypoints":[],"_pathIdx":0}
			continue
		var p: Dictionary=positions[id]
		p.activity=activity
		if activity!="sleeping" and p.get("_slpOut",0): p._slpOut=0
		if activity=="sleeping":
			if not p.walking and not inside(Vector2(p.x,p.y)).is_empty():
				p.walkStep=0; p._slpOut=0; continue
			p._slpOut=p.get("_slpOut",0)+1
			if not p.walking or p._slpOut>600:
				var home: String=a.get("homeLocation","")
				if not home.begins_with("residential_"): home=location if location.begins_with("residential_") else ""
				var house: Dictionary=layout.houses.get(layout._house_id(id,home),{}) if not home.is_empty() else {}
				if house.is_empty():
					var distance:=INF
					for candidate in layout.houses.values():
						var d:=Vector2(candidate.interiorX-p.x,candidate.interiorY-p.y).length()
						if d<distance: distance=d; house=candidate
				if not house.is_empty():
					p.x=house.interiorX+(str(id).unicode_at(0)%3-1)*4
					p.y=house.interiorY+((str(id).unicode_at(1) if str(id).length()>1 else 0)%3-1)*4
					p.targetX=p.x; p.targetY=p.y; p.walkStep=0; p.doorPhase=null; p.walking=false; p._slpOut=0
					continue
		var changed:=absf(target.x-p.targetX)>32 or absf(target.y-p.targetY)>32
		if changed:
			var dest: Variant=door(location,id)
			var building:=inside(Vector2(p.x,p.y))
			var current_door: Variant=door(building,id) if not building.is_empty() else null
			if current_door!=null and dest!=null:
				p.doorPhase="exiting"; p.doorWaypoint=current_door; p.finalTarget={"x":target.x,"y":target.y}; p.destDoor=dest
				p.targetX=current_door.x; p.targetY=current_door.y
			elif dest!=null:
				p.doorPhase="approaching"; p.doorWaypoint=dest; p.finalTarget={"x":target.x,"y":target.y}
				p.targetX=dest.x; p.targetY=dest.y
			else:
				p.doorPhase=null; p.targetX=target.x; p.targetY=target.y
			_path(p)
		elif p.doorPhase==null and (absf(target.x-p.targetX)>1 or absf(target.y-p.targetY)>1):
			p.targetX=target.x; p.targetY=target.y; _path(p)
		if not layout._walkable(Vector2(p.x,p.y)):
			_set_point(p,layout._nearest(Vector2(p.x,p.y))); p._pathWaypoints=[]
		var far:=absf(p.targetX-p.x)+absf(p.targetY-p.y)>32
		var trapped:=inside(Vector2(p.x,p.y)) if activity!="sleeping" and far else ""
		if not trapped.is_empty():
			p._inStuck=p.get("_inStuck",0)+1
			if p._inStuck>360:
				var exit_door: Variant=door(trapped,id)
				_set_point(p,layout._nearest(Vector2(exit_door.x,exit_door.y+16) if exit_door!=null else Vector2(p.x,p.y)))
				p.doorPhase=null; p.destDoor=null; p.doorWaypoint=null; _path(p); p._inStuck=0
		elif p.get("_inStuck",0): p._inStuck=0
		var destination:=Vector2(p.targetX,p.targetY)
		var waypoints: Array=p.get("_pathWaypoints",[])
		if not waypoints.is_empty() and p.get("_pathIdx",0)<waypoints.size():
			destination=Vector2(waypoints[p._pathIdx].x,waypoints[p._pathIdx].y)
		var delta:=destination-Vector2(p.x,p.y)
		var distance:=delta.length()
		if not chat_target.is_empty() and id in [chat_target,"player"]:
			p.walking=false; p.walkStep=0
		elif distance>1:
			var movement:=delta/distance*minf(.3,distance)
			var next:=Vector2(p.x,p.y)+movement
			if not layout._walkable(next):
				if layout._walkable(Vector2(p.x+movement.x,p.y)): next=Vector2(p.x+movement.x,p.y)
				elif layout._walkable(Vector2(p.x,p.y+movement.y)): next=Vector2(p.x,p.y+movement.y)
				else:
					_set_point(p,layout._nearest(Vector2(p.targetX,p.targetY)))
					p.walking=false; p.walkStep=0; p._pathWaypoints=[]; continue
			_set_point(p,next); p.walking=true; p.walkStep=p.get("walkStep",0)+1
			p.facing=1 if delta.x>0 else -1 if delta.x<0 else p.get("facing",1)
			p.dir4=("down" if delta.y>0 else "up") if absf(delta.y)>absf(delta.x)*1.4 else "side"
		else:
			_set_point(p,destination)
			if not waypoints.is_empty() and p.get("_pathIdx",0)<waypoints.size()-1:
				p._pathIdx+=1; p.walking=true
			elif p.doorPhase=="exiting" and p.get("destDoor")!=null:
				p.doorPhase="approaching"; p.doorWaypoint=p.destDoor
				p.targetX=p.destDoor.x; p.targetY=p.destDoor.y; p.destDoor=null; _path(p)
			elif p.doorPhase=="approaching" and p.get("finalTarget")!=null:
				p.doorPhase="entering"; p.targetX=p.finalTarget.x; p.targetY=p.finalTarget.y
				p.finalTarget=null; p.doorWaypoint=null; p._pathWaypoints=[]
			else:
				p.doorPhase=null; p.walking=false; p.walkStep=0; p._pathWaypoints=[]
	for id in positions.keys():
		if not agents.has(id): positions.erase(id)

func move_player(direction: Vector2,delta: float) -> bool:
	if not positions.has("player"): return false
	var p: Dictionary=positions.player
	if direction.is_zero_approx():
		if manual_player: p.walking=false; p.walkStep=0
		return false
	manual_player=true
	var movement:=direction.limit_length()*72.0*clampf(delta,0,.05)
	var previous:=Vector2(p.x,p.y)
	# Axis-separated collision allows sliding along walls. Step <= 3.6 px < one tile.
	var nx:=clampf(float(p.x)+movement.x,4,1276)
	var ny:=clampf(float(p.y)+movement.y,4,956)
	if layout._walkable(Vector2(nx,p.y)): p.x=nx
	if layout._walkable(Vector2(p.x,ny)): p.y=ny
	p.targetX=p.x; p.targetY=p.y
	p._pathWaypoints=[]; p._pathIdx=0
	p.doorPhase=null; p.destDoor=null; p.doorWaypoint=null; p.finalTarget=null
	var moved:=Vector2(p.x,p.y).distance_squared_to(previous)>.00000001
	p.walking=moved
	p.walkStep=p.get("walkStep",0)+1 if moved else 0
	p.activity="wandering"
	if movement.x!=0: p.facing=1 if movement.x>0 else -1
	p.dir4=("down" if movement.y>0 else "up") if absf(movement.y)>absf(movement.x)*1.4 else "side"
	return moved

func location_at(point: Vector2) -> String:
	var best:=""
	var area:=INF
	for id in layout.buildings:
		var zone: Dictionary=layout.buildings[id]
		if point.x>=zone.x*16 and point.x<(zone.x+zone.w)*16 and point.y>=zone.y*16 and point.y<(zone.y+zone.h)*16:
			if zone.w*zone.h<area: best=id; area=zone.w*zone.h
	if not best.is_empty(): return best
	for id in layout.nature:
		var zone: Dictionary=layout.nature[id]
		if point.x>=zone.x*16 and point.x<(zone.x+zone.w)*16 and point.y>=zone.y*16 and point.y<(zone.y+zone.h)*16: return id
	return ""

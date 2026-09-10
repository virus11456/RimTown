class_name SimHangoutRoute
extends RefCounted
# Travel budgets follow the motion clock and reserve room for door/waypoint transitions.
static func segment(m: SimMotion,start: Vector2,finish: Vector2) -> float:
	if not m.layout._walkable(start) or not m.layout._walkable(finish): return INF
	var path:=m.pathfinder.find_path(start,finish)
	if path.is_empty() and Vector2i(floori(start.x/16),floori(start.y/16))!=Vector2i(floori(finish.x/16),floori(finish.y/16)): return INF
	var total:=0.0;var previous:=start
	for point in path:
		var next:=Vector2(point.x,point.y);total+=previous.distance_to(next);previous=next
	return total+previous.distance_to(finish)
static func distance(m: SimMotion,id: String,place: String) -> float:
	if m==null or not m.positions.has(id): return INF
	var p: Dictionary=m.positions[id];var start:=Vector2(p.x,p.y)
	var goal:=m.layout._nearest(m.layout._center(place));var destination: Variant=m.door(place,id)
	if destination==null: return segment(m,start,goal)
	var exit_door: Variant=m.door(m.inside(start),id)
	var total:=0.0
	if exit_door!=null:
		var exit_point:=Vector2(exit_door.x,exit_door.y)
		total+=segment(m,start,exit_point);start=exit_point
	var door_point:=Vector2(destination.x,destination.y)
	return total+segment(m,start,door_point)+segment(m,door_point,goal)
static func feasible(m: SimMotion,a: Dictionary,b: Dictionary,clock: Dictionary,jobs: Dictionary,spots: Array) -> Array:
	if m==null: return []
	var result: Array=[]
	for place in spots:
		var length:=maxf(distance(m,str(a.id),place),distance(m,str(b.id),place))
		if is_inf(length): continue
		# Five ticks maximum departure delay, plus two ticks of buffer.
		var required:=5+ceili(length/m.travel_budget(true))+2
		if required>=24: continue # Original meeting deadline is never extended.
		var fits:=true
		for offset in range(required+1):
			var hour:=posmod(floori((int(clock.hour)*60+int(clock.minute)+offset*15)/60.0),24)
			if not SimLeisurePlan.person_available(a,jobs,hour) or not SimLeisurePlan.person_available(b,jobs,hour): fits=false;break
		if fits and m.stable_routes:
			fits=return_fits(m,a,clock,jobs,place,required) and return_fits(m,b,clock,jobs,place,required)
		if fits: result.append(place)
	return result

static func home_distance(m: SimMotion,a: Dictionary,place: String) -> float:
	if m==null or (not m.layout.buildings.has(place) and not m.layout.nature.has(place)): return INF
	var home:=m.layout._house_id(str(a.id),str(a.get("homeLocation","")))
	var house: Dictionary=m.layout.houses.get(home,{})
	if house.is_empty(): return INF # Assigned overflow housing may belong to residential_extra.
	var start:=m.layout._nearest(m.layout._center(place));var length:=0.0
	var exit_door: Variant=m.door(place,str(a.id))
	if exit_door!=null:
		var exit_point:=Vector2(exit_door.x,exit_door.y)
		length+=segment(m,start,exit_point);start=exit_point
	var entry:=Vector2(house.doorPixelX,house.doorPixelY)
	var offset:=str(a.id).unicode_at(0)%4
	var goal:=m.layout._nearest(Vector2(house.interiorX+(offset%2-.5)*16,house.interiorY+(floori(offset/2.0)-.5)*16))
	return length+segment(m,start,entry)+segment(m,entry,goal)
static func return_fits(m: SimMotion,a: Dictionary,clock: Dictionary,jobs: Dictionary,place: String,after_ticks: int) -> bool:
	var length:=home_distance(m,a,place)
	if is_inf(length) or after_ticks<0: return false
	# Return travel uses ordinary 0.3 px/frame walking, not the faster meeting approach.
	var ticks:=ceili(length/m.travel_budget())+1
	if ticks+after_ticks>=96: return false
	for offset in range(after_ticks,after_ticks+ticks+1):
		var hour:=posmod(floori((int(clock.hour)*60+int(clock.minute)+offset*15)/60.0),24)
		if not SimLeisurePlan.person_available(a,jobs,hour): return false
	return true

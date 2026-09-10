class_name SimHangoutRoute
extends RefCounted
# At 1x there are 120 motion frames per game tick, with 0.6 px/frame.
# Budget 60 px/tick to leave room for door and waypoint transitions.
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
		var required:=5+ceili(length/60.0)+2
		if required>=24: continue # Original meeting deadline is never extended.
		var fits:=true
		for offset in range(required+1):
			var hour:=posmod(floori((int(clock.hour)*60+int(clock.minute)+offset*15)/60.0),24)
			if not SimLeisurePlan.person_available(a,jobs,hour) or not SimLeisurePlan.person_available(b,jobs,hour): fits=false;break
		if fits: result.append(place)
	return result

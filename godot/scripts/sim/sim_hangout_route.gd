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
static func feasible(m: SimMotion,a: Dictionary,b: Dictionary,clock: Dictionary,jobs: Dictionary,spots: Array,time_budget: int=24) -> Array:
	if m==null: return []
	var result: Array=[]
	for place in spots:
		var length:=maxf(distance(m,str(a.id),place),distance(m,str(b.id),place))
		if is_inf(length): continue
		# Five ticks maximum departure delay, plus two ticks of buffer.
		var required:=5+ceili(length/m.travel_budget(true))+2
		if required>=time_budget: continue # Original meeting deadline is never extended.
		var fits:=true
		for offset in range(required+1):
			var hour:=posmod(floori((int(clock.hour)*60+int(clock.minute)+offset*15)/60.0),24)
			if not SimLeisurePlan.person_available(a,jobs,hour) or not SimLeisurePlan.person_available(b,jobs,hour): fits=false;break
		if fits and m.stable_routes:
			fits=return_fits(m,a,clock,jobs,place,required) and return_fits(m,b,clock,jobs,place,required)
		if fits: result.append(place)
	return result

static func home_distance(m: SimMotion,a: Dictionary,place: String,origin: Variant=null) -> float:
	if m==null or (not m.layout.buildings.has(place) and not m.layout.nature.has(place)): return INF
	var home:=m.layout._house_id(str(a.id),str(a.get("homeLocation","")))
	var house: Dictionary=m.layout.houses.get(home,{})
	if house.is_empty(): return INF # Assigned overflow housing may belong to residential_extra.
	var start: Vector2=m.layout._nearest(m.layout._center(place)) if origin==null else origin;var length:=0.0
	var exit_door: Variant=m.door(place,str(a.id))
	if exit_door!=null:
		var exit_point:=Vector2(exit_door.x,exit_door.y)
		length+=segment(m,start,exit_point);start=exit_point
	var entry:=Vector2(house.doorPixelX,house.doorPixelY)
	var offset:=str(a.id).unicode_at(0)%4
	var goal:=m.layout._nearest(Vector2(house.interiorX+(offset%2-.5)*16,house.interiorY+(floori(offset/2.0)-.5)*16))
	return length+segment(m,start,entry)+segment(m,entry,goal)
static func return_fits(m: SimMotion,a: Dictionary,clock: Dictionary,jobs: Dictionary,place: String,after_ticks: int,origin: Variant=null) -> bool:
	var length:=home_distance(m,a,place,origin)
	if is_inf(length) or after_ticks<0: return false
	# Return travel uses ordinary 0.3 px/frame walking, not the faster meeting approach.
	var ticks:=ceili(length/m.travel_budget())+1
	if ticks+after_ticks>=96: return false
	for offset in range(after_ticks,after_ticks+ticks+1):
		var hour:=posmod(floori((int(clock.hour)*60+int(clock.minute)+offset*15)/60.0),24)
		if not SimLeisurePlan.person_available(a,jobs,hour): return false
	return true

static func plan(m: SimMotion,a: Dictionary,b: Dictionary,clock: Dictionary,jobs: Dictionary,spots: Array,w: SimWorld=null) -> Dictionary:
	# Leave five countdown ticks before the original sixteen-tick departure deadline.
	for wait_ticks in range(11):
		var future:=clock.duplicate(true)
		var minutes:=int(clock.hour)*60+int(clock.minute)+wait_ticks*15
		future.hour=posmod(minutes/60,24);future.minute=posmod(minutes,60)
		var choices:=feasible(m,a,b,future,jobs,spots,24-wait_ticks)
		if w!=null:
			var start:=int(w.data.tickCount)+wait_ticks
			choices=choices.filter(func(place): return not leisure_conflict(w,str(a.id),start,start+reservation_ticks(m,a,b,place)) and not leisure_conflict(w,str(b.id),start,start+reservation_ticks(m,a,b,place)))
		if not choices.is_empty(): return {"spots":choices,"wait_ticks":wait_ticks,"hour":future.hour,"minute":future.minute}
	return {}

static func reservation_ticks(m: SimMotion,a: Dictionary,b: Dictionary,place: String) -> int:
	var outward:=maxf(distance(m,str(a.id),place),distance(m,str(b.id),place))
	var homeward:=maxf(home_distance(m,a,place),home_distance(m,b,place))
	if is_inf(outward) or is_inf(homeward): return 96
	return 5+ceili(outward/m.travel_budget(true))+2+ceili(homeward/m.travel_budget())+1
static func leisure_conflict(w: SimWorld,id: String,start: int,finish: int) -> bool:
	if not SimLeisurePlan.enabled(w): return false
	var p: Dictionary=SimLeisurePlan.plans(w).get(id,{})
	if not SimLeisurePlan.LIVE.has(p.get("state","")) or not w.data.townMap.locations.has(p.get("place","")): return false
	# Leisure may start walking four hours before its stay. Keep the existing plan intact.
	return start<int(p.until) and finish>=int(p.due)-16

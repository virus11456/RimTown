class_name SimCareerPresence
extends RefCounted
static func room(m: SimMotion,id: String) -> String:
	if not m.positions.has(id): return ""
	var p: Dictionary=m.positions[id]
	for key in m.layout.houses:
		var z: Dictionary=m.layout.houses[key]
		if p.x>=z.x*16 and p.x<(z.x+z.w)*16 and p.y>=z.y*16 and p.y<(z.y+z.h)*16: return key
	return m.location_at(Vector2(p.x,p.y))
static func place(m: SimMotion,id: String) -> String:
	var key:=room(m,id)
	return str(m.layout.houses[key].parentLocId) if m.layout.houses.has(key) else key
static func together(m: SimMotion,a: String,b: String,location: String) -> bool:
	return not location.is_empty() and place(m,a)==location and place(m,b)==location and room(m,a)==room(m,b)

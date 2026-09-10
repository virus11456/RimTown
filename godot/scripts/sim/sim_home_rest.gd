class_name SimHomeRest
extends RefCounted
static func physical(w: SimWorld) -> bool:
	return w.quest_balance.get("hangout_safety_enabled",false) or (w.social.observed_motion!=null and w.social.observed_motion.stable_routes)
static func arrived(w: SimWorld,a: Dictionary) -> bool:
	var m: SimMotion=w.social.observed_motion
	if m==null or not m.positions.has(str(a.id)): return false
	var home:=m.layout._house_id(str(a.id),str(a.homeLocation))
	var p: Dictionary=m.positions[str(a.id)]
	if home.is_empty() or not m.layout.houses.has(home) or not p.has("x") or not p.has("y"): return false
	return SimCareerPresence.room(m,str(a.id))==home and not p.get("walking",true) and p.get("doorPhase") == null
static func apply(w: SimWorld,a: Dictionary) -> void:
	if a.get("isPlayer",false) or not physical(w): return
	if a.activity=="sleeping" and not arrived(w,a):
		a.activity="heading_home"
		# Re-evaluate the home destination even if the previous activity was also heading home.
		a._locationStayRemaining=0

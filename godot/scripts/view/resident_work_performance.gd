class_name ResidentWorkPerformance
extends RefCounted
var phases: Dictionary={}
func update(town: TownView,w: SimWorld,m: SimMotion,delta: float) -> void:
	var assignments:=SimResidentWorkstation.assignments(m.layout,w.data.agents,m.positions)
	for id in town.resident_gaits:
		var actor: Node3D=town.actors[id]
		for side in ["ServiceRight","ServiceLeft"]:
			for tool in actor.get_node("Body/"+side).get_children():
				if tool.has_meta("career_tool"): tool.visible=false
		var p: Dictionary=m.positions.get(id,{})
		var station: Dictionary=assignments.get(id,{})
		var ready: bool=not station.is_empty() and station.working and not p.is_empty()
		if ready:
			ready=not p.get("walking",false) and p.get("doorPhase")==null and Vector2(p.x,p.y).distance_to(station.stand)<=2
		if not ready: phases.erase(id);continue
		phases[id]=float(phases.get(id,0))+maxf(0,delta)
		actor.rotation=Vector3(0,PI,0)
		ServicePerformance.work_pose(town,actor,station.job,phases[id])

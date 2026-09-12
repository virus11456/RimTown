class_name OutdoorWorkPerformance
extends RefCounted
const JOBS := ["farmer","miner"]
static func ready(w: SimWorld,m: SimMotion,id: String) -> bool:
	var a: Dictionary=w.data.agents.get(id,{})
	var p: Dictionary=m.positions.get(id,{})
	if id=="player" or a.get("jobKey","") not in JOBS or p.is_empty(): return false
	if a.get("activity","")!="working" or a.get("_serviceStay",false) or a.get("isDead",false): return false
	var job:=SimWorkSchedule.job(a,w.rules.jobs)
	var location: String=job.get("workplace","")
	if location.is_empty() or not w.data.townMap.locations.has(location) or a.get("currentLocation","")!=location: return false
	for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
		if a.get(key,"")==location: return false
	if p.get("walking",false) or p.get("doorPhase")!=null or p.get("activity","")!="working": return false
	if not m.layout._walkable(Vector2(p.x,p.y)) or SimCareerPresence.place(m,id)!=location: return false
	# A blocked or chat-stopped commuter has not reached their final work point.
	var goal: Dictionary=p.get("_directedGoal",{})
	return goal.get("location","")==location and Vector2(p.x,p.y).distance_to(Vector2(goal.get("x",-9999),goal.get("y",-9999)))<=2

static func pose(town: TownView,actor: Node3D,job: String,phase: float) -> void:
	ServicePerformance.work_pose(town,actor,job,phase)
	var body: Node3D=actor.get_node("Body")
	var right: Node3D=body.get_node("ServiceRight")
	var h: float=body.get_meta("gait_height",1.0)
	if job=="miner":
		var tool: Node3D=right.get_node("acc_tool_pickaxe")
		tool.position=Vector3(0,-.43,-.16)*h;tool.scale=Vector3.ONE*.65*h
	else:
		var tool:=CareerProps.get_prop(right,job,"right")
		tool.position=Vector3(0,-.44,.10)*h
		tool.basis=(right.basis.inverse()*Basis(Vector3.RIGHT,.30+.05*sin(phase*1.4))).scaled(Vector3.ONE*h)

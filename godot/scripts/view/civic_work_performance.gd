class_name CivicWorkPerformance
extends RefCounted
const JOBS := ["guard","trader"]
static func ready(w: SimWorld,m: SimMotion,id: String) -> bool:
	if not OutdoorWorkPerformance.at_work(w,m,id,JOBS): return false
	# Rendering cannot turn a stale "working" label into off-shift duty.
	return SimWorkSchedule.working(SimWorkSchedule.job(w.data.agents[id],w.rules.jobs),int(w.data.clock.hour))

static func pose(town: TownView,actor: Node3D,job: String,phase: float) -> void:
	var body: Node3D=actor.get_node("Body")
	var right: Node3D=body.get_node("ServiceRight")
	var left: Node3D=body.get_node("ServiceLeft")
	if job=="guard":
		# Periodic lookout gesture. Feet and walking remain owned by the gait system.
		var cycle:=fmod(phase,10.0)
		var watch:=smoothstep(0,1.2,cycle)*(1.0-smoothstep(6,8,cycle))
		CareerProps.pose(job,right,left,phase,watch)
		right.rotation.x+=sin(phase*1.3)*.045*watch
	else:
		ServicePerformance.work_pose(town,actor,job,phase)
		var h: float=body.get_meta("gait_height",1.0)
		var ledger:=CareerProps.get_prop(left,job,"left")
		ledger.position=Vector3(0,-.44,.10)*h
		ledger.basis=(left.basis.inverse()*Basis(Vector3.RIGHT,-.2)).scaled(Vector3.ONE*h)

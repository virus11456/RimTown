extends RefCounted
const Render=preload("res://tests/outdoor_pose_fixture.gd")
static func prepare(app: Node,town: String,job: String,age: int=28) -> Dictionary:
	app.load_demo(town);app.motion.manual_player=true
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	if job=="doctor" and not w.data.townMap.locations.has("clinic"):
		var site: Vector2i=BuildingSites.candidates(w.data)[0]
		w.data.townMap.locations.clinic={"id":"clinic","name":"受控醫護作業點","category":"work","capacity":2,"x":(site.x+1)*16,"y":(site.y+2.5)*16,"_workSite":{"x":site.x,"y":site.y+2,"w":2,"h":1,"project":"care-test"}}
	var ids: Array=w.data.agents.keys().filter(func(id):return id!="player");ids.sort()
	var provider: String=ids[0];var recipient: String=ids[1]
	for a in w.data.agents.values(): a.activity="idle"
	var a: Dictionary=w.data.agents[provider];var b: Dictionary=w.data.agents[recipient]
	a.jobKey=job;a.age=28;b.jobKey="";b.age=age;b.needs.rest=30;b.needs.hunger=80;b.mood=-20;b.activity="idle"
	w.data.clock.hour=12;w.data.clock.minute=0;w.data.tickCount=48
	app.world_view.display_save(w.snapshot());m.layout=app.world_view.layout;m.pathfinder.grid=m.layout.grid
	a.activity="working";a.currentLocation=w.rules.jobs[job].workplace;b.currentLocation=a.currentLocation
	var center: Vector2=m.layout._center(a.currentLocation);var entrance: Variant=m.door(a.currentLocation,provider)
	var start: Vector2=m.layout._nearest(Vector2(entrance.x,entrance.y+16)) if entrance!=null else m.layout._nearest(center+Vector2(0,48))
	m.positions[provider]={"x":start.x,"y":start.y,"targetX":start.x,"targetY":start.y,"activity":"working","walking":false,"walkStep":0,"doorPhase":null}
	for frame in 3000:
		m.update(w.data.agents)
		if OutdoorWorkPerformance.at_work(w,m,provider,[job]): break
	var pp: Dictionary=m.positions[provider];var patient:=Vector2.ZERO;var found:=false
	for offset in [Vector2(12,0),Vector2(-12,0),Vector2(0,16),Vector2(0,-16),Vector2(24,0)]:
		var point: Vector2=Vector2(pp.x,pp.y)+offset
		if not found and m.layout._walkable(point) and m.location_at(point)==a.currentLocation: patient=point;found=true
	assert(found)
	m.positions[recipient]={"x":patient.x,"y":patient.y,"targetX":patient.x,"targetY":patient.y,"activity":"idle","walking":false,"walkStep":0,"doorPhase":null}
	return {"provider":provider,"recipient":recipient,"job":job}
static func converse(app: Node,pair: Dictionary) -> void:
	var w: SimWorld=app.simulation;var a: Dictionary=w.data.agents[pair.provider];var b: Dictionary=w.data.agents[pair.recipient]
	a._lastInteractionTick=w.data.tickCount
	w.social.converse(a,b,w.data,w.rng,w.rules.jobs)
static func render(app: Node) -> void:
	Render.render(app);app.world_view.resident_care.update(app.world_view,app.simulation,app.motion,1.0/60)

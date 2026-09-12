extends RefCounted
static func prepare(app: Node,town: String,job: String,age: int=28,placed: bool=true) -> String:
	app.load_demo(town);app.motion.manual_player=true
	var w: SimWorld=app.simulation
	if job=="farmer":
		w.data.townMap.locations.farm={"id":"farm","name":"受控農務測試點","category":"work","capacity":2,"x":560,"y":488}
		if placed:
			var site: Vector2i=BuildingSites.candidates(w.data)[0]
			w.data.townMap.locations.farm._workSite={"x":site.x,"y":site.y+2,"w":2,"h":1,"project":"outdoor-test"}
	var ids: Array=w.data.agents.keys().filter(func(id):return id!="player");ids.sort();var id: String=ids[0]
	for a in w.data.agents.values(): a.activity="idle"
	w.data.agents[id].jobKey=job;w.data.agents[id].age=age
	app.world_view.display_save(w.snapshot());app.motion.layout=app.world_view.layout;app.motion.pathfinder.grid=app.motion.layout.grid
	var a: Dictionary=w.data.agents[id];a.activity="working";a.currentLocation=w.rules.jobs[job].workplace
	var center: Vector2=app.motion.layout._center(a.currentLocation)
	var start: Vector2=app.motion.layout._nearest(center+Vector2(0,48))
	app.motion.positions[id]={"x":start.x,"y":start.y,"targetX":start.x,"targetY":start.y,"activity":"working","walking":false,"walkStep":0,"doorPhase":null}
	return id
static func render(app: Node,delta: float=1.0/60) -> void:
	app.world_view.animate_agents(app.motion.positions);app.world_view.animate_resident_gaits(app.motion.positions,delta)
	app.world_view.resident_work.update(app.world_view,app.simulation,app.motion,delta)
static func visible_tools(actor: Node3D) -> Array:
	var result: Array=[]
	for side in ["ServiceRight","ServiceLeft"]:
		for tool in actor.get_node("Body/"+side).get_children():
			if tool.has_meta("career_tool") and tool.visible: result.append(tool)
	return result

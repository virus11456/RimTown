extends RefCounted
static func prepare(app: Node,town: String,kind: String,age: int=28) -> String:
	app.load_demo(town);app.motion.manual_player=true
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	if kind=="post":
		var site: Vector2i=BuildingSites.candidates(w.data)[0]
		w.data.townMap.locations.guardpost={"id":"guardpost","name":"受控瞭望塔作業點","category":"work","capacity":2,"x":(site.x+1)*16,"y":(site.y+2.5)*16,"_workSite":{"x":site.x,"y":site.y+2,"w":2,"h":1,"project":"civic-test"}}
	var job:="trader" if kind=="trader" else "guard"
	var ids: Array=w.data.agents.keys().filter(func(id):return id!="player" and w.data.agents[id].jobKey==job);ids.sort();var id: String=ids[0]
	for a in w.data.agents.values(): a.activity="idle"
	var a: Dictionary=w.data.agents[id];a.age=age
	w.data.clock.hour=23 if kind=="night" else 12
	if job=="guard": a._guardShift="night" if kind=="night" else "day"
	app.world_view.display_save(w.snapshot());m.layout=app.world_view.layout;m.pathfinder.grid=m.layout.grid
	SimWorkSchedule.refresh(w,m)
	a.activity="working";a.currentLocation=SimWorkSchedule.job(a,w.rules.jobs).workplace
	var center: Vector2=m.layout._center(a.currentLocation)
	var entrance: Variant=m.door(a.currentLocation,id)
	var start: Vector2=m.layout._nearest(Vector2(entrance.x,entrance.y+16)) if entrance!=null else m.layout._nearest(center+Vector2(0,48))
	m.positions[id]={"x":start.x,"y":start.y,"targetX":start.x,"targetY":start.y,"activity":"working","walking":false,"walkStep":0,"doorPhase":null}
	return id

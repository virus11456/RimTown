extends RefCounted
static func prepare(app: Node,town: String,job: String) -> Dictionary:
	app.load_demo(town)
	var w: SimWorld=app.simulation
	SimCareers.enroll(w,job)
	if job=="carpenter":
		SimBuildings.start(w,"watchtower");SimGovernance.daily(w);SimGovernance.execute(w,1)
	elif job=="researcher":
		w.data.research.current="fixture"
		w.data.research.projects.fixture={"name":"受控研究","status":"researching","cost":100,"progress":0}
		w.data.stockpile.resources.research_points=0
	else:
		for key in SimCareers.recipe(job).outputs: w.data.stockpile.resources[key]=0
		w.data.stockpile.resources.food=200
		for key in SimCareers.recipe(job).inputs: w.data.stockpile.resources[key]=maxf(20,SimEconomy.amount(w,key))
		SimCareers.request_materials(w,job);SimGovernance.daily(w)
	var tasks:=SimCareers.available(w)
	if tasks.is_empty(): return {}
	var task: Dictionary=tasks[0]
	var z: Dictionary=app.motion.layout.buildings.get(task.location,app.motion.layout.nature.get(task.location,{}))
	app.motion.positions.player.x=(z.x+z.w*.5)*16;app.motion.positions.player.y=(z.y+z.h*.5)*16
	app.motion.positions.player.walking=false;app.motion.positions.player.doorPhase=null
	w.data.agents.player.currentLocation=task.location
	return task

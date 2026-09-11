extends "res://tests/test_careers.gd"
func _initialize() -> void:
	var w:=world();w.governance_enabled=true
	check(SimCareers.enroll(w,"carpenter").ok,"carpenter registration")
	check(SimCareers.available(w).is_empty(),"no approved construction no task")
	SimBuildings.start(w,"watchtower");check(SimCareers.available(w).is_empty(),"proposal alone cannot become work")
	SimGovernance.daily(w);check(SimGovernance.execute(w,1),"mayor approved actual construction")
	var p: Dictionary=w.data.buildings.projects[0];w.data.agents.player.currentLocation="workshop"
	var stock: Dictionary=w.data.stockpile.duplicate(true)
	check(SimCareers.start(w,"build:"+str(p.id)).ok,"work on authorized project")
	finish(w);check(p.workDone==2,"real construction progress")
	check(equal(stock,w.data.stockpile),"prepaid construction labor does not charge twice")
	p.workDone=p.workRequired-1;SimCareers.start(w,"build:"+str(p.id));finish(w)
	check(p.workDone==p.workRequired and SimCareers.available(w).is_empty(),"no surplus work reward")
	SimBuildings.daily(w);check(w.data.buildings.projects.is_empty() and not w.data.buildings.completed.is_empty(),"normal inspection completes real building")
	w=world();SimCareers.enroll(w,"researcher");w.data.agents.player.currentLocation="library"
	w.data.research.projects={"trial":{"key":"trial","name":"研究驗證","status":"researching","progress":0,"cost":10,"effects":{},"prerequisites":[]}}
	w.data.research.current="trial";w.data.stockpile.resources.research_points=8
	check(SimCareers.start(w,"research:trial").ok,"research deficit task")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());finish(w);finish(restored)
	check(equal(w.snapshot(),restored.snapshot()),"research work persists mid-task")
	check(SimEconomy.amount(w,"research_points")==10,"partial batch exactly meets demand")
	check(SimCareers.available(w).is_empty(),"full research demand stops production")
	SimResearch.daily(w);check(w.data.research.projects.trial.progress>0,"notes feed actual research")
	w.data.research.projects.trial.status="researching";w.data.research.current="trial";w.data.research.projects.trial.progress=0;w.data.stockpile.resources.research_points=0
	SimCareers.start(w,"research:trial");w.data.research.current=null;finish(w)
	check(SimEconomy.amount(w,"research_points")==0,"changed research cancels stale commission")
	w=world();SimCareers.enroll(w,"priest");w.data.agents.player.currentLocation="town_square"
	var a: Dictionary=w.data.agents.lin_mei;a.currentLocation="town_square";a.mood=-20;a.activity="wandering"
	check(SimCareers.start(w,"counsel:lin_mei").ok,"low mood request")
	var before: float=w.runtime.lin_mei.moodModifier;finish(w)
	check(w.runtime.lin_mei.moodModifier==before+8,"support modifies durable mood modifier")
	check(not SimCareers.start(w,"counsel:lin_mei").ok,"same resident once per day")
	SimCareers.enroll(w,"doctor");a.needs.rest=20;SimCareers.start(w,"care:lin_mei");finish(w)
	SimCareers.enroll(w,"guard");w.data.agents.player.currentLocation="quarry";SimCareers.start(w,"patrol:quarry");finish(w)
	SimCareers.enroll(w,"priest");check(SimCareers.book(w).used==3,"all six careers share cap")
	for i in 96: w.tick()
	check(SimCareers.book(w).used==0 and SimCareers.book(w).counseled.is_empty(),"real midnight resets daily requests")
	# Legacy save lacking the new field remains playable.
	SimCareers.book(w).erase("counseled");a.currentLocation="town_square";a.mood=-20;a.activity="wandering";w.data.agents.player.currentLocation="town_square"
	check(SimCareers.start(w,"counsel:lin_mei").ok,"old career save migrates lazily");finish(w)
	check(SimCareers.book(w).counseled.has("lin_mei"),"new field persisted")
	var report:={"checks":checks,"failures":failures,"scope":"three additional careers, real authority and progress, research demand and downstream use, mood, cap, midnight, old save compatibility"}
	FileAccess.open("res://docs/CAREER_EXPANSION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

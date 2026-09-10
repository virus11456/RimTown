extends "res://tests/test_careers.gd"
func production_world(job: String) -> SimWorld:
	var w:=world();w.governance_enabled=true;SimCareers.enroll(w,job)
	for key in SimCareers.recipe(job).outputs: w.data.stockpile.resources[key]=0
	w.data.stockpile.resources.food=200
	for key in SimCareers.recipe(job).inputs: w.data.stockpile.resources[key]=maxf(SimEconomy.amount(w,key),20)
	w.data.agents.player.currentLocation=SimCareers.PRODUCTION[job].location
	return w
func _initialize() -> void:
	for job in SimCareers.PRODUCTION:
		var w:=production_world(job);var stock: Dictionary=w.data.stockpile.duplicate(true)
		check(not SimCareers.request_materials(w,job),job+" requires authorization")
		check(equal(stock,w.data.stockpile),job+" proposal costs nothing")
		SimGovernance.daily(w);check(SimCareers.material_permit(w,job),job+" mayor authorizes")
		check(not SimGovernance.execute(w,1) and SimCareers.book(w).active.is_empty(),job+" governance page cannot start remote work")
		check(SimCareers.start(w,"produce:"+job).ok,job+" onsite start")
		check(equal(stock,w.data.stockpile),job+" no upfront spending")
		var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());finish(w);finish(restored)
		check(equal(w.snapshot(),restored.snapshot()),job+" reload completion matches")
		var r:=SimCareers.recipe(job)
		for key in r.inputs: check(is_equal_approx(SimEconomy.amount(w,key),float(stock.resources.get(key,0))-float(r.inputs[key])),job+" exact input "+key)
		for key in r.outputs: check(is_equal_approx(SimEconomy.amount(w,key),float(stock.resources.get(key,0))+float(r.outputs[key])),job+" exact output "+key)
		check(not SimCareers.material_permit(w,job),job+" approval consumed once")
		stock=w.data.stockpile.duplicate(true);finish(w);check(equal(stock,w.data.stockpile),job+" no replay output")
	var w:=production_world("blacksmith");SimCareers.request_materials(w,"blacksmith");SimGovernance.daily(w);SimCareers.start(w,"produce:blacksmith")
	w.data.stockpile.resources.tools=SimSupply.reserve(w,"tools");var stock: Dictionary=w.data.stockpile.duplicate(true);finish(w)
	check(equal(stock,w.data.stockpile) and SimCareers.book(w).used==0,"demand filled mid-work no charge or xp")
	w=production_world("tailor");SimCareers.request_materials(w,"tailor");SimGovernance.daily(w);SimCareers.start(w,"produce:tailor");w.data.stockpile.resources.cloth=0;stock=w.data.stockpile.duplicate(true);finish(w)
	check(equal(stock,w.data.stockpile),"missing materials atomic")
	w=production_world("cook");SimCareers.request_materials(w,"cook");SimGovernance.daily(w);SimCareers.start(w,"produce:cook");var old:=SimGovernance.mayor(w);w.data.agents[old].jobKey="farmer";w.data.agents.lin_mei.jobKey="mayor";stock=w.data.stockpile.duplicate(true);finish(w)
	check(equal(stock,w.data.stockpile) and SimCareers.book(w).used==0,"mayor change invalidates unspent batch")
	w=production_world("cook");w.data.stockpile.resources.food=8;SimCareers.request_materials(w,"cook");SimGovernance.daily(w)
	check(SimCareers.material_permit(w,"cook"),"food shortage allows meal conversion")
	w=production_world("tailor");w.supply_enabled=false;w.data.stockpile.resources.clothing=SimSupply.reserve(w,"clothing")-1
	check(not SimCareers.production_needed(w,"tailor"),"full batches cannot overflow even with balance off")
	w.data.stockpile.resources.clothing=0;w.data.processing.builtFactories.test={"status":"inactive","warehouse":{"clothing":SimSupply.reserve(w,"clothing")}}
	check(not SimCareers.production_needed(w,"tailor"),"warehouse stocks count toward demand")
	# 120 days of repeat production attempts with no demand consumption cannot overfill stock.
	w=production_world("tailor");w.governance_enabled=false;w.data.stockpile.resources.cloth=10000
	for day in 120:
		w.data.clock.day=day+1
		for attempt in 3:
			SimCareers.start(w,"produce:tailor");finish(w)
		check(SimEconomy.amount(w,"clothing")<=SimSupply.reserve(w,"clothing"),"bounded output day "+str(day))
	check(SimCareers.book(w).completed<360,"satisfied demand stops repeat rewards")
	var report:={"checks":checks,"failures":failures,"scope":"four production jobs, single-use public authorization, attendance, save/reload, exact ledger, dynamic demand/material/mayor cancellation, 120-day repeated-attempt stock bound (isolated fixture)"}
	FileAccess.open("res://docs/CAREER_PRODUCTION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

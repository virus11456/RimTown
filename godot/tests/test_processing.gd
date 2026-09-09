extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/processing/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=11456
		var defs:=SimProcessing.rules()
		for key in defs: SimProcessing.build(w,key)
		for day in 70:
			SimProcessing.daily(w)
			if day==10:
				for key in defs: SimProcessing.set_recipe(w,key,defs[key].recipes[int(c.recipeIndex)].id)
			if day==20 and c.mode=="scarce":
				for key in w.data.stockpile.resources: w.data.stockpile.resources[key]=0
			for order in w.data.processing.orders: SimProcessing.fulfill(w,order.id)
			if day==40:
				for key in w.data.processing.builtFactories:
					for r in w.data.processing.builtFactories[key].warehouse.keys(): SimProcessing.transfer(w,key,r,1);SimProcessing.transfer(w,key,r,2,true)
		check(equal(w.data.processing,c.processing),"processing "+str(cases.find(c)))
		check(equal(w.data.stockpile,c.stock),"stock "+str(cases.find(c)))
		check(equal(w.data.messageLog,c.logs),"logs "+str(cases.find(c)))
		check(equal(w.data.dailyNews,c.news),"news")
		for id in c.memories: check(equal(w.data.agents[id].memory,c.memories[id]),"worker memory "+id)
		check(w.rng.state==int(c.rng),"rng")
	var report:={"checks":checks,"failures":failures,"scope":"8 original 70-day scenarios: seven factories, fourteen recipes, construction/autostaff, shortages, no workers, collection/sale, market, orders/expiry and RNG"}
	FileAccess.open("res://docs/PROCESSING_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

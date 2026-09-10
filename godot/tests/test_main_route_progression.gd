extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var w:=SimWorld.new();w.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json")))
	for flag in ["social","raids","elections","governance","population","births","economy","buildings","industry","supply","processing","farm","trade","research","quests"]: w.set(flag+"_enabled",true)
	w.relief_enabled=true;w.kitchen_crops_enabled=true
	w.finale_choice_enabled=true
	var reached:=-1
	for day in 180:
		for p in SimGovernance.book(w).proposals.duplicate():
			if p.status=="approved" and not SimGovernance.execute(w,p.id): SimGovernance.cancel(w,p.id)
		for id in ["yang_feng","sun_yu","lin_mei"]:
			SimPlayerOffline.apply(w,id,"謝謝你，今天辛苦了。")
		for plot in w.data.farm.plots:
			if plot.state=="ready": SimFarm.harvest(w,int(plot.id))
			elif plot.state=="withered": SimFarm.clear(w,int(plot.id))
			elif plot.state=="growing": SimFarm.water(w,int(plot.id))
		if int(w.data.questSystem.harvestCount)<3 and w.data.industry.industries.has("farming"):
			for plot in w.data.farm.plots:
				if plot.state=="empty": SimFarm.till(w,int(plot.id))
				if plot.state=="tilled":
					for crop in SimFarm.rules().crops:
						var def: Dictionary=SimFarm.rules().crops[crop]
						if int(def.reqLevel)==1 and w.data.clock.season in def.seasons: SimFarm.plant(w,int(plot.id),crop);break
					break
		if int(w.data.industry.townLevel)>=3 and w.data.processing.builtFactories.is_empty():
			for factory in SimProcessing.rules():
				if SimBuildings.affordable(w,SimProcessing.rules()[factory].cost): SimProcessing.build(w,factory);break
		if not w.data.industry.industries.has("lumber"): SimIndustry.choose(w,"lumber")
		else:
			for key in ["mining","farming","quarry"]: SimIndustry.choose(w,key)
			if SimGovernance.book(w).proposals.filter(func(p): return p.status in ["pending","approved"]).size()<2:
				var keys: Array=SimBuildings.rules().templates.keys();keys.erase("housing");keys.push_front("housing")
				for key in keys:
					if not SimBuildings.affordable(w,SimBuildings.rules().templates[key].costs): continue
					var sites:=BuildingSites.candidates(w.data)
					if sites.is_empty(): break
					var before: int=SimGovernance.book(w).serial
					SimBuildings.start(w,key,false,sites[0])
					if SimGovernance.book(w).serial>before: break
		for i in 96: w.tick()
		check(SimGovernance.mayor(w)!="player","progression remains traveler")
		check(w.data.stockpile.resources.values().all(func(v): return float(v)>=0),"public resources nonnegative")
		if SimQuests.finale_ready(w,"legend"):
			check(w.data.multiEnding.get("endingTriggered")==null,"reaching finale does not force first route")
			FileAccess.open("res://tests/main-route-ready.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(w.snapshot()))
			check(SimQuests.choose_finale(w,"legend"),"earned legend selected");reached=day+1;break
	check(reached>0,"main route reaches chosen legend without injected conditions")
	check(SimGovernance.book(w).proposals.any(func(p): return p.status=="executed"),"actual approved proposal history")
	var report:={"checks":checks,"failures":failures,"days":reached,"level":w.data.industry.townLevel,"population":w.data.agents.size(),"buildings":w.data.buildings.completed.size(),"raids":SimRaids.book(w).history.size(),"completed_main":w.data.questSystem.completedOrder,"ending":w.data.multiEnding.get("endingTriggered"),"harvests":w.data.questSystem.harvestCount,"scope":"original demo resources, traveler throughout, paid approved construction and industry, no role/backer/budget injection, default material relief enabled; NPC social activity, raids and elections enabled; scripted daily offline conversations, authorized sowing and real growth/harvest plus factory; one main route/legend via simulation APIs, no rendered walking or marriage/all endings"}
	FileAccess.open("res://docs/MAIN_ROUTE_PROGRESSION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

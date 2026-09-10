extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var w:=SimWorld.new();w.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json")))
	for flag in ["governance","population","births","economy","buildings","industry","supply","processing","farm","trade","research","quests"]: w.set(flag+"_enabled",true)
	w.relief_enabled=true;w.kitchen_crops_enabled=true
	var reached:=-1
	for day in 150:
		for p in SimGovernance.book(w).proposals.duplicate():
			if p.status=="approved" and not SimGovernance.execute(w,p.id): SimGovernance.cancel(w,p.id)
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
		if int(w.data.industry.townLevel)>=7: reached=day+1;break
	check(reached>0,"traveler can develop town through real approvals")
	check(SimGovernance.book(w).proposals.any(func(p): return p.status=="executed"),"actual approved proposal history")
	var report:={"checks":checks,"failures":failures,"days":reached,"level":w.data.industry.townLevel,"population":w.data.agents.size(),"buildings":w.data.buildings.completed.size(),"scope":"original demo resources, traveler throughout, paid approved construction and industry, no role/backer/budget injection, default material relief enabled; economy progression only"}
	FileAccess.open("res://docs/GOVERNANCE_PROGRESSION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

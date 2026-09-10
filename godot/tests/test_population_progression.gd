extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var w:=SimWorld.new();w.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json")))
	for flag in ["population","births","economy","buildings","industry","supply","processing","farm","trade","research","quests"]: w.set(flag+"_enabled",true)
	w.relief_enabled=true;w.kitchen_crops_enabled=true
	var milestones: Array=[];var started: Array=[]
	for day in 240:
		var keys: Array=SimBuildings.rules().templates.keys()
		keys.erase("housing");keys.push_front("housing")
		for key in keys:
			var sites:=BuildingSites.candidates(w.data)
			if sites.is_empty(): break
			var p:=SimBuildings.start(w,key,false,sites[0])
			if not p.is_empty(): started.append({"day":day,"key":key})
		for key in ["lumber","mining","farming","commerce"]: SimIndustry.choose(w,key)
		for i in 96: w.tick()
		check(w.data.agents.values().filter(func(a): return not a.isPlayer).size()<=SimPopulation.capacity(w),"natural population bound")
		for resource in w.data.stockpile.resources: check(float(w.data.stockpile.resources[resource])>=0,"no negative public stock")
		if day%30==0: print("progress day ",day+1," level ",w.data.industry.townLevel," buildings ",w.data.buildings.completed.size());milestones.append({"day":day+1,"population":w.data.agents.size(),"buildings":w.data.buildings.completed.size(),"level":w.data.industry.townLevel})
		if int(w.data.industry.townLevel)>=7: break
	check(int(w.data.industry.townLevel)>=7,"natural paid construction and arrivals reach level seven")
	check(w.data.buildings.completed.size()>=18,"eighteen completed buildings without completion injection")
	check(w.data.agents.size()>=35,"thirty-five real residents")
	var report:={"checks":checks,"failures":failures,"milestones":milestones,"started":started,"stock":w.data.stockpile.resources,"finalPopulation":w.data.agents.size(),"finalBuildings":w.data.buildings.completed.size(),"finalLevel":w.data.industry.townLevel,"scope":"unmodified demo resources, normal paid safe-site construction and daily work, gradual arrivals, economy and supply caps enabled, default raw-material relief enabled; economic progression only, no social/ending playthrough"}
	FileAccess.open("res://docs/POPULATION_PROGRESSION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

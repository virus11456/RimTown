extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	for c in JSON.parse_string(FileAccess.get_file_as_string("res://tests/births/immigration.json")):
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=int(c.seed)
		var a:=SimPopulation.spawn(w)
		check(equal(a,c.expected.agents[a.id]),"original immigrant constructor")
		for key in ["events","messageLog","dailyNews"]: check(equal(w.data[key],c.expected[key]),"original "+key)
		for id in w.data.agents: check(equal(w.data.agents[id].memory,c.expected.agents[id].memory),"arrival memories")
		check(w.rng.state==int(c.rng),"immigration RNG")
	var raw: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json"));var w:=SimWorld.new();w.load_snapshot(raw);w.population_enabled=true
	for key in w.data.stockpile.resources: w.data.stockpile.resources[key]=10000
	var before:=w.snapshot();check(SimBuildings.start(w,"housing").is_empty(),"housing requires site");check(equal(before,w.snapshot()),"no charge without site")
	for i in 8:
		var sites:=BuildingSites.candidates(w.data);check(not sites.is_empty(),"room for expansion")
		var wood:=SimEconomy.amount(w,"wood");var project:=SimBuildings.start(w,"housing",false,sites[0])
		check(not project.is_empty() and SimEconomy.amount(w,"wood")==wood-100,"paid repeated housing")
		check(SimPopulation.capacity(w)==mini(40,20+i*3),"construction gives no early capacity")
		project.workDone=project.workRequired;SimBuildings.daily(w)
		check(SimPopulation.homes(w)==i+1,"completed residence counted")
	before=w.snapshot();check(SimBuildings.start(w,"housing",false,BuildingSites.candidates(w.data)[0]).is_empty(),"eight residence limit");check(equal(before,w.snapshot()),"ninth atomic")
	w.quest_balance.target_population=30;w.data.events._usedImmigrantNames=[]
	var pop: int=w.data.agents.size();SimPopulation.daily(w);check(w.data.agents.size()==pop+1,"one arrival per day")
	SimPopulation.daily(w);check(w.data.agents.size()==pop+1,"repeat daily no extra arrival")
	var resumed:=SimWorld.new();resumed.load_snapshot(w.snapshot());SimPopulation.daily(resumed);check(equal(resumed.snapshot(),w.snapshot()),"arrival budget survives reload")
	for day in 70:
		for i in 96: w.tick()
		check(w.data.agents.values().filter(func(a): return not a.isPlayer).size()<=SimPopulation.capacity(w),"population bounded")
	check(SimPopulation.capacity(w)==40,"absolute capacity")
	check(w.data.agents.size()==41,"exhausted source pool still fills forty NPC capacity")
	var names: Array=[]
	for resident in w.data.agents.values():
		check(resident.name not in names,"unique living resident names");names.append(resident.name)
	var report:={"checks":checks,"failures":failures,"scope":"five original immigrant creations without identity/reputation modifiers, paid eight-house expansion, construction capacity timing, daily arrival cap and 70-day population bound; explicit resource fixture"}
	FileAccess.open("res://docs/POPULATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

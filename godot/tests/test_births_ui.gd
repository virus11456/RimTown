extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	for c in JSON.parse_string(FileAccess.get_file_as_string("res://tests/births/conditions.json")):
		var w:=SimWorld.new();w.load_snapshot(c.input);w.births_enabled=true;w.data.lifecycle._daysSinceCheck=1;w.rng.state=1
		var count: int=w.data.lifecycle.births.size();SimBirths.daily(w)
		check(w.data.lifecycle.births.size()-count==c.called.size(),"source birth age/player/population/children gate")
		if c.called.is_empty(): check(w.rng.state==int(c.rng),"blocked gate RNG")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var raw: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json"))
	for id in raw.agents.keys():
		if id not in ["player","chen_wei","lin_mei"]: raw.agents.erase(id)
	for a in raw.agents.values(): a.relationships={};a.age=25
	raw.clock.hour=23;raw.clock.minute=45;raw.lifecycle._daysSinceCheck=1;raw.lifecycle.births=[]
	raw._godot4a={"births_enabled":true}
	app._load_document(JSON.stringify(raw),"出生測試")
	var w: SimWorld=app.simulation
	for flag in ["social","gossip","romance","feuds","factions","thoughts","inner_voice","stargazing","mischief","mourning","trace","combos","supply","processing","farm","industry","research","trade","buildings","economy","perception","quests","heart_events","population"]: w.set(flag+"_enabled",false)
	var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents.lin_mei
	var rel:=SimSocial.relationship(a,b);rel.status="married";rel.affinity=80
	var reverse:=SimSocial.relationship(b,a);reverse.status="married";reverse.affinity=80
	w.rng.state=1;app._tick_simulation()
	check(w.data.lifecycle.births.size()==1,"midnight actual birth")
	var id: String=w.data.agents.keys().filter(func(key): return str(key).begins_with("child_"))[0]
	check(app.world_view.actors.has(id) and app.motion.positions.has(id),"newborn actor and motion created")
	check(w.runtime.has(id),"new agent runtime registered")
	check(w.data.agents[id].age==16 and w.data.agents[id].jobKey==null,"original young resident no job")
	var resumed:=SimWorld.new();resumed.load_snapshot(w.snapshot())
	for i in 96*10: w.tick();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"ten-day birth resume")
	w.quests_enabled=true;SimLifeGoals.assign(w);w.data.lifeGoals.goals.chen_wei={"key":"family","stage":2,"stageStartDay":-100,"done":false};w.rng.state=1;SimLifeGoals.daily(w)
	check(w.data.lifeGoals.goals.chen_wei.done,"birth fulfills family dream")
	app.show_births();await settle();check(has_text(app.drawer_body,w.data.agents[id].name),"family history visible")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"mobile family layout")
	w.population_enabled=true;w.data.clock.hour=23;w.data.clock.minute=45
	var before_ids: Array=w.data.agents.keys();app._tick_simulation()
	var newcomers: Array=w.data.agents.keys().filter(func(key): return key not in before_ids)
	check(newcomers.size()==1,"midnight actual immigrant")
	for newcomer in newcomers: check(app.world_view.actors.has(newcomer) and app.motion.positions.has(newcomer),"immigrant actor and motion created")
	app.show_buildings();await settle();check(has_text(app.drawer_body,"住宅擴建"),"repeat housing offer visible")
	FileAccess.open("res://tests/births/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(w.snapshot(),"",false,true))
	var report:={"checks":checks,"failures":failures,"scope":"64 original birth eligibility scenarios; midnight dynamic 3D actor/runtime, 10-day resume, family-goal source and mobile history; no forced birth in UI scenario, seed fixed"}
	FileAccess.open("res://docs/BIRTH_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var app: Node=load("res://scenes/main.tscn").instantiate();root.add_child(app);await process_frame;app.set_process(false);app.load_demo("harbor")
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	var farmers: Array=[]
	for id in w.data.agents:
		var a: Dictionary=w.data.agents[id]
		if a.jobKey=="farmer": a.activity="working";a.currentLocation="farm";farmers.append(id)
	check(farmers.size()>=2,"original harbor has multiple farmers")
	var targets: Array=[]
	for id in farmers:
		var goal:=SimResidentField.destination(m.layout,w.data.agents[id],w.data.agents)
		check(not goal.is_empty() and goal.target not in targets,"each farmer gets a separate crop bed")
		targets.append(goal.target)
		check(m.layout._walkable(goal.target) and m.location_at(goal.target)=="farm","crop bed is within walkable farm")
		w.data.agents[id]._appointmentDestination="farm"
		check(SimResidentField.destination(m.layout,w.data.agents[id],w.data.agents).is_empty(),"appointment releases field")
		w.data.agents[id].erase("_appointmentDestination")
	var report:={"checks":checks,"failures":failures,"scope":"original harbor farmer jobs; controlled working state; separate crop targets and appointment release"}
	FileAccess.open("res://docs/OUTDOOR_FIELD_SHARING.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

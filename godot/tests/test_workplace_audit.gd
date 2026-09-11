extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion;var rows: Array=[]
	for id in w.data.agents:
		var a: Dictionary=w.data.agents[id];var job: Dictionary=w.rules.jobs.get(a.get("jobKey",""),{})
		if job.is_empty(): continue
		var home:=m.layout._house_id(id,a.homeLocation);var house: Dictionary=m.layout.houses.get(home,{})
		rows.append({"id":id,"workplace":job.workplace,"logical_exists":w.data.townMap.locations.has(job.workplace),"building_exists":m.layout.buildings.has(job.workplace),"nature_exists":m.layout.nature.has(job.workplace),"home_walkable":m.layout._walkable(Vector2(house.get("interiorX",0),house.get("interiorY",0))),"shift":a.get("_shiftSleep",{})})
	FileAccess.open("res://docs/WORKPLACE_AUDIT_CURRENT.json",FileAccess.WRITE).store_string(JSON.stringify(rows,"  "));print(JSON.stringify(rows));quit()

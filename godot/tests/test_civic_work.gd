extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/civic_pose_fixture.gd")
const Render=preload("res://tests/outdoor_pose_fixture.gd")
var cases: Array=[]
var maximum_step:=0.0
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for kind in ["day","night","post","trader"]:
			for age in [9,28,70]:
				var id: String=Fixture.prepare(app,town,kind,age)
				var w: SimWorld=app.simulation;var m: SimMotion=app.motion;var p: Dictionary=m.positions[id];var a: Dictionary=w.data.agents[id]
				var actor: Node3D=app.world_view.actors[id];var right: Node3D=actor.get_node("Body/ServiceRight")
				Render.render(app);check(not app.world_view.resident_work.phases.has(id),"no duty before arrival")
				var arrived:=false;var frames:=0
				for frame in 2200:
					var previous:=Vector2(p.x,p.y);m.update(w.data.agents);frames+=1
					maximum_step=maxf(maximum_step,previous.distance_to(Vector2(p.x,p.y)))
					check(m.layout._walkable(Vector2(p.x,p.y)),"walk remains collision safe")
					Render.render(app)
					if CivicWorkPerformance.ready(w,m,id): arrived=true;break
					check(not app.world_view.resident_work.phases.has(id) and Render.visible_tools(actor).is_empty(),"no stationary duty while commuting")
				check(arrived,"actual arrival "+town+" "+kind)
				var before:=w.snapshot();var positions: Dictionary=m.positions.duplicate(true);var angles: Array=[]
				for frame in 600:
					Render.render(app);angles.append(right.rotation.x)
					if kind=="trader":
						var tools:=Render.visible_tools(actor);check(tools.size()==1,"one held ledger")
						for tool in tools: check(DeskPerformance.bounds(tool).position.y>=.119,"ledger stays above floor")
					else: check(Render.visible_tools(actor).is_empty(),"watch gesture grants no weapon or tool")
				check(float(angles.max())-float(angles.min())>(1.8 if kind!="trader" else .1),"guard raises and lowers lookout arm / trader checks ledger")
				check(equal(before,w.snapshot()) and equal(positions,m.positions),"gesture cannot change shifts, positions, money or stock")
				for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
					a[key]=a.currentLocation;Render.render(app);check(not app.world_view.resident_work.phases.has(id),"social priority cancels gesture");a.erase(key)
				p.walking=true;Render.render(app);check(not app.world_view.resident_work.phases.has(id) and Render.visible_tools(actor).is_empty(),"walking owns arms");p.walking=false
				p.doorPhase="entering";Render.render(app);check(not app.world_view.resident_work.phases.has(id),"door transition is not duty");p.doorPhase=null
				p._directedGoal.x+=16;Render.render(app);check(not app.world_view.resident_work.phases.has(id),"blocked before destination is not duty");p._directedGoal.x-=16
				a._serviceStay=true;Render.render(app);check(not app.world_view.resident_work.phases.has(id),"care service wins");a.erase("_serviceStay")
				var hour: int=w.data.clock.hour;w.data.clock.hour=12 if kind=="night" else 23
				Render.render(app);check(not app.world_view.resident_work.phases.has(id),"stale working state cannot animate off shift");w.data.clock.hour=hour
				Render.render(app);app.running=false;var phases: Dictionary=app.world_view.resident_work.phases.duplicate(true);app._process(.2)
				check(equal(phases,app.world_view.resident_work.phases),"pause freezes duty")
				for activity in ["heading_home","sleeping","eating","idle"]:
					a.activity=activity;Render.render(app);check(Render.visible_tools(actor).is_empty() and right.rotation==Vector3.ZERO,"off duty restores arms and hides ledger")
				a.activity="working"
				var location: Dictionary=w.data.townMap.locations[a.currentLocation];w.data.townMap.locations.erase(a.currentLocation);Render.render(app)
				check(not app.world_view.resident_work.phases.has(id),"missing venue cannot animate");w.data.townMap.locations[a.currentLocation]=location
				var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"civic pose reload")
				check(app.world_view.resident_work.phases.is_empty() and Render.visible_tools(app.world_view.actors[id]).is_empty(),"reload clears temporary props and phase")
				check(Vector2(app.motion.positions[id].x,app.motion.positions[id].y).distance_to(Vector2(p.x,p.y))<.001,"reload preserves physical position")
				cases.append({"town":town,"kind":kind,"age":age,"arrived":arrived,"frames":frames})
	check(maximum_step<1.001,"no speed increase or teleport")
	var report:={"checks":checks,"failures":failures,"cases":cases,"maximum_step":maximum_step,"scope":"controlled duty clock, age and tower work point; normal routes, geometry, priority, pause and reload; no economic or roster writes"}
	FileAccess.open("res://docs/CIVIC_WORK_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/outdoor_pose_fixture.gd")
var cases: Array=[]
var max_step:=0.0
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for kind in ["miner","farm_site","farm_legacy"]:
			for age in [9,28,70]:
				var job:="miner" if kind=="miner" else "farmer"
				var id: String=Fixture.prepare(app,town,job,age,kind!="farm_legacy")
				var w: SimWorld=app.simulation;var m: SimMotion=app.motion;var a: Dictionary=w.data.agents[id];var p: Dictionary=m.positions[id]
				var actor: Node3D=app.world_view.actors[id]
				Fixture.render(app);check(Fixture.visible_tools(actor).is_empty(),"no permanent tool or work before arrival")
				var arrived:=false;var frames:=0
				for frame in 1600:
					var previous:=Vector2(p.x,p.y);m.update(w.data.agents);frames+=1
					max_step=maxf(max_step,previous.distance_to(Vector2(p.x,p.y)))
					check(m.layout._walkable(Vector2(p.x,p.y)),"commute stays walkable")
					Fixture.render(app)
					if OutdoorWorkPerformance.ready(w,m,id): arrived=true;break
					check(Fixture.visible_tools(actor).is_empty(),"no work tools while approaching")
				check(arrived,"actual arrival "+town+" "+kind)
				var before:=w.snapshot();var before_motion: Dictionary=m.positions.duplicate(true);var angles: Array=[]
				for frame in 120:
					Fixture.render(app)
					var tools:=Fixture.visible_tools(actor);check(tools.size()==1,"one hand-held tool")
					for tool in tools: check(DeskPerformance.bounds(tool).position.y>=.119,"tool remains above floor at every age")
					var right: Node3D=actor.get_node("Body/ServiceRight");angles.append(right.rotation.x)
				check(float(angles.max())-float(angles.min())>.1,"work hand moves through cycle")
				check(equal(before,w.snapshot()) and equal(before_motion,m.positions),"animation cannot move, spend, harvest or produce")
				for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
					a[key]=a.currentLocation;Fixture.render(app);check(Fixture.visible_tools(actor).is_empty(),"social intention hides tools");a.erase(key)
				a._serviceStay=true;Fixture.render(app);check(Fixture.visible_tools(actor).is_empty(),"receiving service hides tools");a.erase("_serviceStay")
				p.walking=true;Fixture.render(app);check(Fixture.visible_tools(actor).is_empty(),"walking hides tools");p.walking=false
				p.doorPhase="entering";Fixture.render(app);check(Fixture.visible_tools(actor).is_empty(),"door transition hides tools");p.doorPhase=null
				p._directedGoal.x+=16;Fixture.render(app);check(Fixture.visible_tools(actor).is_empty(),"blocked or interrupted route is not arrival");p._directedGoal.x-=16
				Fixture.render(app);app.running=false
				var phase: Dictionary=app.world_view.resident_work.phases.duplicate(true);app._process(.2)
				check(equal(phase,app.world_view.resident_work.phases),"pause freezes work")
				for activity in ["heading_home","sleeping","eating","waiting_workplace"]:
					a.activity=activity;Fixture.render(app);check(Fixture.visible_tools(actor).is_empty(),"non-work state hides tools")
				a.activity="working"
				var location: Dictionary=w.data.townMap.locations[a.currentLocation];w.data.townMap.locations.erase(a.currentLocation)
				Fixture.render(app);check(Fixture.visible_tools(actor).is_empty(),"missing facility cannot animate");w.data.townMap.locations[a.currentLocation]=location
				var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"outdoor pose reload")
				check(app.world_view.resident_work.phases.is_empty() and Fixture.visible_tools(app.world_view.actors[id]).is_empty(),"reload clears tools and phase")
				check(Vector2(app.motion.positions[id].x,app.motion.positions[id].y).distance_to(Vector2(p.x,p.y))<.001,"reload preserves physical location")
				cases.append({"town":town,"job":job,"layout":kind,"age":age,"arrived":arrived,"frames":frames})
	check(max_step<1.001,"ordinary walking speed preserved")
	var report:={"checks":checks,"failures":failures,"cases":cases,"maximum_step":max_step,"scope":"controlled jobs/ages and legacy or placed farms; collision arrival; tool geometry, work interrupts, pure stock/crop/motion state, pause and reload; no new production"}
	FileAccess.open("res://docs/OUTDOOR_WORK_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

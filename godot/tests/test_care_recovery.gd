extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var cases: Array=[]
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			var pair: Dictionary=Fixture.prepare(app,town,job)
			var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
			var a: Dictionary=w.data.agents[pair.recipient]
			for id in w.data.agents:
				if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
			var home: String=m.layout._house_id(pair.recipient,a.homeLocation);var house: Dictionary=m.layout.houses[home]
			var start:=m.layout._nearest(Vector2(house.doorPixelX,house.doorPixelY+32))
			m.positions[pair.recipient].x=start.x;m.positions[pair.recipient].y=start.y
			a.needs.rest=30;a.needs.hunger=50
			SimResidentCare.begin_recovery(w,a,16)
			check(a.has("_careRecovery"),"bounded home recovery admitted "+town+job)
			if not a.has("_careRecovery"): continue
			var until: int=a._careRecovery.until;var saw_walk:=false;var saw_meal:=false;var saw_sleep:=false;var largest:=0.0
			for tick in 16:
				var before: float=a.needs.rest
				app._tick_simulation()
				if a.has("_careRecovery"):
					check(int(a._careRecovery.until)==until,"fixed deadline never extended")
					check(not a.has("_careVisitDay"),"recovery does not consume care attempt")
					if a.activity=="heading_home": saw_walk=true;check(float(a.needs.rest)<=before,"no rest gain while returning")
					if a.activity=="eating": saw_meal=true;check(SimHomeRest.arrived(w,a),"meal only after home arrival")
					if a.activity=="sleeping": saw_sleep=true;check(SimHomeRest.arrived(w,a),"sleep only after home arrival")
				for frame in 480:
					var p: Dictionary=m.positions[pair.recipient];var old:=Vector2(p.x,p.y);m.update(w.data.agents);p=m.positions[pair.recipient];largest=maxf(largest,old.distance_to(Vector2(p.x,p.y)))
				if tick==0:
					var pos: Dictionary=m.positions[pair.recipient].duplicate(true);var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"home recovery reload");w=app.simulation;m=app.motion;a=w.data.agents[pair.recipient]
					check(a.has("_careRecovery") and equal(pos,m.positions[pair.recipient]),"actual reload keeps recovery and position")
				if not a.has("_careRecovery"): break
			check(saw_walk and saw_meal and saw_sleep and not a.has("_careRecovery"),"walk meal rest then leave recovery")
			check(largest<=1.01,"ordinary bounded walking")
			check(not a.has("_careProvided"),"no care rewards from home recovery")
			SimResidentCare.begin_recovery(w,a,16);check(not a.has("_careRecovery"),"at most one recovery plan per day")
			cases.append({"town":town,"job":job,"walk":saw_walk,"meal":saw_meal,"rest":saw_sleep,"max_step":largest})
	for town in ["frontier","harbor"]:
		for mode in ["automatic","work","appointment","disabled","moved_home","deadline"]:
			var pair: Dictionary=Fixture.prepare(app,town,"doctor")
			var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
			var a: Dictionary=w.data.agents[pair.recipient]
			for id in w.data.agents:
				if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
			var house: Dictionary=m.layout.houses[m.layout._house_id(pair.recipient,a.homeLocation)]
			var start:=m.layout._nearest(Vector2(house.doorPixelX,house.doorPixelY+32));m.positions[pair.recipient].x=start.x;m.positions[pair.recipient].y=start.y
			a.needs.rest=30;a.needs.hunger=25
			if mode=="automatic":
				SimResidentCare.tick(w)
				check(a.has("_careRecovery") and not a.has("_careVisit"),"actual preflight deficit starts recovery "+town)
				continue
			SimResidentCare.begin_recovery(w,a,16);check(a.has("_careRecovery"),"prepare interrupt "+mode)
			if mode=="work": a.jobKey="doctor"
			if mode=="appointment": w.quest_balance.appointments={"current":{"npc":pair.recipient,"state":"waiting","place":"town_square","due":int(w.data.tickCount),"until":int(w.data.tickCount)+8}}
			if mode=="disabled": w.social_enabled=false
			if mode=="moved_home": a.homeLocation="missing-home"
			if mode=="deadline": w.data.tickCount=int(a._careRecovery.until)
			var needs: Dictionary=a.needs.duplicate(true)
			check(SimResidentCare.recovery_activity(w,a).is_empty() and not a.has("_careRecovery"),"necessary change ends recovery "+mode)
			check(a.needs==needs,"ending plan grants no restoration "+mode)
	var report:={"checks":checks,"failures":failures,"cases":cases,"scope":"controlled preflight nutrition deficit, near-home start, real ticks and movement, actual reload, physical meals/rest, bounded recovery and no care quota/reward"}
	FileAccess.open("res://docs/CARE_RECOVERY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

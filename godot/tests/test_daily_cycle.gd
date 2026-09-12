extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var cases: Array=[]
	for town in ["frontier","harbor"]:
		app.load_demo(town)
		var ids: Array=app.simulation.data.agents.keys().filter(func(id):return id!="player")
		for id in ids:
			app.load_demo(town);var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social.observe_positions(m)
			var a: Dictionary=w.data.agents[id];var window:=SimShiftSleep.window(a,w.rules.jobs)
			w.data.clock.hour=posmod(int(window.start)-1,24);w.data.clock.minute=0
			a.needs.hunger=100;a.needs.rest=70;a.activity="idle";a.currentLocation=a.homeLocation
			var house: Dictionary=m.layout.houses[m.layout._house_id(id,a.homeLocation)]
			var offset:=str(id).unicode_at(0)%4
			var goal:=m.layout._nearest(Vector2(house.interiorX+(offset%2-.5)*16,house.interiorY+(floori(offset/2.0)-.5)*16))
			m.positions[id]={"x":goal.x,"y":goal.y,"targetX":goal.x,"targetY":goal.y,"walking":false,"doorPhase":null,"activity":"idle","walkStep":0}
			check(SimHomeRest.remaining_distance(m,a)==0,"already home has no fictitious outward return trip")
			check(SimHomeRest.plan(w,a).get("settled",false),"at-home plan is settled "+town+id)
			var initial: float=a.needs.rest
			for tick in 3:
				app._tick_simulation()
				check(a.activity=="idle" and SimAgenda.activity(a)=="在家準備休息","stays home before bedtime")
				check(float(a.needs.rest)<=initial,"pre-bed idle does not grant sleep recovery")
				for frame in 480: m.update(w.data.agents)
				check(SimHomeRest.arrived(w,a),"does not leave home while preparing sleep")
				if tick==0:
					var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"at-home pre-bed reload");w=app.simulation;m=app.motion;a=w.data.agents[id]
					check(a._homeReturn.get("settled",false) and SimHomeRest.arrived(w,a),"reload preserves settled phase and actual home")
			app._tick_simulation();check(a.activity=="sleeping" and SimHomeRest.arrived(w,a),"enters actual sleep on own schedule")
			w.data.clock.hour=int(window.end);w.data.clock.minute=0;a.needs.hunger=100;a.needs.rest=100
			app._tick_simulation();check(not a.get("_homeReturn",{}).get("settled",false),"wake time releases settled phase")
			w.data.clock.hour=posmod(int(window.start)-1,24);w.data.clock.minute=0
			m.positions[id].walking=true;m.positions[id].doorPhase="entering"
			check(not SimHomeRest.plan(w,a).get("settled",false),"crossing door is not considered settled")
			cases.append({"town":town,"id":id,"sleep_start":window.start,"sleep_end":window.end})
	for town in ["frontier","harbor"]:
		app.load_demo(town);var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
		var id: String="chen_wei" if town=="frontier" else "hb_xiugu";var a: Dictionary=w.data.agents[id];a.jobKey=""
		var sleep:=SimShiftSleep.window(a,w.rules.jobs);var house: Dictionary=m.layout.houses[m.layout._house_id(id,a.homeLocation)]
		var point:=m.layout._nearest(Vector2(house.interiorX,house.interiorY))
		m.positions[id]={"x":point.x,"y":point.y,"targetX":point.x,"targetY":point.y,"walking":false,"doorPhase":null,"activity":"idle","walkStep":0}
		a.activity="idle";a.currentLocation=a.homeLocation;a.needs.hunger=50;a.needs.rest=30
		w.data.clock.hour=posmod(int(sleep.start)-2,24);w.data.clock.minute=30
		SimResidentCare.begin_recovery(w,a,16);check(a.has("_careRecovery"),"prepare recovery before pre-bed hour")
		if not a.has("_careRecovery"): continue
		w.data.clock.hour=posmod(int(sleep.start)-1,24);w.data.clock.minute=0
		app._tick_simulation();check(a.has("_careRecovery") and a.activity=="eating","settled home does not cancel an existing safe recovery")
		for frame in 480: m.update(w.data.agents)
		app._tick_simulation();check(a.has("_careRecovery") and a.activity=="sleeping" and SimHomeRest.arrived(w,a),"existing short recovery can rest at home")
		for frame in 480: m.update(w.data.agents)
		app._tick_simulation();check(not a.has("_careRecovery") and not a.get("_careRecoveryResults",[]).is_empty() and a._careRecoveryResults.back().state=="recovered","recovery completes rather than falsely cancelling as a return trip")
		w.quest_balance.appointments={"current":{"npc":id,"state":"waiting","place":"town_square","due":int(w.data.tickCount),"until":int(w.data.tickCount)+8}}
		var before: Dictionary=m.positions[id].duplicate(true);w._update(id)
		check(a.activity=="appointment_wait" and a.currentLocation=="town_square" and not a.has("_homeReturn"),"confirmed appointment retains priority over pre-bed idle")
		check(equal(before,m.positions[id]),"new appointment intention does not teleport")
	var report:={"checks":checks,"failures":failures,"cases":cases,"scope":"all original residents in both towns with original jobs/shifts; controlled at-home hour before sleep, real ticks/motion, reload, no early sleep reward, schedule entry/wake release and door threshold"}
	FileAccess.open("res://docs/DAILY_CYCLE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

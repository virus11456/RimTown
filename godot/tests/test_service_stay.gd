extends "res://tests/test_careers_expansion_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		app.load_demo(town);var initial: Dictionary=app.progress_snapshot()
		for job in ["doctor","priest"]:
			for fault in ["complete","cancel","hunger","sleep","work","raid","reload","leave","appointment","midnight","sleep_window","orphan_reload"]:
				app._load_document(JSON.stringify(initial),"stay fixture");var w: SimWorld=app.simulation;var m: SimMotion=app.motion;var id:=SimGovernance.mayor(w)
				w.data.clock.hour=12;w.data.clock.minute=0
				var a: Dictionary=w.data.agents[id];a.jobKey="";a.activity="wandering";a.needs.rest=35;a.needs.hunger=90;a.mood=-50;w.runtime[id].moodModifier=-100
				a.currentLocation="town_square";a.erase("_homeReturn");a.erase("_hangoutHome");a.erase("_activeHangout");a._pendingHangout=null
				stand(app,"town_square");m.manual_player=true
				var pos:=Vector2(m.positions.player.x,m.positions.player.y);m.positions[id].x=pos.x;m.positions[id].y=pos.y;m.positions[id].doorPhase=null
				SimCareers.enroll(w,job);var task: Dictionary=SimCareers.available(w).filter(func(t): return t.target==id)[0]
				check(SimCareers.start(w,task.id).ok and SimCareers.book(w).active.get("stay",false),"eligible resident accepts stay "+town+job+fault)
				var xp: Dictionary=w.data.agents.player.skills.duplicate(true)
				for frame in 120: m.update(w.data.agents)
				check(Vector2(m.positions[id].x,m.positions[id].y)==pos and not m.positions[id].walking,"physical position held without teleport "+town+job+fault)
				if fault=="reload":
					var before: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(before),"active stay reload");a=w.data.agents[id]
					app._validate_career_presence();check(SimServiceStay.holding(w,id) and Vector2(m.positions[id].x,m.positions[id].y)==pos,"stay restored from active service "+town+job)
				if fault in ["complete","reload"]:
					var rest: float=a.needs.rest
					for tick in 4:
						app._tick_simulation()
						if tick<3:
							for frame in 60: m.update(w.data.agents)
					check(SimCareers.book(w).used==1 and not a.has("_serviceStay") and a.needs.rest!=rest,"normal ticks complete once with needs still changing and release "+town+job+fault)
				else:
					match fault:
						"cancel": SimCareers.cancel(w)
						"hunger": a.needs.hunger=10
						"sleep": a.needs.rest=5
						"work": a.jobKey="guard"
						"raid": a._raidShelterUntil=w.data.tickCount+10
						"leave": m.positions.player.x+=80
						"appointment": w.quest_balance.appointments={"current":{"npc":id,"state":"accepted","due":w.data.tickCount+4,"until":w.data.tickCount+8}}
						"midnight": w.data.clock.day+=1
						"sleep_window": w.data.clock.hour=23
						"orphan_reload":
							SimCareers.book(w).active={}
							app._load_document(JSON.stringify(app.progress_snapshot()),"orphan stay reload");a=w.data.agents[id]
					app._validate_career_presence();SimCareers.tick(w)
					check(SimCareers.book(w).active.is_empty() and not a.has("_serviceStay") and SimCareers.book(w).used==0 and equal(xp,w.data.agents.player.skills),"interrupt releases without reward "+town+job+fault)
					if fault in ["hunger","sleep","work","raid","appointment","sleep_window"]:
						check(str(SimCareers.book(w).notice).contains({"hunger":"吃飯","sleep":"休息","work":"上工","raid":"避難","appointment":"見面","sleep_window":"休息"}[fault]),"specific priority reason "+town+job+fault)
				if fault in ["complete","reload","cancel"]:
					var previous:=Vector2(m.positions[id].x,m.positions[id].y);var moved:=false;var safe:=true
					for frame in 180:
						m.update(w.data.agents);var next:=Vector2(m.positions[id].x,m.positions[id].y)
						if next.distance_to(previous)>.001: moved=true
						if next.distance_to(previous)>1.001 or not m.layout._walkable(next): safe=false
						previous=next
					check(moved and safe,"released resident resumes walking without snapping "+town+job+fault)
				app.show_careers();await settle()
	var report:={"checks":checks,"failures":failures,"scope":"two towns two service jobs; controlled unemployed awake resident and need state; real simulation ticks, fixed physical stay without frozen needs, completion, cancel, hunger, rest, work, raid, active reload, player departure, accepted appointment, midnight, sleep window and resumed walking; no natural multi-day claim"}
	FileAccess.open("res://docs/SERVICE_STAY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

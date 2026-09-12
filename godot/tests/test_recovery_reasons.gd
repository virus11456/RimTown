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
			var event: Dictionary=a._careRecoveryResults.back()
			check(event.state=="recovered" and int(event.meal_ticks)>0 and int(event.rest_ticks)>0,"actual meal/rest recorded as completed recovery")
			var count: int=a._careRecoveryResults.size();var memories: int=a.memory.size()
			SimResidentCare.end_recovery(w,a,"duplicate")
			check(a._careRecoveryResults.size()==count and a.memory.size()==memories,"ending twice cannot duplicate record or memory")
			w.data.tickCount+=1
			var position: Dictionary=m.positions[pair.recipient].duplicate(true)
			SimResidentCare.observe_recovery_followup(w,a)
			check(event.has("followup") and float(event.followup.x)==float(position.x) and float(event.followup.y)==float(position.y),"follow-up uses actual observed position")
			var followup: Dictionary=event.followup.duplicate(true);SimResidentCare.observe_recovery_followup(w,a)
			check(equal(followup,event.followup),"follow-up snapshot is not rewritten")
			check(SimTalkRecall.pick(w,pair.recipient,{}).is_empty(),"no immediate recovery recall")
			w.data.tickCount+=96
			var recall:=SimTalkRecall.pick(w,pair.recipient,{})
			check(not recall.is_empty() and recall.source.kind=="care_recovery" and "在家吃了東西" in recall.text and "在家休息" in recall.text,"later recall uses actual actions")
			check(SimTalkRecall.pick(w,pair.recipient,{"recalled":[recall.key]}).is_empty(),"recalled event not repeated")
			var saved: Dictionary=w.snapshot();var restored:=SimWorld.new();restored.load_snapshot(saved)
			check(equal(restored.data.agents[pair.recipient]._careRecoveryResults,a._careRecoveryResults) and SimTalkRecall.pick(restored,pair.recipient,{"recalled":[recall.key]}).is_empty(),"resolved reload preserves receipts and recall deduplication")
			for other in w.data.agents.values(): other.activity="sleeping"
			a.activity="idle";a.jobKey="";a.needs.hunger=80;a.needs.rest=80;a.needs.social=30
			a.relationships.player={"affinity":0};w.data.agents.player.activity="wandering";w.data.clock.hour=12
			var greeting_point:=m.layout._nearest(m.layout._center("town_square"))
			for speaker in ["player",pair.recipient]: m.positions[speaker].x=greeting_point.x;m.positions[speaker].y=greeting_point.y
			w.event_comments.clear();w.quest_balance.daily_talk={};w.quest_balance.daily_talk_enabled=true;w.quest_balance.appointments={};SimCareers.book(w).active={}
			var stock: Dictionary=w.data.stockpile.duplicate(true);var random_state: int=w.rng.state
			check(SimDailyTalk.observe(w,m)==pair.recipient,"real nearby greeting selects recovery recall")
			check(not w.data.agents.player.chatHistory.is_empty() and w.data.agents.player.chatHistory.back().get("_godotRecall",{}).get("kind")=="care_recovery" and SimDailyTalk.observe(w,m).is_empty(),"chat attaches verified source and respects greeting limit")
			check(equal(stock,w.data.stockpile) and random_state==w.rng.state,"recall adds no goods or random-state changes")
			var talked:=SimWorld.new();talked.load_snapshot(w.snapshot());check(SimTalkRecall.pick(talked,pair.recipient,talked.quest_balance.daily_talk).is_empty(),"actual greeting ledger survives reload")
			var room: Dictionary=m.layout.houses[m.layout._house_id(pair.recipient,a.homeLocation)]
			m.positions[pair.recipient].x=room.interiorX;m.positions[pair.recipient].y=room.interiorY;m.positions[pair.recipient].walking=false;m.positions[pair.recipient].doorPhase=null
			a._careRecovery={"home":a.homeLocation,"day":SimClock.total_days(w.data.clock),"until":int(w.data.tickCount)+5,"arrive_until":int(w.data.tickCount),"finish":int(w.data.tickCount),"hunger_target":90,"rest_target":90}
			SimResidentCare.recovery_activity(w,a)
			check(a._careRecoveryResults.back().state=="time_limit","time limit is not reported as reaching target")
			for index in 10:
				w.data.tickCount+=1;a._careRecovery={"home":a.homeLocation};SimResidentCare.end_recovery(w,a,"controlled cancellation")
			check(a._careRecoveryResults.size()==8,"receipt list stays bounded at eight")
			cases.append({"town":town,"job":job,"walk":saw_walk,"meal":saw_meal,"rest":saw_sleep,"max_step":largest})
	for town in ["frontier","harbor"]:
		for mode in ["automatic","work","appointment","disabled","moved_home","deadline","raid","new_day","hunger","fatigue","arrival_timeout","left_home","sleep_schedule","unavailable","dead"]:
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
			if mode=="dead": a.isDead=true;SimResidentCare.tick(w)
			if mode=="raid": a._raidShelterUntil=999
			if mode=="new_day": w.data.clock.day+=1
			if mode=="hunger": a.needs.hunger=14
			if mode=="fatigue": a.needs.rest=9
			if mode=="arrival_timeout": w.data.tickCount=int(a._careRecovery.arrive_until)+1
			if mode=="left_home": a._careRecovery.finish=int(w.data.tickCount)+4
			if mode=="sleep_schedule": w.data.clock.hour=22
			if mode=="unavailable": m.stable_routes=false
			if mode=="deadline": w.data.tickCount=int(a._careRecovery.until)
			var needs: Dictionary=a.needs.duplicate(true)
			check(SimResidentCare.recovery_activity(w,a).is_empty() and not a.has("_careRecovery"),"necessary change ends recovery "+mode)
			check(a.needs==needs,"ending plan grants no restoration "+mode)
			if mode=="work":
				var pos: Dictionary=m.positions[pair.recipient].duplicate(true)
				a.needs.hunger=80
				w.data.tickCount+=1;w._update(pair.recipient);SimResidentCare.observe_recovery_followup(w,a)
				check(equal(pos,m.positions[pair.recipient]),"resuming work intention does not teleport resident")
				check(a._careRecoveryResults.back().followup.intent=="工作" and a._careRecoveryResults.back().followup.place==SimAgenda.place_name(w,m,SimCareerPresence.room(m,pair.recipient)),"work intention and actual location recorded separately")
			check(a._careRecoveryResults.back().code==("home_changed" if mode=="moved_home" else "unavailable_resident" if mode=="dead" else mode),"precise cause stored "+mode)
			check(a._careRecoveryResults.back().state=="cancelled" and int(a._careRecoveryResults.back().meal_ticks)==0 and int(a._careRecoveryResults.back().rest_ticks)==0,"interruption records no invented home actions")
			w.data.tickCount+=96
			var recall:=SimTalkRecall.pick(w,pair.recipient,{})
			check(recall.source.code==a._careRecoveryResults.back().code,"recall cites same structured cause")
			check("中止" in recall.text and "在家吃了" not in recall.text and "在家休息" not in recall.text,"cancelled-before-arrival recall does not invent eating or sleep")
	var report:={"checks":checks,"failures":failures,"cases":cases,"scope":"specific cancellation causes, observed follow-up position versus intent; actual recovery receipts, memory, recall, interruption without invented actions, resolved reload; controlled preflight nutrition deficit, near-home start, real ticks and movement, actual reload, physical meals/rest, bounded recovery and no care quota/reward"}
	FileAccess.open("res://docs/RECOVERY_REASONS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_careers_expansion_ui.gd"
func prepare(app: Node,town: String,job: String) -> Dictionary:
	app.load_demo(town);app.show_tab("居民",true);var w: SimWorld=app.simulation;var id:=SimGovernance.mayor(w)
	w.data.clock.hour=12;w.data.clock.minute=0
	var a: Dictionary=w.data.agents[id];a.jobKey="";a.activity="wandering";a.needs.rest=35;a.needs.hunger=90;a.mood=-50;a.currentLocation="town_square"
	a._pendingHangout=null;a.erase("_activeHangout");a.erase("_hangoutHome")
	stand(app,"town_square");var p: Dictionary=app.motion.positions.player
	app.motion.positions[id].x=p.x;app.motion.positions[id].y=p.y;app.motion.positions[id].doorPhase=null
	SimWorkSchedule.refresh(w,app.motion);SimShiftSleep.refresh(w,app.motion)
	SimCareers.enroll(w,job)
	return SimCareers.available(w).filter(func(t): return t.target==id)[0]
func finish_service(app: Node) -> void:
	var w: SimWorld=app.simulation;w.data.tickCount=int(SimCareers.book(w).active.finish);SimCareers.tick(w)
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.chat_transport=mock
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			for state in ["none","active","completed","cancelled","midnight"]:
				var task:=prepare(app,town,job);var w: SimWorld=app.simulation;var id:=str(task.target)
				var before:=w.snapshot();check(SimServiceChat.context(w,id).recentOutcomes.is_empty() and equal(before,w.snapshot()),"old save has no fabricated records and reading is pure "+town+job+state)
				if state!="none": check(SimCareers.start(w,task.id).ok,"real service starts "+town+job+state)
				var xp: Dictionary=w.data.agents.player.skills.duplicate(true)
				match state:
					"completed": finish_service(app)
					"cancelled": w.data.agents[id].needs.hunger=10;app._validate_career_presence()
					"midnight": w.data.clock.day+=1;SimCareers.book(w)
				var facts:=SimServiceChat.context(w,id)
				if state in ["completed","cancelled","midnight"]:
					check(facts.recentOutcomes.size()==1 and facts.recentOutcomes[0].state==("completed" if state=="completed" else "cancelled"),"actual terminal outcome recorded "+town+job+state)
					before=w.snapshot();SimCareers.tick(w);SimCareers.cancel(w);check(equal(before,w.snapshot()),"terminal record cannot replay "+town+job+state)
				if state in ["cancelled","midnight"]: check(equal(xp,w.data.agents.player.skills) and SimCareers.book(w).used==0,"cancelled record adds no reward "+town+job+state)
				app.chat_drafts[id]="我的草稿";app.show_player_chat(id);press(app.drawer_body,"詢問服務結果（本機）");await settle()
				var expected: String={"none":"沒有能核對","active":"尚未完成","completed":"已經完成","cancelled":"需要先吃飯","midnight":"午夜已換日"}[state]
				check(has_text(app.drawer_body,expected) and requests==0 and app.chat_drafts[id]=="我的草稿","local answer reflects exact state without API and preserves draft "+town+job+state)
				check(equal(w.data.agents.player.chatHistory.back()._godotService,facts),"dialogue keeps detached factual source "+town+job+state)
				before=w.snapshot();press(app.drawer_body,"詢問服務結果（本機）");check(equal(before,w.snapshot()),"identical repeat does not append or reward "+town+job+state)
				app.show_agenda(id);await settle();check(has_text(app.drawer_body,expected)==(state!="none"),"agenda agrees with service facts "+town+job+state)
				SimWorkSchedule.refresh(w,app.motion);SimShiftSleep.refresh(w,app.motion)
				var snapshot: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(snapshot),"service facts restored")
				check(equal(facts,SimServiceChat.context(w,id)) and equal(snapshot,app.progress_snapshot()),"full service facts and dialogue persist "+town+job+state)
				var other: String=w.data.agents.keys().filter(func(k): return k not in [id,"player"])[0]
				check(SimServiceChat.context(w,other).current.is_empty() and SimServiceChat.context(w,other).recentOutcomes.is_empty(),"resident histories isolated "+town+job+state)
				app.show_player_chat(id);await settle();var fits:=true
				for c in app.drawer_body.get_children():
					if c is Control and c.size.x>app.drawer.size.x: fits=false
				check(fits,"375px service inquiry fits "+town+job+state)
	# Bounded history fixture; record helper never changes skills or stock.
	var task:=prepare(app,"frontier","doctor");var w: SimWorld=app.simulation;var stock: Dictionary=w.data.stockpile.duplicate(true);var skills: Dictionary=w.data.agents.player.skills.duplicate(true)
	for n in 90: SimServiceChat.outcome(w,task,"cancelled","受控歷史容量測試 "+str(n))
	check(w.quest_balance.service_outcomes.size()==64 and SimServiceChat.context(w,str(task.target)).recentOutcomes.size()==2 and equal(stock,w.data.stockpile) and equal(skills,w.data.agents.player.skills),"global 64 and per-resident context two, no production or XP")
	var earlier:=SimServiceChat.context(w,str(task.target))
	SimServiceChat.outcome(w,task,"cancelled","受控歷史容量測試 89")
	check(not equal(earlier,SimServiceChat.context(w,str(task.target))),"same-tick repeated outcome has distinct identity after history truncation")
	var source:=SimServiceChat.context(w,str(task.target));source.recentOutcomes[0].reason="外部修改"
	check("外部修改" not in JSON.stringify(w.quest_balance.service_outcomes),"context is detached from authoritative outcomes")
	var report:={"checks":checks,"failures":failures,"scope":"two towns two jobs actual start/finish/cancel/midnight core calls with controlled actor needs/position and settlement clock; local UI, source preservation, dedup, old-save non-inference, no reward on cancellation, full save roundtrip, resident isolation, bounded history and 375px; no production AI"}
	FileAccess.open("res://docs/SERVICE_CHAT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

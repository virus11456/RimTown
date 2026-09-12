extends "res://tests/test_daily_talk.gd"
func service(w: SimWorld,id: String,state: String,job: String="doctor") -> void:
	SimServiceChat.outcome(w,{"job":job,"target":id,"location":"town_square"},state,"對方需要先吃飯，服務未完成。" if state=="cancelled" else "照護完成。")
func _initialize() -> void:
	for state in ["completed","cancelled"]:
		for job in ["doctor","priest"]:
			var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
			service(w,"chen_wei",state,job)
			check(SimServiceChat.recall(w,"chen_wei",{}).is_empty(),"no immediate service repetition "+state+job)
			w.data.tickCount+=4
			var before:=w.snapshot();var pick:=SimServiceChat.recall(w,"chen_wei",{})
			check(not pick.is_empty() and pick.source.state==state and ("已經完成" in pick.text)==(state=="completed"),"correct result and factual source "+state+job)
			check(equal(before,w.snapshot()),"picking recall is pure "+state+job)
			var stock: Dictionary=w.data.stockpile.duplicate(true);var rels: Dictionary=w.data.agents.chen_wei.relationships.duplicate(true);var xp: Dictionary=w.data.agents.player.skills.duplicate(true);var rng:=w.rng.state
			check(SimDailyTalk.observe(w,m)=="chen_wei","actual nearby daily talk uses service recollection "+state+job)
			check(w.data.agents.player.chatHistory.back()._godotRecall==pick.source and w.data.agents.player.memory.any(func(r): return pick.text in r.content) and w.data.agents.chen_wei.memory.any(func(r): return pick.text in r.content),"source and both memories reflect actual greeting "+state+job)
			check(equal(stock,w.data.stockpile) and equal(rels,w.data.agents.chen_wei.relationships) and equal(xp,w.data.agents.player.skills) and rng==w.rng.state,"no resource affinity skill or RNG reward "+state+job)
			before=w.snapshot();check(SimDailyTalk.observe(w,m).is_empty() and equal(before,w.snapshot()),"no immediate spam "+state+job)
			var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot())))
			check(SimServiceChat.recall(restored,"chen_wei",restored.quest_balance.daily_talk).is_empty(),"JSON reload retains consumption "+state+job)
			w.data.clock.day+=1;w.data.tickCount+=96
			check(SimServiceChat.recall(w,"chen_wei",w.quest_balance.daily_talk).is_empty(),"next day does not repeat same record "+state+job)
	for fault in ["future","old","missing_time","text_only","other","active","disabled","far"]:
		var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
		service(w,"chen_wei","completed");w.data.tickCount+=4
		match fault:
			"future": w.data.tickCount=-1
			"old": w.data.tickCount=193
			"missing_time": w.quest_balance.service_outcomes[0].erase("tick")
			"text_only": w.quest_balance.erase("service_outcomes");w.data.agents.chen_wei.memory=[{"content":"照護完成了"}]
			"other": w.quest_balance.service_outcomes[0].npc="lin_mei"
			"active": SimCareers.book(w).active={"job":"doctor","target":"chen_wei","location":"town_square","finish":10}
			"disabled": w.quest_balance.daily_talk_enabled=false
			"far": m.positions.chen_wei.x+=80
		var before:=w.snapshot()
		if fault in ["disabled","far","active"]: check(SimDailyTalk.observe(w,m).is_empty() and equal(before,w.snapshot()),"no invalid autonomous greeting "+fault)
		else: check(SimServiceChat.recall(w,"chen_wei",{}).is_empty() and equal(before,w.snapshot()),"no invented or expired recollection "+fault)
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
	service(w,"chen_wei","completed");w.quest_balance.service_outcomes[0].erase("serial");w.data.tickCount+=4
	SimDailyTalk.observe(w,m);var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot())))
	check(SimServiceChat.recall(restored,"chen_wei",restored.quest_balance.daily_talk).is_empty(),"legacy numeric normalization cannot repeat after JSON load")
	service(w,"chen_wei","cancelled");w.data.tickCount+=4
	check(SimServiceChat.recall(w,"chen_wei",w.quest_balance.daily_talk).source.state=="cancelled","newer cancellation supersedes older completion")
	# Existing daily cap and cooldown include service recollections.
	w.data.tickCount+=16;service(w,"lin_mei","completed");w.data.tickCount+=4
	m.positions.lin_mei.x=f.point.x+4;m.positions.lin_mei.y=f.point.y
	check(SimDailyTalk.observe(w,m)=="lin_mei","second resident can recall after cooldown")
	service(w,"sun_yu","completed");w.data.tickCount+=20;m.positions.sun_yu.x=f.point.x+4;m.positions.sun_yu.y=f.point.y
	check(SimDailyTalk.observe(w,m).is_empty() and w.quest_balance.daily_talk.used==2,"shared two-per-day limit includes service recalls")
	var report:={"checks":checks,"failures":failures,"scope":"controlled completed/cancelled doctor/priest records, actual proximity gating, one-hour to two-day age, source and mutual memories, no rewards or RNG, caps/cooldown, newer outcome, JSON and legacy serial-free reload, active-work blocking; no production AI"}
	FileAccess.open("res://docs/SERVICE_RECALL_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

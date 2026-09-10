extends "res://tests/test_careers.gd"
func setup() -> Dictionary:
	var w:=world();w.data.clock.hour=20
	for a in w.data.agents.values(): a.activity="sleeping"
	w.data.agents.player.activity="wandering"
	for id in ["chen_wei","lin_mei","sun_yu"]:
		var a: Dictionary=w.data.agents[id];a.activity="wandering";a.jobKey="";a.needs.hunger=80;a.needs.rest=80;a.needs.social=30
	var layout:=TownLayout.new();layout.rebuild(w.data)
	var m:=SimMotion.new();m.configure(layout);m.update(w.data.agents)
	var point:=layout._nearest(layout._center("town_square"))
	for id in m.positions:
		m.positions[id].x=0;m.positions[id].y=0
	for id in ["player","chen_wei"]: m.positions[id].x=point.x;m.positions[id].y=point.y
	return {"w":w,"m":m,"point":point}
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
	var stock: Dictionary=w.data.stockpile.duplicate(true);var rels: Dictionary=w.data.agents.chen_wei.relationships.duplicate(true);var random_state:=w.rng.state
	check(SimDailyTalk.observe(w,m)=="chen_wei","idle close resident initiates")
	check(w.data.agents.player.chatHistory.back().get("_godotOffline",false),"local origin recorded")
	check(equal(stock,w.data.stockpile) and equal(rels,w.data.agents.chen_wei.relationships) and w.rng.state==random_state,"no resources affinity or RNG rewards")
	check(w.data.agents.chen_wei.memory.any(func(x): return "搭話" in x.content) and w.data.agents.player.memory.any(func(x): return "搭話" in x.content),"both remember actual greeting")
	var saved:=w.snapshot();check(SimDailyTalk.observe(w,m).is_empty() and equal(saved,w.snapshot()),"repeat ticks cannot spam")
	w.data.tickCount+=16
	check(SimDailyTalk.observe(w,m).is_empty(),"same NPC once per day")
	m.positions.lin_mei.x=f.point.x+4;m.positions.lin_mei.y=f.point.y
	check(SimDailyTalk.observe(w,m)=="lin_mei","different nearby resident after cooldown")
	w.data.tickCount+=16;m.positions.sun_yu.x=f.point.x+4;m.positions.sun_yu.y=f.point.y
	check(SimDailyTalk.observe(w,m).is_empty(),"town total capped at two")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());check(SimDailyTalk.observe(restored,m).is_empty(),"reload cannot bypass daily cap")
	w.data.clock.day+=1;w.data.tickCount+=96
	check(SimDailyTalk.observe(w,m)=="chen_wei","new day permits normal contact")
	check(w.quest_balance.daily_talk.topics.chen_wei=="season","successive contact varies topic")
	for fault in ["far","other_place","working","sleeping","eating","dead","hungry","rest","hostile","content","night","disabled","event","appointment"]:
		f=setup();w=f.w;m=f.m
		var a: Dictionary=w.data.agents.chen_wei
		match fault:
			"far": m.positions.chen_wei.x+=70
			"other_place": m.positions.chen_wei.x=0;m.positions.chen_wei.y=0
			"working": a.jobKey="priest";w.data.clock.hour=18
			"sleeping": a.activity="sleeping"
			"eating": a.activity="eating"
			"dead": a.isDead=true
			"hungry": a.needs.hunger=0
			"rest": a.needs.rest=0
			"hostile": a.relationships.player={"affinity":-1}
			"content": a.needs.social=100;a.relationships.player={"affinity":0}
			"night": w.data.clock.hour=22
			"disabled": w.quest_balance.daily_talk_enabled=false
			"event": w.event_comments.append({"npc":"chen_wei"})
			"appointment": SimAppointments.offer(w,"chen_wei")
		saved=w.snapshot();check(SimDailyTalk.observe(w,m).is_empty() and equal(saved,w.snapshot()),"no invalid or remote greeting: "+fault)
	var report:={"checks":checks,"failures":failures,"scope":"configured physical positions, needs/work/relationship gates, caps/cooldown/reload, topic variation, memories, no rewards/API/RNG and no-op rejection"}
	FileAccess.open("res://docs/DAILY_TALK_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

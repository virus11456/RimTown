extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	for fault in ["far","different_house","missing","logical_only","dead","close"]:
		var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
		w.data.tickCount=20
		for a in w.data.agents.values(): a.activity="sleeping"
		var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents.lin_mei
		a.activity="socializing";b.activity="wandering";a.currentLocation="town_square";b.currentLocation="town_square"
		m.positions.chen_wei.x=f.point.x;m.positions.chen_wei.y=f.point.y;m.positions.lin_mei.x=f.point.x+4;m.positions.lin_mei.y=f.point.y
		match fault:
			"far": m.positions.lin_mei.x+=80
			"missing": m.positions.erase("lin_mei")
			"logical_only": m.positions.chen_wei.x=0;m.positions.chen_wei.y=0;m.positions.lin_mei.x=1;m.positions.lin_mei.y=1
			"dead": b.isDead=true
			"different_house":
				a.currentLocation="residential_north";b.currentLocation="residential_north"
				var houses: Array=m.layout.houses.values()
				m.positions.chen_wei.x=houses[0].interiorX;m.positions.chen_wei.y=houses[0].interiorY
				m.positions.lin_mei.x=houses[1].interiorX;m.positions.lin_mei.y=houses[1].interiorY
		w.social.observe_positions(m);var before:=w.snapshot();var state:=w.rng.state
		w.social.try_interaction(a,w.data,w.rng,w.rules.jobs,true)
		if fault=="close":
			check(w.data.get("npcConversationLog",[]).size()>before.get("npcConversationLog",[]).size(),"nearby real residents converse")
			check(a._lastInteractionTick==20,"normal interaction cooldown retained")
		else: check(equal(before,w.snapshot()) and state==w.rng.state,"no conversation memory relationships gossip or RNG for invalid physical pair: "+fault)
	var f:=setup();var w: SimWorld=f.w
	check(w.social.physical_positions==null,"pure world retains original source-compatible mode")
	var report:={"checks":checks,"failures":failures,"scope":"controlled physical positions, far/missing/different-home/dead/logical-only rejection before any mutation or RNG; close pair actual SimSocial dialogue and cooldown, pure-world compatibility"}
	FileAccess.open("res://docs/SOCIAL_PRESENCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

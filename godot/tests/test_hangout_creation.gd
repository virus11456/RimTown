extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	for partner in ["lin_mei","player"]:
		var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m;w.data.clock.hour=18;w.data.clock.minute=0
		for a in w.data.agents.values(): a.activity="sleeping"
		var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents[partner]
		a.activity="socializing";b.activity="wandering";a.currentLocation="town_square";b.currentLocation="town_square"
		m.positions[partner].x=f.point.x+4;m.positions[partner].y=f.point.y;w.social.observe_positions(m)
		var found:=false
		for attempt in 80:
			w.data.tickCount+=8;SimSocial.relationship(a,b).affinity=70
			w.social.try_interaction(a,w.data,w.rng,w.rules.jobs)
			if a.get("_pendingHangout")!=null: found=true;break
		if partner=="lin_mei":
			check(found,"normal close NPC dialogue can propose outing")
			if found:
				check(a._pendingHangout.withId==b.id and b._pendingHangout.withId==a.id,"stable reciprocal IDs")
				check(a._pendingHangout.issued_tick==b._pendingHangout.issued_tick and a._pendingHangout.expires_at==int(w.data.tickCount)+16,"same bounded expiry from creation")
		else: check(not found and b.get("_pendingHangout")==null,"NPC social dialogue cannot silently commit player to outing")
	var report:={"checks":checks,"failures":failures,"scope":"controlled close-pair social dialogue generator with boosted affinity, reciprocal metadata and explicit-player-invitation separation; not natural affinity progression"}
	FileAccess.open("res://docs/HANGOUT_CREATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

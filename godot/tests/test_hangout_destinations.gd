extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	for available in [true,false]:
		var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
		for a in w.data.agents.values(): a.activity="sleeping"
		var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents.lin_mei
		a.activity="socializing";b.activity="wandering";a.currentLocation="town_square";b.currentLocation="town_square"
		m.positions.lin_mei.x=f.point.x+4;m.positions.lin_mei.y=f.point.y;w.social.observe_positions(m)
		for place in ["tavern","park","chapel","forest","library"]: w.data.townMap.locations.erase(place)
		if not available: w.data.townMap.locations.erase("town_square")
		var proposed:=0;var invalid:=false
		for attempt in 80:
			w.data.tickCount+=8;SimSocial.relationship(a,b).affinity=70
			w.social.try_interaction(a,w.data,w.rng,w.rules.jobs)
			if a.get("_pendingHangout")!=null:
				proposed+=1
				if not w.data.townMap.locations.has(a._pendingHangout.location): invalid=true
				a._pendingHangout=null;b._pendingHangout=null
		check(not invalid,"no absent destination selected: "+str(available))
		check(proposed>0 if available else proposed==0,"available venue chosen, empty set skips invitations: "+str(available))
		check(not w.data.get("npcConversationLog",[]).is_empty(),"conversation still runs: "+str(available))
	var report:={"checks":checks,"failures":failures,"scope":"controlled close pair and affinity, 80 attempts each with one remaining venue or no venues; no natural success-rate claim"}
	FileAccess.open("res://docs/HANGOUT_DESTINATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

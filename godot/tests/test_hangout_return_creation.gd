extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	for early in [true,false]:
		var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m;w.data.clock.hour=12 if early else 23;w.data.clock.minute=0 if early else 15;m.stable_routes=true
		for a in w.data.agents.values(): a.activity="sleeping"
		var a: Dictionary=w.data.agents.sun_yu;var b: Dictionary=w.data.agents.lin_mei
		a.personality.traits=["night_owl"];b.personality.traits=["night_owl"]
		a.activity="socializing";b.activity="wandering";a.currentLocation="park";b.currentLocation="park"
		var point:=m.layout._nearest(m.layout._center("park"))
		for id in [a.id,b.id]: m.positions[id].x=point.x;m.positions[id].y=point.y
		w.social.observe_positions(m)
		for place in ["tavern","town_square","chapel","forest","library"]: w.data.townMap.locations.erase(place)
		var proposed:=0;var invalid:=false
		for attempt in 80:
			w.data.tickCount+=8;SimSocial.relationship(a,b).affinity=70
			w.social.try_interaction(a,w.data,w.rng,w.rules.jobs)
			if a.get("_pendingHangout")!=null:
				proposed+=1
				if not w.data.townMap.locations.has(a._pendingHangout.location): invalid=true
				a._pendingHangout=null;b._pendingHangout=null
		check(not invalid,"no absent destination selected: "+str(early))
		check(proposed>0 if early else proposed==0,"early return fits, late return refuses invitation: "+str(early))
		check(not w.data.get("npcConversationLog",[]).is_empty(),"conversation still runs: "+str(early))
	var report:={"checks":checks,"failures":failures,"scope":"controlled close night-owl pair with boosted affinity, actual social generator and normal scene-route mode, one venue at early versus late time; conversation continues, no natural frequency claim"}
	FileAccess.open("res://docs/HANGOUT_RETURN_CREATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

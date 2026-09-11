extends "res://tests/test_appointment_return.gd"
func _initialize() -> void:
	for mode in ["missed","cancelled","remote","declined","dead","shelter","blocked","hungry"]:
		var f:=fixture();var w: SimWorld=f.w;var m: SimMotion=f.m;var resident: Dictionary=f.a
		m.tick_seconds=8;SimAppointments.offer(w,"chen_wei");SimAppointments.respond(w,true)
		var appointment:=SimAppointments.current(w);w.data.tickCount=appointment.until;w.data.clock.hour=int(appointment.hour)+2
		var point:=m.layout._nearest(m.layout._center("town_square"))
		m.positions.chen_wei.x=point.x;m.positions.chen_wei.y=point.y;m.positions.chen_wei.walking=false;m.positions.chen_wei.doorPhase=null
		appointment.npc_arrived=true
		match mode:
			"remote": m.positions.chen_wei.x=0;m.positions.chen_wei.y=0
			"dead": resident.isDead=true
			"shelter": resident._raidShelterUntil=9999
			"hungry": resident.needs.hunger=0
			"blocked":
				var door: Dictionary=m.layout.houses[m.layout._house_id("chen_wei",resident.homeLocation)]
				m.layout.grid[floori(door.doorPixelY/16)][floori(door.doorPixelX/16)]=5;m.pathfinder.grid=m.layout.grid
		var positions: Dictionary=m.positions.duplicate(true);var stock: Dictionary=w.data.stockpile.duplicate(true);var relations: Dictionary=resident.relationships.duplicate(true)
		var state: String=mode if mode in ["cancelled","declined"] else "missed"
		SimAppointments.finish(w,state,"玩家取消約定" if mode=="cancelled" else "等待結束，未碰面")
		var should_return: bool=mode in ["missed","cancelled","hungry"]
		check(resident.has("_hangoutHome")==should_return,"physical return eligibility: "+mode)
		check(equal(positions,m.positions) and equal(stock,w.data.stockpile) and equal(relations,resident.relationships) and not w.data.agents.player.has("_hangoutHome"),"no teleport, public spending, affinity reward or player autopilot: "+mode)
		var terminal:=w.snapshot();SimAppointments.finish(w,"met","late");SimAppointments.tick(w)
		check(equal(terminal,w.snapshot()),"terminal resolution cannot repeat or become met: "+mode)
		if should_return:
			w._update("chen_wei")
			check(resident.activity==("eating" if mode=="hungry" else "heading_home"),"urgent meal keeps priority over optional return: "+mode)
	var report:={"checks":checks,"failures":failures,"scope":"controlled physical presence and original home routes; missed and explicit cancellation return, stale arrival flag, declined/dead/shelter/unreachable exclusions, meal priority, no movement/spending/affinity/player control side effects, terminal idempotency"}
	FileAccess.open("res://docs/APPOINTMENT_AFTERCARE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

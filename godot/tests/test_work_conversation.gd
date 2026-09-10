extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	for mode in ["present","walking","distant","disabled"]:
		var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m;var a: Dictionary=w.data.agents.chen_wei;var b: Dictionary=w.data.agents.lin_mei
		w.data.clock.hour=12;w.data.tickCount=12;w.social_enabled=mode!="disabled"
		var point:=m.layout._nearest(m.layout._center("workshop"))
		for resident in [a,b]:
			resident.jobKey="carpenter";resident.activity="working";resident.currentLocation="workshop";resident.needs.hunger=90;resident.needs.rest=90
			m.positions[resident.id].x=point.x;m.positions[resident.id].y=point.y;m.positions[resident.id].walking=false
		if mode=="walking": m.positions[a.id].walking=true
		if mode=="distant":m.positions[b.id].x=0;m.positions[b.id].y=0
		w.social.observe_positions(m);var resources: Dictionary=w.data.stockpile.duplicate(true)
		w._update(a.id)
		check(w.data.get("npcConversationLog",[]).size()==(1 if mode=="present" else 0),"work conversation actual-position guard: "+mode)
		check(a.activity=="working" and equal(resources,w.data.stockpile),"work and resources unchanged by talk: "+mode)
		if mode=="present":
			w._update(a.id);check(w.data.npcConversationLog.size()==1,"existing cooldown applies at work")
	var report:={"checks":checks,"failures":failures,"scope":"controlled same-workplace co-workers, stopped/proximity/social-enabled guards, unchanged work/resources and original conversation cooldown; not natural encounter frequency"}
	FileAccess.open("res://docs/WORK_CONVERSATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

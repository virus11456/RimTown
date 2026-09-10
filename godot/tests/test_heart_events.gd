extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/heart_events/oracle.json"))
	for c in cases.thresholds:
		var w:=SimWorld.new();w.load_snapshot(c.input);w.heart_events_enabled=true
		SimHeartEvents.check_new(w);SimHeartEvents.check_new(w)
		check(equal(w.data.heartEventsFired,c.fired),"original fired thresholds")
		if c.chosen==null: check(w.event_comments.is_empty(),"below threshold or already fired")
		else: check(w.event_comments.size()==1 and w.event_comments[0].npc==c.chosen.npc and w.event_comments[0].definition.id==c.chosen.event,"one event original order")
	var definitions:=SimHeartEvents.rules()
	for c in cases.speech:
		var w:=SimWorld.new();w.load_snapshot(c.input);var npc: Dictionary=w.data.agents.chen_wei
		var event: Dictionary=definitions.events[int(c.event)]
		var fallback: String=(definitions.fallbacks.romance if event.get("romance",false) else definitions.fallbacks.friend)[int(c.slot)]
		fallback=fallback.replace("{job}",str(SimPlayerChat.job(w,npc).get("title","日子")))
		if "shy" in npc.personality.traits: fallback="那個..."+fallback
		elif "abrasive" in npc.personality.traits: fallback+="...講完了,不准笑。"
		var item:={"kind":"heart","npc":"chen_wei","player":"player","definition":event,"fallback":fallback}
		w.event_comments.append(item);check(SimHeartEvents.apply(w,item),"apply")
		check(equal(w.data.agents.player.chatHistory,c.expected.history),"original fallback speech")
		check(equal(npc.memory,c.expected.memory),"original important memory")
		check(equal(npc.relationships,c.expected.relationships),"original shared memories")
		check(equal(w.data.messageLog,c.expected.logs),"original heart log")
		check(not SimHeartEvents.apply(w,item),"once only")
	var report:={"checks":checks,"failures":failures,"scope":"48 original threshold/order/busy cases and 72 original fallback/job/trait speech, memory, relationship and log cases; no production API"}
	FileAccess.open("res://docs/HEART_EVENT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

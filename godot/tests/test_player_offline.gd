extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var fixture: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/player_offline/oracle.json"))
	for index in fixture.cases.size():
		var c: Dictionary=fixture.cases[index];var cfg: Dictionary=c.config
		var w:=SimWorld.new();w.load_snapshot(fixture.input)
		var a: Dictionary=w.data.agents.chen_wei;var p: Dictionary=w.data.agents.player
		var rn:=SimSocial.relationship(a,p);SimSocial.relationship(p,a)
		a.personality.traits=cfg.traits;rn.affinity=cfg.aff;rn.romanticInterest=cfg.rom;rn.status=cfg.status
		a.mood=cfg.mood;a.needs.hunger=cfg.hunger;a.needs.rest=cfg.rest;a.activity=cfg.activity;a.job={"key":cfg.job,"title":cfg.job}
		if cfg.get("serializedJob",false): a.erase("job");a.jobKey=cfg.job
		w.data.clock.hour=cfg.hour;w.data.clock.season=cfg.season;w.data.events.conversationTopics=cfg.topics.duplicate(true);w.data.gossip=cfg.gossip.duplicate(true)
		w.rng.state=int(c.seed)
		var result:=SimPlayerOffline.apply(w,"chen_wei",c.message)
		var expected: Dictionary=c.expected
		var prefix: String=str(index)+" "+c.message
		check(result.text==expected.result.npc_reply,prefix+" reply: "+result.text+" expected: "+expected.result.npc_reply)
		check(equal({"affinity_change":result.affinity,"romantic_change":result.romantic},expected.result.effects),prefix+" effects")
		check(result.summary==expected.result.summary,prefix+" summary")
		check(equal({"relationships":a.relationships,"memory":a.memory},expected.npc),prefix+" NPC state")
		check(equal({"relationships":p.relationships,"memory":p.memory,"chatHistory":p.chatHistory,"_recentChatTick":p._recentChatTick},expected.player),prefix+" player state")
		check(equal(w.data.messageLog,expected.logs),prefix+" logs")
		check(w.rng.state==int(c.rng),prefix+" RNG")
	var report:={"checks":checks,"failures":failures,"scope":"1063 original fallback scenarios: all topic branches, traits, jobs, relationships, time and needs, exact reply/effects/memories/history/logs/RNG; heart events excluded"}
	FileAccess.open("res://docs/PLAYER_OFFLINE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

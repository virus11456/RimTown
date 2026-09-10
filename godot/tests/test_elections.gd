extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	for c in JSON.parse_string(FileAccess.get_file_as_string("res://tests/elections/oracle.json")):
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=int(c.seed);SimElections.start(w)
		var actual: Array=w.data.election.candidates.duplicate(true);var expected: Array=c.election.candidates.duplicate(true)
		for a in actual: a.erase("speech")
		for a in expected: a.erase("speech")
		check(equal(actual,expected),"original candidate ranking and policies")
		for pair in c.votes: check(SimElections.choose_vote(w,w.data.agents[pair[0]]).agentId==pair[1],"original vote scoring")
		check(w.rng.state==int(c.rng),"original election RNG excluding speech text")
	var w:=SimWorld.new();w.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json")));w.elections_enabled=true;w.quests_enabled=true;SimQuests.init(w)
	var first:=true
	for day in 100:
		for i in 96: w.tick()
		var e:=SimElections.state(w)
		if e.phase=="campaign" and first:
			check(w.data.clock.year==1 and w.data.clock.season=="秋季" and w.data.clock.day==1,"first year natural autumn election")
			var before:=w.snapshot();check(not SimElections.register(w,"welfare").ok,"registration backers gate");check(equal(before,w.snapshot()),"rejected registration atomic")
			first=false
		if e.phase=="voting" and not e.votes.has("player"):
			check(SimElections.vote(w,e.candidates[0].agentId),"player votes")
			var before:=w.snapshot();check(not SimElections.vote(w,e.candidates[1].agentId),"one player vote");check(equal(before,w.snapshot()),"duplicate vote atomic")
		var before:=w.snapshot();SimElections.daily(w);check(equal(before,w.snapshot()),"same day idempotent")
		if day==33:
			var resumed:=SimWorld.new();resumed.load_snapshot(w.snapshot())
			for i in 96: w.tick();resumed.tick()
			check(equal(w.snapshot(),resumed.snapshot()),"election voting reload deterministic")
	check(w.data.election.electionHistory.size()==2,"two annual natural elections")
	check(w.data.questSystem.electionsHeld==2,"real results increment quest once")
	for h in w.data.election.electionHistory: check(h.totalVotes==w.data.agents.size(),"every resident plus traveler votes once")
	var before:=w.snapshot();SimElections.finish(w);check(equal(before,w.snapshot()),"results cannot pay twice")
	SimElections.clear_policy(w);var base: Dictionary=w.data.news.activeModifiers.duplicate(true)
	SimElections.apply_policy(w,"economy","測試鎮長");var bonus: Dictionary=w.data.news.activeModifiers.duplicate(true);SimElections.apply_policy(w,"economy","測試鎮長")
	check(equal(bonus,w.data.news.activeModifiers),"policy replacement never stacks")
	w.quest_balance.election_policy.expires=SimClock.total_days(w.data.clock);SimElections.expire_policy(w);check(equal(base,w.data.news.activeModifiers),"expiry restores unrelated modifiers")
	w.data.election.active=false;w.data.election.phase="none";SimElections.start(w);w.data.prosperity.prosperity=30
	for a in SimElections.residents(w).slice(0,3): SimSocial.relationship(a,w.data.agents.player).affinity=50
	check(SimElections.register(w,"culture").ok,"qualified player registration")
	check(not SimElections.register(w,"culture").ok,"no duplicate candidate")
	FileAccess.open("res://tests/elections/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(w.snapshot()))
	var report:={"checks":checks,"failures":failures,"scope":"five source candidate/policy/vote oracles (speech text excluded), two natural autumn elections, first-year date fix, ballots, qualification, quest counter, deterministic resume, policy replacement/expiry; explicit backer fixture only for registration"}
	FileAccess.open("res://docs/ELECTION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

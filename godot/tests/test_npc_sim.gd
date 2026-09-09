extends SceneTree
var checks:=0
var failures: Array=[]
func check(value: bool,message: String) -> void:
	checks+=1
	if not value and failures.size()<30: failures.append(message)
func equal(a: Variant,b: Variant) -> bool:
	if (a is float or a is int) and (b is float or b is int): return absf(float(a)-float(b))<.00000001
	if a is Dictionary and b is Dictionary:
		if a.size()!=b.size(): return false
		for key in a:
			if not b.has(key) or not equal(a[key],b[key]): return false
		return true
	if a is Array and b is Array:
		if a.size()!=b.size(): return false
		for i in a.size():
			if not equal(a[i],b[i]): return false
		return true
	return a==b
func _initialize() -> void:
	var perception:= "--perception" in OS.get_cmdline_user_args()
	var trace:= perception or "--trace" in OS.get_cmdline_user_args()
	var mourning:= trace or "--mourning" in OS.get_cmdline_user_args()
	var mischief:= mourning or "--mischief" in OS.get_cmdline_user_args()
	var stargazing:= mischief or "--stargazing" in OS.get_cmdline_user_args()
	var inner_voice:= stargazing or "--inner-voice" in OS.get_cmdline_user_args()
	var thoughts:= inner_voice or "--thoughts" in OS.get_cmdline_user_args()
	var factions:= thoughts or "--factions" in OS.get_cmdline_user_args()
	var feuds:= factions or "--feuds" in OS.get_cmdline_user_args()
	var romance:= feuds or "--romance" in OS.get_cmdline_user_args()
	var gossip:= romance or "--gossip" in OS.get_cmdline_user_args()
	for theme in ["frontier","harbor"]:
		var fixture: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/social/"+theme+("-perception" if perception else "-trace" if trace else "-mourning" if mourning else "-mischief" if mischief else "-stargazing" if stargazing else "-inner-voice" if inner_voice else "-thoughts" if thoughts else "-factions" if factions else "-feuds" if feuds else "-romance" if romance else "-gossip" if gossip else "")+"-simulation.json"))
		var world:=SimWorld.new()
		world.load_snapshot(fixture.input)
		world.social_enabled=true
		world.gossip_enabled=gossip
		world.romance_enabled=romance
		world.feuds_enabled=feuds
		world.factions_enabled=factions
		world.thoughts_enabled=thoughts
		world.inner_voice_enabled=inner_voice
		world.stargazing_enabled=stargazing
		world.mischief_enabled=mischief
		world.mourning_enabled=mourning
		world.trace_enabled=trace
		world.perception_enabled=perception
		for checkpoint in fixture.checkpoints:
			while world.data.tickCount<checkpoint.tick: world.tick()
			if gossip:
				check(equal(world.snapshot().gossip,checkpoint.gossip),theme+"/gossip")
				check(equal(world.snapshot().townFeed,checkpoint.townFeed),theme+"/town feed")
			var tag:="%s/%d/"%[theme,checkpoint.tick]
			if feuds: check(equal(world.data.feudCooldown,checkpoint.feudCooldown),tag+"feud cooldown")
			if factions:
				for key in ["factions","events"]: check(equal(world.data[key],checkpoint[key]),tag+key)
			check(world.rng.state==int(checkpoint.rng),tag+"rng")
			check(equal(world.data.clock,checkpoint.clock),tag+"clock")
			for id in checkpoint.agents:
				var expected: Dictionary=checkpoint.agents[id]
				var a: Dictionary=world.data.agents[id]
				if perception:
					check(equal({"day":world.runtime[id].get("obs_day",""),"count":world.runtime[id].get("obs_count",0)},expected.observation),tag+id+"/observation counter")
				if trace:
					check(equal(a.get("todayTrace",[]),expected.todayTrace),tag+id+"/trace")
					check(a.get("_traceDay","")==expected._traceDay,tag+id+"/trace day")
				if mourning:
					for field in ["_mourningTargets","_annualMourning"]: check(equal(a.get(field,[]),expected[field]),tag+id+"/"+field)
				if inner_voice: check(a.get("currentThought")==expected.currentThought,tag+id+"/inner voice")
				if romance:
					check(equal(a.thoughts,expected.thoughts),tag+id+"/thoughts")
					check(equal(world.runtime[id].moodModifier,expected.moodModifier),tag+id+"/mood modifier")
				for key in ["needs","activity","currentLocation","mood","skills","relationships"]:
					check(equal(a.get(key),expected[key]),tag+id+"/"+key)
				check(equal(a.get("_lastInteractionTick",0),expected.lastInteraction),tag+id+"/cooldown")
				check(equal(a.get("_pendingHangout"),expected.hangout),tag+id+"/hangout")
				check(a.memory.size()==int(expected.memoryCount),tag+id+"/memory count")
				var texts: PackedStringArray=[]
				for memory in a.memory: texts.append(memory.content)
				check("\n".join(texts).sha256_text()==expected.memoryHash,tag+id+"/memory hash")
				check(equal(a.memory.slice(maxi(0,a.memory.size()-5)),expected.memoryTail),tag+id+"/memory tail")
			var all_lines: PackedStringArray=[]
			for conversation in world.data.npcConversationLog:
				for line in conversation.dialogue: all_lines.append(line.speaker+":"+line.text)
			check("\n".join(all_lines).sha256_text()==checkpoint.conversationHash,tag+"all dialogue lines")
			check(world.data.npcConversationLog.size()==int(checkpoint.conversationCount),tag+"conversation count")
			check(equal(world.data.npcConversationLog.slice(maxi(0,world.data.npcConversationLog.size()-5)),checkpoint.conversationTail),tag+"dialogue")
			check(world.data.messageLog.size()==int(checkpoint.logCount),tag+"log count")
			check(equal(world.data.messageLog.slice(maxi(0,world.data.messageLog.size()-5)),checkpoint.logTail),tag+"log tail")
		var resumed:=SimWorld.new()
		resumed.load_snapshot(JSON.parse_string(JSON.stringify(world.snapshot(),"",false,true)))
		for i in 96: world.tick(); resumed.tick()
		check(equal(world.snapshot(),resumed.snapshot()),theme+"/save resume with cooldown/hangout/RNG")
	var report:={"checks":checks,"failures":failures,"gossip_enabled":gossip,"romance_enabled":romance,"feuds_enabled":feuds,"factions_enabled":factions,"thoughts_enabled":thoughts,"inner_voice_enabled":inner_voice,"stargazing_enabled":stargazing,"mischief_enabled":mischief,"mourning_enabled":mourning,"trace_enabled":trace,"perception_enabled":perception,"scope":"two towns x 2880 ticks: Phase 4a + local socializing; gossip, daily romance, feuds, factions and daily thoughts and inner voice included only when respective flags enabled; news and other systems excluded"}
	FileAccess.open("res://docs/NPC_PERCEPTION_TESTS.json" if perception else "res://docs/NPC_TRACE_TESTS.json" if trace else "res://docs/NPC_MOURNING_TESTS.json" if mourning else "res://docs/NPC_MISCHIEF_TESTS.json" if mischief else "res://docs/NPC_STARGAZING_TESTS.json" if stargazing else "res://docs/NPC_INNER_VOICE_TESTS.json" if inner_voice else "res://docs/NPC_THOUGHTS_TESTS.json" if thoughts else "res://docs/NPC_FACTIONS_TESTS.json" if factions else "res://docs/NPC_FEUDS_TESTS.json" if feuds else "res://docs/NPC_ROMANCE_TESTS.json" if romance else "res://docs/NPC_GOSSIP_TESTS.json" if gossip else "res://docs/NPC_SOCIAL_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

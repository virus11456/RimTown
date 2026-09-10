extends "res://tests/test_player_chat_ui.gd"
var initial: Dictionary
func fresh() -> SimWorld:
	var w:=SimWorld.new();w.load_snapshot(initial);w.quests_enabled=true;SimQuests.init(w);SimNPCQuests.init(w);return w
func run() -> void:
	initial=JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json"))
	var defs:=SimQuests.rules()
	for def in defs.main:
		for route in def.get("routes",[{}]):
			var w:=fresh();var q: Dictionary=w.data.questSystem;q.quests[def.id].status="active"
			var before:=SimEconomy.amount(w,"silver");SimQuests.complete(w,def,route)
			check(q.quests[def.id].status=="completed","main route "+def.id+" "+str(route.get("id","default")))
			check(SimEconomy.amount(w,"silver")==before+float(def.get("rewards",{}).get("silver",0)),"main exact reward")
			var snapshot:=w.snapshot();SimQuests.complete(w,def,route);check(equal(snapshot,w.snapshot()),"no main duplicate reward")
	for npc_id in defs.personal:
		for def in defs.personal[npc_id].quests:
			for route in def.routes:
				var w:=fresh();w.data.npcQuests.quests[def.id]={"status":"active","npcId":npc_id,"title":def.title}
				SimNPCQuests.complete(w,def.id,def,route)
				check(w.data.npcQuests.quests[def.id].completedRoute==route.id,"personal route "+def.id)
				var snapshot:=w.snapshot();SimNPCQuests.complete(w,def.id,def,route);check(equal(snapshot,w.snapshot()),"no personal duplicate")
	for key in defs.endings:
		for married in [false,true]:
			var w:=fresh();w.data.multiEnding={}
			if married: SimSocial.relationship(w.data.agents.player,w.data.agents.chen_wei).status="married"
			SimEndings.trigger(w,key)
			var expected: String="personal" if married and key!="legend" else key
			check(w.data.multiEnding.endingTriggered==expected,"ending selection")
			var snapshot:=w.snapshot();SimEndings.trigger(w,"legend");check(equal(snapshot,w.snapshot()),"ending frozen")
	var w:=fresh();w.supply_enabled=true;var q: Dictionary=w.data.questSystem
	q.dailyObjective={"id":"d_chat1","startValue":0,"completed":false}
	var daily_def: Dictionary=defs.daily.filter(func(d): return d.condition.type=="chat_count")[0]
	q.dailyObjective.id=daily_def.id;q.chatCount=100
	SimQuests.daily(w);check(q.dailyObjective.completed,"daily earned")
	var silver:=SimEconomy.amount(w,"silver");var rep: float=q.reputation
	for i in 100: q.dailyObjective.completed=true;SimQuests.daily(w)
	check(SimEconomy.amount(w,"silver")==silver and q.reputation==rep,"one daily reward per calendar day")
	var resumed:=SimWorld.new();resumed.load_snapshot(w.snapshot());SimQuests.daily(resumed)
	check(equal(w.snapshot(),resumed.snapshot()),"daily cap persists")
	for key in defs.goals:
		w=fresh();SimLifeGoals.assign(w);var npc: Dictionary=w.data.agents.chen_wei
		w.data.lifeGoals.goals.chen_wei={"key":key,"stage":2,"stageStartDay":-100,"done":false}
		w.data.prosperity={"score":100};w.data.council={"members":["chen_wei"]};w.data.lifecycle={"births":[{"parentNames":[npc.name]}]}
		SimSocial.relationship(npc,w.data.agents.lin_mei).status="married"
		for skill in npc.skills: npc.skills[skill].xp=100000
		for i in 100:
			if w.data.lifeGoals.goals.chen_wei.done: break
			SimLifeGoals.daily(w)
		check(w.data.lifeGoals.goals.chen_wei.done,"final named stage completes "+key)
		check(not SimLifeGoals.nudge(w,"chen_wei"),"completed cannot nudge")
	w=fresh();SimLifeGoals.assign(w);var rel:=SimSocial.relationship(w.data.agents.chen_wei,w.data.agents.player);var aff: float=rel.affinity
	check(SimLifeGoals.nudge(w,"chen_wei") and rel.affinity==aff+4,"nudge gives 4")
	check(not SimLifeGoals.nudge(w,"chen_wei") and rel.affinity==aff+4,"nudge cannot farm affinity")
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	w=app.simulation;check(w.quests_enabled,"main default enabled")
	for category in ["main","side","personal","daily","life","ending"]:
		app.show_quests(category);await settle()
		for child in app.drawer_body.get_children():
			if child is Control: check(child.size.x<=app.drawer.size.x,"mobile "+category)
	var before_count: int=w.data.questSystem.chatCount;app.chat_offline=true;app.show_tab("居民",true);app.send_player_chat("chen_wei","你好")
	check(w.data.questSystem.chatCount==before_count+1,"successful chat counted")
	var before_bad: int=w.data.questSystem.chatCount;app.send_player_chat("chen_wei","");check(w.data.questSystem.chatCount==before_bad,"empty chat not counted")
	check("quests" in SimPlayerChat.prompt(w,"chen_wei","有任務嗎？"),"quest context in AI prompt")
	resumed.load_snapshot(w.snapshot())
	for i in 96*10: w.tick();resumed.tick()
	check(equal(w.snapshot(),resumed.snapshot()),"ten-day complete package resume")
	FileAccess.open("res://tests/quests/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(w.snapshot(),"",false,true))
	var report:={"checks":checks,"failures":failures,"scope":"all main and personal completion routes, four endings and spouse override, no duplicate rewards, daily cap/reload, all six final life stages, nudge guard, six mobile pages, chat counters and ten-day resume; world prerequisite fixtures explicitly supplied"}
	FileAccess.open("res://docs/QUEST_PACKAGE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

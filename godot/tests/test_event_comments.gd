extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	check(w.event_comments_enabled and not w.event_comments_online,"local comments by default")
	var initial: Dictionary=w.snapshot()
	for key in SimEventComments.JOBS:
		SimEventComments.enqueue(w,key,SimEventComments.JOBS[key]);var item: Dictionary=w.event_comments.back()
		var eligible: Array=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false) and not a.get("isDead",false) and SimPlayerChat.job(w,a).get("key","") in SimEventComments.JOBS[key])
		check(eligible.is_empty() or w.data.agents[item.npc] in eligible,"preferred job "+key)
		check(SimEventComments.apply(w,item),"local apply "+key)
		check(not SimEventComments.apply(w,item),"cannot duplicate "+key)
	SimEventComments.enqueue(w,"school",["researcher"],["chen_wei"])
	check(w.event_comments.back().npc=="chen_wei","preferred id before job")
	var pending: Dictionary=w.snapshot();var resumed:=SimWorld.new();resumed.load_snapshot(pending)
	check(equal(resumed.event_comments,w.event_comments),"pending saved")
	SimEventComments.apply(w,w.event_comments[0]);SimEventComments.apply(resumed,resumed.event_comments[0])
	check(equal(w.snapshot(),resumed.snapshot()),"pending resume same fallback and rng")
	w.load_snapshot(initial);w.event_comments_online=true;app.event_comment_transport=mock
	SimEventComments.enqueue(w,"小鎮蓋好了新的「學校」",[],["chen_wei"])
	var history: int=w.data.agents.player.get("chatHistory",[]).size()
	var rels: Dictionary=w.data.agents.chen_wei.relationships.duplicate(true)
	reply={"ok":true,"data":{"reply":"「陳偉：大家終於有地方讀書了！」"}}
	app.process_event_comment();app.process_event_comment()
	check(requests==1 and app.event_comment_busy,"one request in flight")
	check("學校" in last_prompt and "旅人" in last_prompt,"event and player title prompt")
	release_reply.emit();await settle()
	check(w.data.agents.player.chatHistory.size()==history+1,"online one history entry")
	check(w.data.agents.player.chatHistory.back().text=="大家終於有地方讀書了！","quotes and prefix cleaned")
	check(equal(rels,w.data.agents.chen_wei.relationships),"comment no relationship effects")
	check(w.data.agents.chen_wei.memory.back().importance==3,"comment memory importance")
	for bad in [{"ok":false,"status":429},{"ok":true,"data":[]},{"ok":true,"data":{"reply":"__ERROR__"}},{"ok":true,"data":{"reply":"  "}}]:
		SimEventComments.enqueue(w,"組合發現",[],["chen_wei"]);var fallback: String=w.event_comments[0].fallback
		reply=bad;app.process_event_comment();release_reply.emit();await settle()
		check(w.data.agents.player.chatHistory.back().text==fallback,"failure local fallback")
	SimEventComments.enqueue(w,"過期事件",[],["chen_wei"]);app.process_event_comment();app.load_demo("harbor")
	var harbor: Dictionary=w.snapshot();release_reply.emit();await settle()
	check(equal(harbor,w.snapshot()) and not app.event_comment_busy,"stale response cannot touch new world")
	w.load_snapshot(initial);w.event_comments_online=true
	SimEventComments.enqueue(w,"居民離世",[],["chen_wei"]);app.process_event_comment();w.data.agents.chen_wei.isDead=true
	history=w.data.agents.player.get("chatHistory",[]).size();release_reply.emit();await settle()
	check(w.data.agents.player.get("chatHistory",[]).size()==history and w.event_comments.is_empty(),"dead recipient drops comment")
	w.load_snapshot(initial);w.combos_enabled=true;w.data.combosFound=[];w.data.decorations=[{"type":"bench","x":21,"y":21}]
	for r in w.data.stockpile.resources: w.data.stockpile.resources[r]=10000
	var project:=SimBuildings.start(w,"school");project.siteX=20;project.siteY=20;project.workDone=project.workRequired;SimBuildings.daily(w)
	check(w.event_comments.size()==2 and "新組合" in w.event_comments[0].event and "蓋好了" in w.event_comments[1].event,"combo then completion callbacks")
	project=SimBuildings.start(w,"school",true);project.workDone=project.workRequired;SimBuildings.daily(w);SimCombos.check_new(w)
	check(w.event_comments.size()==2,"upgrade and rediscovery no comment")
	app.show_tab("設定",true);check(has_text(app.drawer_body,"背景額度"),"online cost explained")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.custom_minimum_size.x<=375,"mobile settings")
	var report:={"checks":checks,"failures":failures,"scope":"preferred speakers, once-only apply, persisted pending queue, local/default and mock AI success/failure, stale town/death, completion/combo order, no upgrades; no production requests"}
	FileAccess.open("res://docs/EVENT_COMMENT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
const Source=preload("res://scripts/sim/sim_recall_source.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;w.data.tickCount=200
	var cases: Array=[]
	for state in ["met","missed","cancelled"]:
		cases.append({"type":"appointment","row":{"npc":"chen_wei","state":state,"resolved_tick":10,"time":"第 1 天 18:00","due":10,"place":"town_square","reason":"約定結果"},"source":{"npc":"chen_wei","state":state,"resolved_tick":10,"time":"第 1 天 18:00"}})
	for state in ["completed","cancelled"]:
		cases.append({"type":"service","row":{"npc":"chen_wei","state":state,"tick":10,"serial":1,"job":"doctor","reason":"服務結果","time":"第 1 天 18:30","place":"廣場"},"source":{"kind":"service","npc":"chen_wei","state":state,"resolved_tick":10,"identity":"1","job":"doctor","reason":"服務結果"}})
	for state in ["recovered","time_limit","cancelled"]:
		cases.append({"type":"care_recovery","row":{"state":state,"tick":10,"code":"deadline","meal_ticks":2,"rest_ticks":3},"source":{"kind":"care_recovery","npc":"chen_wei","state":state,"resolved_tick":10,"code":"deadline","meal_ticks":2,"rest_ticks":3}})
	for state in ["completed","missed","cancelled"]:
		cases.append({"type":"leisure","row":{"state":state,"resolved_tick":10,"day":1,"place_name":"廣場"},"source":{"kind":"leisure","npc":"chen_wei","state":state,"resolved_tick":10,"day":1}})
	var care:={"state":"completed","tick":10,"provider":"lin_mei","job":"doctor","followup":{"until":106,"home":{"tick":20,"when":"第 1 天 20:00","place":"家"},"work":{"tick":30,"when":"第 2 天 08:00","place":"農田"}}}
	cases.append({"type":"resident_care","row":care,"source":{"kind":"resident_care","npc":"chen_wei","facts":{"state":"completed","tick":10,"provider":"lin_mei","job":"doctor","home":care.followup.home.duplicate(true)}}})
	for item in cases:
		var rows: Array=[item.row.duplicate(true)]
		match item.type:
			"appointment":w.quest_balance.appointments={"history":rows}
			"service":w.quest_balance.service_outcomes=rows
			"care_recovery":w.data.agents.chen_wei._careRecoveryResults=rows
			"resident_care":w.data.agents.chen_wei._careResults=rows
			"leisure":w.quest_balance.leisure_history={"chen_wei":rows}
		var source: Dictionary=item.source
		w.data.tickCount=200
		var before:=w.snapshot();var record:=Source.resolve(w,"chen_wei",source)
		check(not record.is_empty(),"canonical source resolves "+item.type+" "+item.row.state)
		check(equal(before,w.snapshot()),"source is readonly")
		check(Source.resolve(w,"lin_mei",source).is_empty(),"wrong resident rejected")
		var bad:=source.duplicate(true)
		if item.type=="resident_care":bad.facts.home.tick+=1
		else:bad.resolved_tick+=1
		check(Source.resolve(w,"chen_wei",bad).is_empty(),"altered source rejected")
		rows.append(rows[0].duplicate(true));check(Source.resolve(w,"chen_wei",source).is_empty(),"ambiguous record rejected");rows.pop_back()
		w.data.tickCount=5;check(Source.resolve(w,"chen_wei",source).is_empty(),"future event rejected");w.data.tickCount=1000
		check(not Source.resolve(w,"chen_wei",source).is_empty(),"old source remains inspectable");w.data.tickCount=200
		var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
		check(equal(record,Source.resolve(restored,"chen_wei",source)),"source survives save reload")
		if item.type=="resident_care":check(not "上工：" in str(record.lines),"later uncited work is not added to original memory")
		w.data.agents.player.chatHistory=[{"speaker":w.data.agents.chen_wei.name,"target":w.data.agents.player.name,"text":"回想那次經歷。","_godotRecall":source.duplicate(true)}]
		app.show_player_chat("chen_wei");await settle();app.chat_drafts.chen_wei="尚未送出"
		press(app.drawer_body,"查看這段生活回憶紀錄");await settle()
		check(has_text(app.drawer_body,record.title),"chat button opens correct source category")
		check(has_text(app.drawer_body,record.lines[0]),"source shows actual terminal state")
		for child in app.drawer_body.get_children():
			if child is Control:check(child.size.x<=app.drawer.size.x,"source fits 375px")
		app._tick_simulation();await settle();check(app.resident_page=="review_source","tick keeps source open")
		press(app.drawer_body,"返回原對話");await settle();check(app.chat_drafts.chen_wei=="尚未送出","return preserves draft")
		rows.clear();check(Source.resolve(w,"chen_wei",source).is_empty(),"deleted ledger cannot be reconstructed from chat")
		app.show_life_recall_source("chen_wei",source);await settle();check(has_text(app.drawer_body,"無法核對"),"missing ledger explained")
	# Exercise the actual source producers, including legacy service identities and
	# the saved natural three-day care journey rather than only matching fixtures.
	w=SimWorld.new();w.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://tests/golden/frontier-day-01.json")))
	w.quest_balance.appointments={"current":{"npc":"chen_wei","place":"town_square","due":0,"time":"第 1 天 18:00","state":"accepted","npc_arrived":true},"history":[]}
	SimAppointments.finish(w,"met","已見面");w.data.tickCount+=96
	check(not Source.resolve(w,"chen_wei",SimTalkRecall.pick(w,"chen_wei",{}).source).is_empty(),"actual appointment producer resolves")
	for job in ["doctor","priest"]:
		SimServiceChat.outcome(w,{"job":job,"target":"chen_wei","location":"town_square"},"completed","服務完成")
		w.data.tickCount+=4
		check(not Source.resolve(w,"chen_wei",SimServiceChat.recall(w,"chen_wei",{}).source).is_empty(),"actual service producer resolves "+job)
		w.quest_balance.service_outcomes.back().erase("serial")
		var legacy: Dictionary=SimServiceChat.recall(w,"chen_wei",{}).source
		check(not Source.resolve(w,"chen_wei",legacy).is_empty(),"legacy identity resolves "+job)
		var loaded:=SimWorld.new();loaded.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot())))
		check(not Source.resolve(loaded,"chen_wei",legacy).is_empty(),"legacy identity survives JSON reload "+job)
	w.quest_balance.leisure_plans={"chen_wei":{"day":SimTrace.day_key(w.data.clock),"place":"park","hour":18,"state":"scheduled"}}
	SimLeisurePlan.finish(w,"chen_wei","missed","未到場");w.data.tickCount+=4
	check(not Source.resolve(w,"chen_wei",SimLeisureChat.recall(w,"chen_wei",{}).source).is_empty(),"actual leisure producer resolves")
	w.quest_balance.appointments={}
	w.data.agents.chen_wei._careRecoveryResults=[{"tick":int(w.data.tickCount),"state":"time_limit","code":"deadline","meal_ticks":2,"rest_ticks":3}]
	w.data.tickCount+=96
	check(not Source.resolve(w,"chen_wei",SimTalkRecall.pick(w,"chen_wei",{}).source).is_empty(),"actual recovery producer resolves")
	var natural:=SimWorld.new();natural.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://docs/CARE_FOLLOWUP_HARBOR_PROGRESS.rimtown")))
	var actual: Dictionary=SimCareChat.recall(natural,"hb_shishu",{}).source
	var verified:=Source.resolve(natural,"hb_shishu",actual)
	check(not verified.is_empty() and "到家：" in str(verified.lines) and "上工：" in str(verified.lines),"natural care record resolves observed home and work")
	actual.facts=[];check(Source.resolve(natural,"hb_shishu",actual).is_empty(),"malformed care facts rejected")
	actual.erase("facts");actual.resolved_tick=146;check(Source.resolve(natural,"hb_shishu",actual).is_empty(),"missing care facts rejected")
	var report:={"checks":checks,"failures":failures,"scope":"Controlled canonical ledger fixtures; five source categories and terminal outcomes; headless 375px UI, not native visual acceptance"}
	FileAccess.open("res://docs/LIFE_RECALL_SOURCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

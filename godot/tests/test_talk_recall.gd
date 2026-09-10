extends "res://tests/test_daily_talk.gd"
func outcome(w: SimWorld,state: String,arrived:=false,id: String="chen_wei") -> Dictionary:
	w.quest_balance.appointments={"current":{"npc":id,"place":"town_square","due":0,"time":"小鎮第 1 天 18:00","state":"accepted","npc_arrived":arrived},"history":[]}
	SimAppointments.finish(w,state,"test outcome")
	return w.quest_balance.appointments.history.back()
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
	var event:=outcome(w,"met")
	check(event.has("resolved_tick"),"real outcome writer records resolution time")
	check(SimTalkRecall.pick(w,"chen_wei",{}).is_empty(),"no immediate repetitive follow-up")
	w.data.tickCount+=96;w.data.clock.day+=1
	var stock: Dictionary=w.data.stockpile.duplicate(true);var rels: Dictionary=w.data.agents.chen_wei.relationships.duplicate(true)
	check(SimDailyTalk.observe(w,m)=="chen_wei","normal nearby greeting can recall verified meeting")
	var entry: Dictionary=w.data.agents.player.chatHistory.back()
	check(entry.has("_godotRecall") and entry._godotRecall.state=="met" and "碰面的事" in entry.text,"follow-up cites met outcome")
	check(equal(stock,w.data.stockpile) and equal(rels,w.data.agents.chen_wei.relationships),"recall offers no reward")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
	check(SimTalkRecall.pick(restored,"chen_wei",restored.quest_balance.daily_talk).is_empty(),"reload cannot repeat same memory")
	w.data.tickCount+=96;w.data.clock.day+=1;SimDailyTalk.observe(w,m)
	check(not w.data.agents.player.chatHistory.back().has("_godotRecall"),"next day returns to normal talk rather than repeating")
	for state in ["missed","cancelled"]:
		f=setup();w=f.w;outcome(w,state);w.data.tickCount+=96
		var recall:=SimTalkRecall.pick(w,"chen_wei",{})
		check(not recall.is_empty() and ("我沒能趕到" in recall.text if state=="missed" else "取消" in recall.text),"honest follow-up for "+state)
	f=setup();w=f.w;outcome(w,"missed",true);w.data.tickCount+=96
	check("我們沒能" in SimTalkRecall.pick(w,"chen_wei",{}).text,"arrived NPC does not assume player is to blame")
	check(SimTalkRecall.pick(w,"lin_mei",{}).is_empty(),"cannot claim another resident's experience")
	w.data.tickCount+=673;check(SimTalkRecall.pick(w,"chen_wei",{}).is_empty(),"stale outcomes not resurfaced indefinitely")
	f=setup();w=f.w;event=outcome(w,"met");event.erase("resolved_tick");w.data.tickCount+=96
	check(SimTalkRecall.pick(w,"chen_wei",{}).is_empty(),"legacy records with unknown age are not guessed")
	f=setup();w=f.w;event=outcome(w,"met");w.data.tickCount=96
	var newer:=event.duplicate(true);newer.state="cancelled";newer.resolved_tick=90;w.quest_balance.appointments.history.append(newer)
	check(SimTalkRecall.pick(w,"chen_wei",{}).is_empty(),"recent later outcome supersedes older ready memory")
	w.data.tickCount=186
	var consumed:={"recalled":[SimTalkRecall.key(newer)]}
	check(SimTalkRecall.pick(w,"chen_wei",consumed).is_empty(),"consumed latest outcome does not resurrect older ones")
	f=setup();w=f.w;SimFeuds._memory(w.data.agents.chen_wei,w,"conversation","我們已經完成見面，明天再見。",9,[])
	check(SimTalkRecall.pick(w,"chen_wei",{}).is_empty(),"free-text claim is not evidence of a completed meeting")
	var report:={"checks":checks,"failures":failures,"scope":"structured outcome writer and configured outcomes, day/age bounds, actual nearby talk hook, source attribution, no rewards, once-only reload, latest outcome, legacy and free-text safeguards"}
	FileAccess.open("res://docs/TALK_RECALL_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

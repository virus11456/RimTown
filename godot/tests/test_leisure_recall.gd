extends "res://tests/test_daily_talk.gd"
func record(w: SimWorld,state: String) -> void:
	w.quest_balance.leisure_plans={"chen_wei":{"day":SimTrace.day_key(w.data.clock),"place":"park","hour":18,"state":"scheduled"}}
	SimLeisurePlan.finish(w,"chen_wei",state,"已確認到場，但停留因需求中斷。")
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
	record(w,"completed")
	check(SimLeisureChat.recall(w,"chen_wei",{}).is_empty(),"wait at least one game hour")
	w.data.tickCount+=4
	var before:=w.snapshot();var r:=SimLeisureChat.recall(w,"chen_wei",{})
	check(not r.is_empty() and r.source.kind=="leisure" and not "我們" in r.text,"personal factual recollection no shared visit claim")
	check(equal(before,w.snapshot()),"selecting memory is read-only")
	var stock: Dictionary=w.data.stockpile.duplicate(true);var rels: Dictionary=w.data.agents.chen_wei.relationships.duplicate(true)
	check(SimDailyTalk.observe(w,m)=="chen_wei","nearby idle resident uses existing daily talk")
	check(w.data.agents.player.chatHistory.back()._godotRecall.kind=="leisure","visible local greeting preserves source")
	check(equal(stock,w.data.stockpile) and equal(rels,w.data.agents.chen_wei.relationships),"no resources or affinity rewards")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
	check(SimLeisureChat.recall(restored,"chen_wei",restored.quest_balance.daily_talk).is_empty(),"reload cannot repeat recollection")
	check(SimDailyTalk.observe(w,m).is_empty(),"daily talk cap and cooldown retained")
	for state in ["missed","cancelled"]:
		f=setup();w=f.w;record(w,state);w.data.tickCount+=4;r=SimLeisureChat.recall(w,"chen_wei",{})
		check(("沒有完成" if state=="missed" else "取消") in r.text,"honest personal outcome: "+state)
	f=setup();w=f.w;record(w,"completed");w.data.tickCount+=193
	check(SimLeisureChat.recall(w,"chen_wei",{}).is_empty(),"older than two days ignored")
	w.data.tickCount=4;check(SimLeisureChat.recall(w,"lin_mei",{}).is_empty(),"no other resident's memory")
	SimLeisurePlan.history(w,"chen_wei").back().erase("resolved_tick")
	check(SimLeisureChat.recall(w,"chen_wei",{}).is_empty(),"legacy unknown age ignored")
	f=setup();w=f.w;w.data.agents.chen_wei.memory=[{"content":"我已經去過公園"}]
	check(SimLeisureChat.recall(w,"chen_wei",{}).is_empty(),"free text alone cannot establish completion")
	var report:={"checks":checks,"failures":failures,"scope":"controlled structured outcomes and physical proximity, source attribution, one-hour/two-day bounds, personal not shared memory, caps/reload and no rewards; local rules not generative reflection"}
	FileAccess.open("res://docs/LEISURE_RECALL_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

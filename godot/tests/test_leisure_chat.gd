extends "res://tests/test_leisure_plan.gd"
func _initialize() -> void:
	var f:=fixture();var w: SimWorld=f.w;var p: Dictionary=SimLeisurePlan.plans(w).chen_wei
	for state in ["scheduled","traveling","attending","completed","missed","cancelled","skipped"]:
		p.state=state
		var c:=SimLeisureChat.context(w,"chen_wei");var text:=SimLeisureChat.reply(w,"chen_wei")
		check(c.current.state==state,"exact state: "+state)
		if state in ["scheduled","traveling","attending"]: check("還沒完成" in text and not "完成了" in text,"no premature completion: "+state)
		else: check(({"completed":"完成了","missed":"沒有在時段內","cancelled":"取消","skipped":"沒有足夠"}[state]) in text,"grounded response: "+state)
	p.state="scheduled";w.data.agents.chen_wei.dailyPlan={"blocks":[{"text":"我已經造好城堡"}]}
	var prompt:=SimPlayerChat.prompt(w,"chen_wei","你休閒完了嗎？")
	check('"leisure":' in prompt and '"state":"scheduled"' in prompt and not "造好城堡" in prompt,"AI prompt receives structured plan not fictional memo")
	var before:=w.snapshot();check(SimLeisureChat.ask(w,"chen_wei"),"local factual exchange added")
	var after:=w.snapshot();after.agents.player.chatHistory=before.agents.player.get("chatHistory",[])
	check(equal(before,after),"only chat history changes; no resources XP quests affinity RNG or plan mutation")
	before=w.snapshot();check(not SimLeisureChat.ask(w,"chen_wei") and equal(before,w.snapshot()),"immediate duplicate is no-op")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot());check(not SimLeisureChat.ask(restored,"chen_wei"),"reload retains duplicate protection")
	w.data.clock.day+=1;check(SimLeisureChat.context(w,"chen_wei").current.is_empty() and "還沒有排定" in SimLeisureChat.reply(w,"chen_wei"),"yesterday plan not claimed as today")
	w.quest_balance.leisure_plans_enabled=false;check("已關閉" in SimLeisureChat.reply(w,"chen_wei"),"disabled status factual")
	w.data.agents.chen_wei.isDead=true;before=w.snapshot();check(not SimLeisureChat.ask(w,"chen_wei") and equal(before,w.snapshot()),"dead resident cannot reply")
	var report:={"checks":checks,"failures":failures,"scope":"all plan states, source prompt context, no memo execution, only history mutation, duplicate/reload and stale/dead/disabled guards; no real model output verification"}
	FileAccess.open("res://docs/LEISURE_CHAT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

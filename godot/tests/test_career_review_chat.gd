extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	for choice in ["practice","cooperate"]:
		var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
		SimCareers.enroll(w,"guard");w.data.agents.player.currentLocation="quarry"
		check(SimCareers.start(w,"patrol:quarry").ok,"actual patrol starts")
		w.data.tickCount+=4;SimCareers.tick(w)
		check(SimCareerReviews.chat_context(w,"chen_wei").recentOutcomes.is_empty(),"earned stage alone is not completed review")
		var npc: Dictionary=w.data.agents.chen_wei;npc.jobKey="guard";npc.age=30;npc.currentLocation="town_square";npc.activity="idle";w.data.agents.player.currentLocation="town_square"
		check(SimCareerReviews.choose(w,"guard",1,"chen_wei",choice).ok,"real review records chosen branch")
		check(SimCareerReviews.recall(w,"chen_wei",{}).is_empty(),"fresh review waits before spontaneous recall")
		npc.jobKey="";w.data.agents.player.jobKey="cook";w.data.tickCount+=4
		var before:=w.snapshot();var recall:=SimCareerReviews.recall(w,"chen_wei",{})
		check(not recall.is_empty() and ("工作方法" if choice=="practice" else "合作經驗") in recall.text,"recall uses actual branch")
		check("前陣子" in recall.text and "守衛" in recall.text and "廚師" not in recall.text,"historical role is not current job")
		check(SimCareerReviews.recall(w,"lin_mei",{}).is_empty(),"uninvolved resident cannot claim review")
		check(equal(before,w.snapshot()),"reading facts grants nothing")
		var xp: Dictionary=w.data.agents.player.skills.duplicate(true);var stock: Dictionary=w.data.stockpile.duplicate(true);var rels: Dictionary=npc.relationships.duplicate(true)
		check(SimDailyTalk.observe(w,m)=="chen_wei","eligible nearby resident recalls actual review")
		check(w.data.agents.player.chatHistory.back()._godotRecall.kind=="career_review","conversation records factual source")
		check(equal(xp,w.data.agents.player.skills) and equal(stock,w.data.stockpile) and equal(rels,npc.relationships),"recall has no repeat reward or resource effect")
		var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
		check(SimCareerReviews.recall(restored,"chen_wei",restored.quest_balance.daily_talk).is_empty() and SimDailyTalk.observe(restored,m).is_empty(),"reload preserves recall and greeting limits")
		check("careerReviews" in SimPlayerChat.prompt(w,"chen_wei","記得我們聊过嗎？"),"free chat receives same bounded facts")
		w.quest_balance.career_reviews.guard["1"].erase("time")
		check(not SimCareerReviews.recall(w,"chen_wei",{}).is_empty(),"legacy completed record needs no fabricated time")
		w.data.tickCount=0;check(SimCareerReviews.recall(w,"chen_wei",{}).is_empty(),"future result excluded")
		w.data.tickCount=1000;check(SimCareerReviews.recall(w,"chen_wei",{}).is_empty(),"old review ages out of spontaneous recall")
	var report:={"checks":checks,"failures":failures,"scope":"real patrol and both review branches, proximity greeting, historical role, participant-only source, no repeated rewards, prompt facts, age window and reload"}
	FileAccess.open("res://docs/CAREER_REVIEW_CHAT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

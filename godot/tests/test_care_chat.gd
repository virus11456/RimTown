extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m
	w.data.tickCount=180
	var a: Dictionary=w.data.agents.chen_wei
	var receipt:={"state":"completed","tick":146,"provider":"lin_mei","job":"doctor","amount":15,"followup":{"state":"observing","until":242,"next":{"tick":147,"intent":"進食"}}}
	a._careResults=[receipt]
	var before:=w.snapshot()
	var recall:=SimCareChat.recall(w,"chen_wei",{})
	check(not recall.is_empty() and str(w.data.agents.lin_mei.name) in recall.text,"names actual resident provider")
	check("吃" not in recall.text and "到家" not in recall.text and "上工" not in recall.text and "謝謝你" not in recall.text,"intent does not invent completion or credit player")
	check(equal(before,w.snapshot()),"context and recall are read only")
	receipt.followup.home={"tick":154,"when":"春季 2 日 20:30","place":"住家"}
	check("春季 2 日 20:30" in SimCareChat.recall(w,"chen_wei",{}).text,"dated actual home observation")
	receipt.followup.work={"tick":199,"when":"春季 3 日 07:45","place":"鹽場"}
	check("鹽場" not in SimCareChat.recall(w,"chen_wei",{}).text,"future observation excluded")
	var stock: Dictionary=w.data.stockpile.duplicate(true);var needs: Dictionary=a.needs.duplicate(true);var rng_state:=w.rng.state
	check(SimDailyTalk.observe(w,m)=="chen_wei","real local greeting consumes care topic")
	check(w.data.agents.player.chatHistory.back()._godotRecall.kind=="resident_care","history retains factual source")
	check(equal(stock,w.data.stockpile) and equal(needs,a.needs) and rng_state==w.rng.state,"no resources needs or RNG side effects")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
	check(SimDailyTalk.observe(restored,m).is_empty(),"reload preserves greeting cooldown")
	restored.data.tickCount=210
	check(SimCareChat.recall(restored,"chen_wei",restored.quest_balance.daily_talk).is_empty(),"new work milestone cannot repeat same receipt after reload")
	for state in ["cancelled","traveling","serving"]:
		a._careResults=[{"state":state,"tick":146,"job":"doctor"}]
		check(SimCareChat.recall(w,"chen_wei",{}).is_empty(),"no completed claim for "+state)
	a._careResults=[{"state":"completed","tick":146,"job":"priest","provider":"lin_mei"}]
	check("談過心" in SimCareChat.recall(w,"chen_wei",{}).text and "上工" not in SimCareChat.recall(w,"chen_wei",{}).text,"legacy priest receipt has no invented followup")
	w.data.tickCount=400
	check(SimCareChat.recall(w,"chen_wei",{}).is_empty(),"old care ages out")
	# Actual three-day natural simulation, with no fabricated followup milestones.
	var natural:=SimWorld.new()
	natural.load_snapshot(JSON.parse_string(FileAccess.get_file_as_string("res://docs/CARE_FOLLOWUP_HARBOR_PROGRESS.rimtown")))
	var actual:=SimCareChat.recall(natural,"hb_shishu",{})
	check(not actual.is_empty(),"delivered natural progress supplies care recall")
	if not actual.is_empty():
		check("阿汐" in actual.text and "20:30" in actual.text and "07:45" in actual.text and "鹽場" in actual.text,"natural care home work facts retained")
		check("進食" not in actual.text and "今天" not in actual.text,"past intent is not today's completed activity")
	var natural_receipt: Dictionary=natural.data.agents.hb_shishu._careResults.filter(func(row): return row.state=="completed")[0]
	natural_receipt.followup.state="expired"
	check("07:45" in SimCareChat.recall(natural,"hb_shishu",{}).text,"expired observation window retains already witnessed work")
	natural_receipt.followup.work.tick=natural_receipt.followup.until+1
	check("鹽場" not in SimCareChat.recall(natural,"hb_shishu",{}).text,"out of window evidence excluded")
	natural_receipt.followup.home.tick=natural_receipt.tick
	check("回到了家" not in SimCareChat.recall(natural,"hb_shishu",{}).text,"same tick is not a later home arrival")
	var prompt:=SimPlayerChat.prompt(natural,"hb_shishu","後來有回家嗎？")
	check("residentCare" in prompt and "provider_name" in prompt,"AI prompt receives bounded verified care context")
	var report:={"checks":checks,"failures":failures}
	FileAccess.open("res://docs/CARE_CHAT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

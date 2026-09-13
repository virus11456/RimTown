extends "res://tests/test_career_reviews.gd"
func _initialize() -> void:
	var w:=review_world();check(SimCareerReviews.choose(w,"guard",1,"lin_mei","practice").ok,"actual review completed")
	w.data.tickCount+=4
	var recall:=SimCareerReviews.recall(w,"lin_mei",{});var source: Dictionary=recall.source
	var before:=w.snapshot()
	check(SimCareerReviews.recall_source(w,"lin_mei",source).choice=="practice","source resolves actual branch")
	check(equal(before,w.snapshot()),"source read is nonmutating")
	check(SimCareerReviews.recall_source(w,"chen_wei",source).is_empty(),"wrong participant cannot claim record")
	for fault in ["tick","choice","job","stage"]:
		var bad: Dictionary=source.duplicate(true)
		match fault:
			"tick":bad.facts.tick+=1
			"choice":bad.facts.choice="cooperate"
			"job":bad.facts.job="doctor"
			"stage":bad.facts.stage=3
		check(SimCareerReviews.recall_source(w,"lin_mei",bad).is_empty(),"mismatched source rejected "+fault)
	w.data.tickCount+=300
	check(SimCareerReviews.recall(w,"lin_mei",{}).is_empty() and not SimCareerReviews.recall_source(w,"lin_mei",source).is_empty(),"old conversation remains traceable after recall window")
	w.quest_balance.career_reviews.guard["1"].erase("time")
	check(SimCareerReviews.recall_source(w,"lin_mei",source).time.is_empty(),"legacy date not fabricated")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
	check(equal(SimCareerReviews.recall_source(w,"lin_mei",source),SimCareerReviews.recall_source(restored,"lin_mei",source)),"source survives reload")
	var invalid: Dictionary=source.duplicate(true);invalid.facts=[]
	check(SimCareerReviews.recall_source(w,"lin_mei",invalid).is_empty(),"malformed chat facts are not treated as evidence")
	w.quest_balance.career_reviews.guard["1"].erase("choice")
	check(SimCareerReviews.recall_source(w,"lin_mei",source).is_empty(),"incomplete ledger does not invent branch")
	w.quest_balance.career_reviews={};check(SimCareerReviews.recall_source(w,"lin_mei",source).is_empty(),"missing ledger does not trust chat copy")
	var report:={"checks":checks,"failures":failures};FileAccess.open("res://docs/REVIEW_SOURCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

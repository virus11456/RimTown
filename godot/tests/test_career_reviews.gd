extends "res://tests/test_careers.gd"
func review_world() -> SimWorld:
	var w:=world();SimCareers.enroll(w,"guard");w.data.agents.player.currentLocation="quarry";SimCareers.start(w,"patrol:quarry");finish(w)
	for a in w.data.agents.values():
		if not a.get("isPlayer",false): a.jobKey="farmer"
	w.data.agents.lin_mei.jobKey="guard";w.data.agents.lin_mei.currentLocation="town_square";w.data.agents.lin_mei.activity="idle";w.data.agents.lin_mei.age=30
	w.data.agents.player.currentLocation="town_square";return w
func _initialize() -> void:
	for choice in ["practice","cooperate"]:
		var w:=review_world();var stock: Dictionary=w.data.stockpile.duplicate(true);var player: Dictionary=w.data.agents.player;var a: Dictionary=w.data.agents.lin_mei
		var xp: float=player.skills["近戰"].xp;var affinity: float=SimSocial.relationship(a,player).affinity
		check(SimCareerReviews.next_stage(w,"guard")==1,"real patrol unlocks review")
		var saved:=w.snapshot();var restored:=SimWorld.new();restored.load_snapshot(saved)
		check(SimCareerReviews.choose(w,"guard",1,"lin_mei",choice).ok,"eligible onsite branch")
		SimCareerReviews.choose(restored,"guard",1,"lin_mei",choice);check(equal(w.snapshot(),restored.snapshot()),"reload branch deterministic")
		check(player.skills["近戰"].xp==xp+(3 if choice=="practice" else 0),"branch specific skill effect")
		check(SimSocial.relationship(a,player).affinity==affinity+(1 if choice=="cooperate" else 0),"branch specific relationship effect")
		check(equal(stock,w.data.stockpile),"no stock/currency reward")
		check(player.chatHistory.size()==2 and not player.memory.is_empty() and not a.memory.is_empty(),"dialogue and both memories persist")
		saved=w.snapshot();check(not SimCareerReviews.choose(w,"guard",1,"lin_mei",choice).ok and equal(saved,w.snapshot()),"duplicate review atomic")
		check(SimCareerReviews.next_stage(w,"guard")==0,"next stage not prematurely unlocked")
	for invalid in ["away","sleep","dead","wrong_job","busy","stage","choice"]:
		var w:=review_world();var stage:=1;var choice:="practice"
		match invalid:
			"away": w.data.agents.player.currentLocation="tavern"
			"sleep": w.data.agents.lin_mei.activity="sleeping"
			"dead": w.data.agents.lin_mei.isDead=true
			"wrong_job": w.data.agents.lin_mei.jobKey="farmer"
			"busy": SimCareers.book(w).active={"id":"busy"}
			"stage": stage=2
			"choice": choice="free_money"
		var saved:=w.snapshot();check(not SimCareerReviews.choose(w,"guard",stage,"lin_mei",choice).ok and equal(saved,w.snapshot()),invalid+" rejected without effects")
	var w:=review_world();w.data.agents.lin_mei.jobKey="mayor"
	check(SimCareerReviews.people(w,"guard")==["lin_mei"],"mayor fallback when no peer available")
	SimCareers.enroll(w,"farmer");check(SimCareerReviews.choose(w,"guard",1,"lin_mei","practice").ok,"earned review survives career change")
	w=world();check(SimCareerReviews.next_stage(w,"guard")==0 and not w.quest_balance.has("career_reviews"),"legacy save no invented review")
	var report:={"checks":checks,"failures":failures,"scope":"earned-stage local dialogue branches, actual XP/affinity, one-use/reload, both memories/chat, attendance/availability, no money, legacy and career-change support"}
	FileAccess.open("res://docs/CAREER_REVIEW_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

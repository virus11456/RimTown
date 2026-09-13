extends "res://tests/test_career_outcomes.gd"
func _initialize() -> void:
	var w:=setup_guard();finish(w)
	var row: Dictionary=SimCareers.book(w).outcomes.back()
	check(row.career.before.completed==0 and row.career.after.completed==1 and row.career.before.stage==0 and row.career.after.stage==1,"first actual completion records stage transition")
	check(row.career.skill=="近戰" and row.career.xp==3,"receipt records actual skill award")
	var first: Dictionary=row.duplicate(true)
	for location in ["quarry","residential_east"]:
		w.data.agents.player.currentLocation=location;check(SimCareers.start(w,"patrol:"+location).ok,"next real patrol starts");finish(w)
	row=SimCareers.book(w).outcomes.back()
	check(row.career.before.routes==0 and row.career.after.routes==1,"third station records actual full patrol day")
	check(row.career.before.days==1 and row.career.after.days==1,"same day does not count as new date")
	check(equal(first,SimCareers.book(w).outcomes[0]),"later progress cannot rewrite earlier evidence")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
	check(equal(SimCareers.book(w).outcomes,SimCareers.book(restored).outcomes),"evidence survives reload")
	w=setup_guard();SimCareers.cancel(w);check(not SimCareers.book(w).outcomes.back().has("career"),"cancel does not claim career contribution")
	w=setup_guard();w.quest_balance.career_progress={"guard":{"stage":3,"completed":15,"days":[0,1,2,3,4],"targets":["a","b","c"],"routes":[0,1,2],"directions":[]}}
	finish(w);row=SimCareers.book(w).outcomes.back()
	check(row.career.before.completed==15 and row.career.after.completed==15 and row.career.xp==3,"capped career counter is not invented as sixteen")
	var legacy: Dictionary=w.snapshot();legacy._godot4a.quest_balance.careers.outcomes[0].erase("career")
	restored=SimWorld.new();restored.load_snapshot(legacy)
	check(not SimCareers.book(restored).outcomes[0].has("career"),"legacy completed receipt not backfilled")
	var report:={"checks":checks,"failures":failures}
	FileAccess.open("res://docs/CAREER_EVIDENCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

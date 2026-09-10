extends "res://tests/test_careers.gd"
func _initialize() -> void:
	var w:=world();w.quest_balance.leisure_plans_enabled=true
	var layout:=TownLayout.new();layout.rebuild(w.data);var m:=SimMotion.new();m.configure(layout);m.update(w.data.agents)
	var seen: Dictionary={};var outcomes: Dictionary={};var bad:=[];var maximum_history:=0
	for tick in 768:
		SimLeisurePlan.observe(w,m);w.tick()
		for frame in 120:
			m.update(w.data.agents);SimLeisurePlan.observe(w,m)
		for id in SimLeisurePlan.plans(w):
			var p: Dictionary=SimLeisurePlan.plans(w)[id]
			if p.state=="completed" and SimCareerPresence.place(m,id)!=p.place and not seen.has(id+str(p.day)): bad.append(id)
			if not SimLeisurePlan.LIVE.has(p.state) and not seen.has(id+str(p.day)):
				seen[id+str(p.day)]=true;outcomes[p.state]=int(outcomes.get(p.state,0))+1
			var rows:=SimLeisurePlan.history(w,id);maximum_history=maxi(maximum_history,rows.size())
			var days:=[]
			for row in rows:
				if row.day in days: bad.append("duplicate")
				days.append(row.day)
		if tick%96==95: print("day ",tick/96+1," outcomes ",outcomes)
	check(bad.is_empty(),"new completion at actual venue and unique daily outcomes")
	check(maximum_history<=7,"eight day history remains bounded")
	check(int(outcomes.get("completed",0))>0 and int(outcomes.get("missed",0))>0,"natural run records successes and misses")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
	check(equal(SimLeisurePlan.plans(w),SimLeisurePlan.plans(restored)) and equal(w.quest_balance.leisure_history,restored.quest_balance.leisure_history),"long run reload retains exact plans and history")
	var report:={"checks":checks,"failures":failures,"ticks":768,"motion_frames_per_tick":120,"outcomes":outcomes,"maximum_history":maximum_history,"scope":"eight simulated days from original frontier world, normal world ticks and physical motion, no position/job/needs/resource changes, no app rendering/API; not whole-game natural playthrough"}
	FileAccess.open("res://docs/LEISURE_ENDURANCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

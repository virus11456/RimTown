extends "res://tests/test_careers.gd"
func _initialize() -> void:
	var w:=world();SimCareers.enroll(w,"guard");var stock: Dictionary=w.data.stockpile.duplicate(true)
	check(SimCareerProgress.ticks(w,"guard")==4,"novice one-hour duties")
	for day in 5:
		w.data.clock.day=day+1
		for loc in SimCareers.PATROL:
			w.data.agents.player.currentLocation=loc
			check(SimCareers.start(w,"patrol:"+loc).ok,"real patrol starts")
			var duration:=SimCareerProgress.ticks(w,"guard")
			for i in duration-1: w.data.tickCount+=1;SimCareers.tick(w)
			check(not SimCareers.book(w).active.is_empty(),"no premature shortened completion")
			w.data.tickCount+=1;SimCareers.tick(w)
		check(SimCareerProgress.progress(w,"guard").stage==([1,1,2,2,3][day]),"guard stage at day "+str(day))
	check(SimCareerProgress.ticks(w,"guard")==2,"specialist half-hour duties")
	check(equal(stock,w.data.stockpile),"milestones create no resources or silver")
	var restored:=SimWorld.new();restored.load_snapshot(w.snapshot())
	check(equal(SimCareerProgress.progress(w,"guard"),SimCareerProgress.progress(restored,"guard")),"progress persists")
	SimCareers.enroll(w,"farmer");check(SimCareerProgress.ticks(w,"farmer")==4,"other job starts separately")
	SimCareers.enroll(w,"guard");check(SimCareerProgress.ticks(w,"guard")==2 and SimCareers.book(w).used==3,"returning retains proficiency and daily limit")
	var before:=w.snapshot();SimCareers.tick(w);check(equal(before,w.snapshot()),"completed milestone cannot replay")
	# Pure rule coverage of all eleven professions; real settlement hook is covered above and in regressions.
	for job in SimCareers.JOBS:
		w=world()
		for n in 15:
			w.data.clock.day=n/3+1
			var t:={"job":job,"target":str(n%3),"args":["merchant",{"isBuying":n%2==0}]}
			if job=="guard": SimCareers.book(w).visits=SimCareers.PATROL.duplicate()
			SimCareerProgress.record(w,t)
		check(SimCareerProgress.progress(w,job).stage==3,job+" satisfies tailored rules")
		check(SimCareerProgress.progress(w,job).days.size()==5,job+" tracks distinct days")
	w=world()
	for n in 15: SimCareerProgress.record(w,{"job":"doctor","target":"same_patient"})
	check(SimCareerProgress.progress(w,"doctor").stage==1,"same day cannot farm mastery")
	for n in 5:
		w.data.clock.day=n+1;SimCareerProgress.record(w,{"job":"doctor","target":"same_patient"})
	check(SimCareerProgress.progress(w,"doctor").stage==1,"different days alone cannot bypass patient diversity")
	SimCareerProgress.record(w,{"job":"doctor","target":"second"});check(SimCareerProgress.progress(w,"doctor").stage==2,"two residents unlock skilled")
	SimCareerProgress.record(w,{"job":"doctor","target":"third"});check(SimCareerProgress.progress(w,"doctor").stage==3,"third resident unlocks specialist")
	w=world();SimCareers.book(w).completed=100;SimCareers.book(w).history=["舊工作完成"]
	check(SimCareerProgress.progress(w,"guard").stage==0,"legacy total does not invent profession history")
	SimCareers.enroll(w,"guard");w.data.agents.player.currentLocation="quarry";SimCareers.start(w,"patrol:quarry");w.data.agents.player.currentLocation="tavern";finish(w)
	check(SimCareerProgress.progress(w,"guard").completed==0,"cancelled work gives no career progress")
	var report:={"checks":checks,"failures":failures,"scope":"five-day real duty settlement fixture, all eleven tailored rule tracks, shortened work completion boundary, no resource reward, reload, cross-job limits, distinct days/targets, legacy saves and cancellation; rule fixtures are not natural playthrough"}
	FileAccess.open("res://docs/CAREER_PROGRESS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m;var a: Dictionary=w.data.agents.chen_wei
	a.currentLocation="library";a.activity="working";m.positions.chen_wei.walking=false
	a.dailyPlan={"blocks":[{"time":"00:00","text":"已經完成遠方的冒險","steps":["正在不存在的地方採礦"]}]}
	var view:=SimAgenda.current(w,m,"chen_wei")
	check(not view.arrived and "尚未抵達" in view.text,"logical work target does not imply arrival")
	check(view.actual==str(w.data.townMap.locations.town_square.name),"actual location comes from motion")
	w.trace_enabled=true;var before:=w.snapshot();var trace:=PhysicalTrace.new();trace.record(w,m)
	check(equal(before,w.snapshot()),"physical history does not mutate pure simulation")
	var entries:=trace.entries(w,"chen_wei")
	check(entries.size()==1 and not "冒險" in entries[0].text and not "採礦" in entries[0].text,"unexecuted prose never becomes actual trace")
	trace.record(w,m);check(trace.entries(w,"chen_wei").size()==1,"same observed state deduplicated")
	var point:=m.layout._nearest(m.layout._center("library"));m.positions.chen_wei.x=point.x;m.positions.chen_wei.y=point.y
	view=SimAgenda.current(w,m,"chen_wei");check(view.arrived and view.text=="工作","arrival evaluated separately")
	trace.record(w,m);check(trace.entries(w,"chen_wei").size()==2,"physical arrival creates trace change")
	var restored:=PhysicalTrace.new();restored.load_state(trace.snapshot());restored.record(w,m)
	check(equal(trace.snapshot(),restored.snapshot()),"history reload preserves dedup key")
	w.trace_enabled=false;w.data.clock.minute=15;a.activity="eating";restored.record(w,m)
	check(equal(trace.snapshot(),restored.snapshot()),"disabled trace does not append")
	w.trace_enabled=true;w.data.clock.day+=1;restored.record(w,m)
	check(restored.entries(w,"chen_wei").size()==1,"new day clears old physical history")
	for i in 170:
		a.activity="eating" if i%2==0 else "working";restored.record(w,m)
	check(restored.entries(w,"chen_wei").size()==160,"physical history bounded per resident")
	a.jobKey="mayor";a.personality.traits=["night_owl"]
	var rows:=SimAgenda.routine(w,"chen_wei")
	check(rows[0]=="平常睡眠：02:00–09:00" and "09:00–17:00" in rows[1],"routine uses actual job and sleep traits")
	check(SimAgenda.routine(w,"player").is_empty(),"does not invent autonomous player schedule")
	var houses: Array=m.layout.houses.keys();var own:=m.layout._house_id("chen_wei","residential_north")
	a.currentLocation="residential_north"
	for house in houses:
		if house!=own and m.layout.houses[house].parentLocId=="residential_north":
			m.positions.chen_wei.x=m.layout.houses[house].interiorX;m.positions.chen_wei.y=m.layout.houses[house].interiorY
			check(not SimAgenda.current(w,m,"chen_wei").arrived,"different home in same district is not destination");break
	var report:={"checks":checks,"failures":failures,"scope":"configured real position vs destination, home distinction, imported prose isolation, actual trace dedup/reload/day/cap/disable, job and sleep display, no simulation mutation"}
	FileAccess.open("res://docs/AGENDA_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

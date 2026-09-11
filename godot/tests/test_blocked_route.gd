extends "res://tests/test_daily_talk.gd"
func fixture() -> Dictionary:
	var w:=world();var layout:=TownLayout.new()
	for y in range(60):
		var row: Array=[];row.resize(80);row.fill(0);row[20]=5;layout.grid.append(row)
	layout.nature={"test_site":{"x":24,"y":20,"w":1,"h":1},"near_site":{"x":16,"y":20,"w":1,"h":1}}
	layout.work_sites={"test_site":true,"near_site":true}
	w.data.townMap.locations.test_site={"name":"牆後測試空地"};w.data.townMap.locations.near_site={"name":"牆前測試空地"}
	var a: Dictionary=w.data.agents.chen_wei;a.currentLocation="test_site";a.activity="wandering"
	var m:=SimMotion.new();m.configure(layout);m.stable_routes=true;m.update({"chen_wei":a})
	m.positions.chen_wei.x=319.9;m.positions.chen_wei.y=328.0
	return {"w":w,"m":m,"agents":{"chen_wei":a}}
func _initialize() -> void:
	var f:=fixture();var m: SimMotion=f.m;var w: SimWorld=f.w
	var p: Dictionary=m.positions.chen_wei;var start:=Vector2(p.x,p.y);var saved:=w.snapshot()
	m.update(f.agents)
	check(not p.walking and p.walkStep==0 and Vector2(p.x,p.y)==start,"head-on wall collision stops animation without a zero-distance slide")
	check("前方受阻" in SimAgenda.current(w,m,"chen_wei").text,"agenda distinguishes closed route from blocked starting cell")
	for frame in range(600): m.update(f.agents)
	check(Vector2(p.x,p.y)==start and not p.walking,"closed route holds exact position for ten seconds without teleport")
	check(int(p._routeRetry)>0,"unreachable route retries at bounded intervals rather than every frame")
	check(equal(saved,w.snapshot()),"waiting does not change resources, needs, memories or rewards")
	m.positions=JSON.parse_string(JSON.stringify(m.positions));p=m.positions.chen_wei
	check("前方受阻" in m.obstruction("chen_wei"),"JSON retry state remains valid against real geometry")
	m.layout.grid[20][20]=0
	check(m.obstruction("chen_wei").is_empty(),"new opening clears diagnostic without trusting cached no-path result")
	var maximum:=0.0;var previous:=Vector2(p.x,p.y);var safe:=true
	for frame in range(800):
		m.update(f.agents);var point:=Vector2(p.x,p.y)
		maximum=maxf(maximum,point.distance_to(previous));previous=point
		if not m.layout._walkable(point): safe=false
	check(safe and maximum<=1.001,"resumed route stays on walkable cells at ordinary speed")
	check(not p.walking and Vector2(p.x,p.y).distance_to(Vector2(p.targetX,p.targetY))<1 and p.x>336,"resident actually crosses reopened gap and arrives")
	check(not p.has("_blockedRoute"),"arrival leaves no stale blocked marker")
	f=fixture();m=f.m;w=f.w;m.update(f.agents);p=m.positions.chen_wei
	w.data.agents.chen_wei.currentLocation="near_site"
	m.update(f.agents)
	check(not p.has("_blockedRoute") and m.obstruction("chen_wei").is_empty(),"changed destination immediately cancels old wait")
	for frame in range(400): m.update(f.agents)
	check(not p.walking and p.x<300,"new destination on accessible side is reached")
	f=fixture();m=f.m;m.update(f.agents);p=m.positions.chen_wei
	m.positions.player=p.duplicate(true);m.manual_player=true
	check(m.obstruction("player").is_empty(),"manual player never inherits automatic route-wait diagnosis")
	# A local obstruction with a nearby bypass should replan rather than remain in wait.
	f=fixture();m=f.m;m.layout.grid[19][20]=0;m.pathfinder.grid=m.layout.grid
	m.update(f.agents);p=m.positions.chen_wei
	var detoured:=false;safe=true
	for frame in range(900):
		m.update(f.agents)
		if p.y<320: detoured=true
		if not m.layout._walkable(Vector2(p.x,p.y)): safe=false
	check(detoured and safe and p.x>336 and not p.walking,"nearby bypass is walked around wall and reaches destination")
	var report:={"checks":checks,"failures":failures,"maximum_step":maximum,"scope":"controlled head-on zero-slide regression, sealed wall, bounded retry, reopened gap, bypass, changed destination, JSON state, agenda reason, manual player exclusion and no world mutation"}
	FileAccess.open("res://docs/BLOCKED_ROUTE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	var w:=world();var layout:=TownLayout.new()
	for y in range(60):
		var row: Array=[];row.resize(80);row.fill(0);layout.grid.append(row)
	layout.nature={"test_site":{"x":20,"y":20,"w":4,"h":4}}
	w.data.townMap.locations.test_site={"name":"測試空地"}
	var a: Dictionary=w.data.agents.chen_wei;a.currentLocation="test_site";a.activity="wandering"
	var agents: Dictionary={"chen_wei":a}
	var m:=SimMotion.new();m.configure(layout);m.stable_routes=true
	m.update(agents)
	var p: Dictionary=m.positions.chen_wei;p.x=264.0;p.y=344.0
	m.update(agents)
	var start:=Vector2(p.x,p.y);var cell:=Vector2i(floori(p.x/16),floori(p.y/16))
	check(p.walking and m.obstruction("chen_wei").is_empty(),"clear ground has no blocked notice")
	layout.grid[cell.y][cell.x]=5
	var saved:=w.snapshot()
	check("目前位置不可通行" in SimAgenda.current(w,m,"chen_wei").text,"status diagnoses current geometry before next movement frame")
	for frame in range(600): m.update(agents)
	check(Vector2(p.x,p.y)==start and not p.walking and p.walkStep==0,"ten seconds on blocked ground never teleport or animate walking")
	check(equal(saved,w.snapshot()),"diagnosis and recovery bookkeeping do not alter world resources or memories")
	# A persisted bookkeeping flag is not trusted as a displayed reason.
	var restored: Dictionary=JSON.parse_string(JSON.stringify(m.positions));m.positions=restored;p=m.positions.chen_wei
	check("不可通行" in m.obstruction("chen_wei"),"JSON roundtrip retains physical blockage")
	layout.grid[cell.y][cell.x]=0
	check(m.obstruction("chen_wei").is_empty(),"cleared geometry removes notice immediately even with old saved flag")
	# Poison a previously cached route; the recovery must discard it.
	var key:="%d,%d,%d,%d"%[cell.x,cell.y,floori(p.targetX/16),floori(p.targetY/16)]
	m.pathfinder.cache[key]=[{"x":0,"y":0}]
	m.update(agents)
	check(not p.has("_blockedStart") and not p._pathWaypoints.is_empty() and p._pathWaypoints[0].x>200,"recovery replans and invalidates stale route cache")
	var maximum:=start.distance_to(Vector2(p.x,p.y));var previous:=Vector2(p.x,p.y)
	for frame in range(800):
		m.update(agents)
		var now:=Vector2(p.x,p.y);maximum=maxf(maximum,previous.distance_to(now));previous=now
	check(maximum<=1.001,"recovery uses original walking and subpixel waypoint completion speed")
	check(not p.walking and Vector2(p.x,p.y).distance_to(Vector2(p.targetX,p.targetY))<1,"resident actually walks to destination after obstruction clears")
	check(SimAgenda.current(w,m,"chen_wei").blocked.is_empty(),"arrived status has no stale obstruction")
	p._blockedStart=true
	check(m.obstruction("chen_wei").is_empty(),"stale imported marker alone cannot invent a blockage")
	m.positions.player=p.duplicate(true);m.manual_player=true
	layout.grid[floori(p.y/16)][floori(p.x/16)]=5
	check("不可通行" in m.obstruction("player"),"manual traveler also receives physical position diagnosis")
	check(m.obstruction("missing").is_empty(),"missing position is not misreported as obstruction")
	a.isDead=true
	check(SimAgenda.current(w,m,"chen_wei").text=="已過世","death retains precedence over movement status")
	var report:={"checks":checks,"failures":failures,"maximum_step":maximum,"scope":"controlled blocked cell, live agenda reason, 600-frame no-teleport hold, JSON positions, cache invalidation, ordinary recovery walk, manual traveler diagnosis; no removal gameplay or arbitrary wall escape"}
	FileAccess.open("res://docs/BLOCKED_POSITION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

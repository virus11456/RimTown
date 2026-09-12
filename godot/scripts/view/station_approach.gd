class_name StationApproach
extends RefCounted
# A temporary player-requested route; saves contain actual feet, not queued commands.
var job := ""
var task_id := ""
var route: Array=[]
var index := 0
var goal := Vector2.ZERO
var stalled := 0.0
var notice := ""
func clear(message: String="") -> void:
	job="";task_id="";route.clear();index=0;stalled=0;notice=message
func begin(w: SimWorld,m: SimMotion,id: String,role: String) -> bool:
	clear()
	if str(w.data.agents.player.get("jobKey",""))!=role or not SimCareers.book(w).active.is_empty():
		notice="職務或值勤狀態已改變，請重新查看工作。";return false
	if not SimCareers.available(w).any(func(t):return t.id==id and t.job==role):
		notice="這項工作已無需求，請重新查看。";return false
	var station:=SimWorkstation.resolve(m.layout,role)
	if station.is_empty() or not m.positions.has("player"):
		notice="目前沒有可前往的操作台。";return false
	var p: Dictionary=m.positions.player
	goal=station.stand;var origin:=Vector2(p.x,p.y)
	route=m.pathfinder.find_path(origin,goal)
	if route.is_empty() and ((origin/16).floor()!=(goal/16).floor() or not m.layout._walkable(origin)):
		notice="目前找不到到操作台的路，請先移到可通行處。";return false
	route.append({"x":goal.x,"y":goal.y});job=role;task_id=id
	m.manual_player=true
	return true
func step(w: SimWorld,m: SimMotion,manual: Vector2,delta: float,fast: bool=false) -> bool:
	if not manual.is_zero_approx(): clear();return m.move_player(manual,delta,fast)
	if job.is_empty(): return m.move_player(Vector2.ZERO,delta)
	var station:=SimWorkstation.resolve(m.layout,job)
	if str(w.data.agents.player.get("jobKey",""))!=job or not SimCareers.book(w).active.is_empty() or not SimCareers.available(w).any(func(t):return t.id==task_id and t.job==job) or station.is_empty() or station.stand!=goal:
		clear("工作或操作台已變動，已停止前往；請重新查看工作。");return m.move_player(Vector2.ZERO,delta)
	var p: Dictionary=m.positions.player
	var point:=Vector2(p.x,p.y)
	if point.distance_to(goal)<.15:
		clear("已到操作台，請選擇開始值勤；尚未開工。");return m.move_player(Vector2.ZERO,delta)
	while index<route.size() and point.distance_to(Vector2(route[index].x,route[index].y))<.15: index+=1
	if index>=route.size(): clear("路線已結束，請重新選擇操作台。");return m.move_player(Vector2.ZERO,delta)
	var offset:=Vector2(route[index].x,route[index].y)-point
	var moved:=m.move_player(offset.limit_length(),minf(delta,offset.length()/SimMotion.PLAYER_WALK_SPEED))
	stalled=0.0 if moved else stalled+maxf(0,delta)
	if stalled>2: clear("前方無法通行，已停止前往操作台。")
	return moved

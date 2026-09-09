class_name SimPlayerInteraction
extends RefCounted
const RANGE := 40.0 # Original PixelTileMap: TILE * 2.5, in logical pixels.
static func nearby(positions: Dictionary,agents: Dictionary) -> String:
	if not positions.has("player"): return ""
	var result:="";var distance:=RANGE;var p: Dictionary=positions.player
	for id in positions:
		if id=="player" or not agents.has(id) or agents[id].get("isDead",false): continue
		var other: Dictionary=positions[id]
		var d:=Vector2(float(other.x)-float(p.x),float(other.y)-float(p.y)).length()
		if d<distance: result=id;distance=d
	return result
static func in_range(id: String,positions: Dictionary,agents: Dictionary) -> bool:
	if id=="player" or not agents.has(id) or agents[id].get("isDead",false) or not agents.has("player") or not positions.has("player") or not positions.has(id): return false
	return Vector2(float(positions[id].x)-float(positions.player.x),float(positions[id].y)-float(positions.player.y)).length()<RANGE
static func comfort(a: Dictionary,w: SimWorld) -> void:
	# Original _applyChatIntent('comfort') deterministic effects only.
	var player: Dictionary=w.data.agents.player
	a.needs.social=minf(100,a.needs.social+15)
	SimFeuds._mood(a,w,4)
	SimRelationships.modify(SimSocial.relationship(a,player),"affinity",2)
	var thoughts: Array=a.get("thoughts",[])
	var refreshed:=false
	for thought in thoughts:
		if thought.kind=="nice_chat" and thought.get("targetId")=="player":
			thought.start=SimClock.total_days(w.data.clock);refreshed=true;break
	if not refreshed: thoughts.append({"kind":"nice_chat","label":"愉快的聊天","mood":3,"opinion":0,"targetId":"player","targetName":player.name,"start":SimClock.total_days(w.data.clock),"days":1})
	a.thoughts=thoughts.slice(maxi(0,thoughts.size()-14))

	var actions: Array=w.data.get("playerActions",[])
	actions.append({"tick":w.data.tickCount,"dayKey":SimTrace.day_key(w.data.clock),"type":"comfort","text":"","npcId":a.id,"npcName":a.name,"targetId":null,"targetName":"","aff0":a.relationships.player.affinity})
	w.data.playerActions=actions.slice(maxi(0,actions.size()-60))

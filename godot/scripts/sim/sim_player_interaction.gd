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
	_thought(a,w,"nice_chat")
	_record(a,w,"comfort")

static func _thought(a: Dictionary,w: SimWorld,kind: String) -> void:
	var player: Dictionary=w.data.agents.player
	var thoughts: Array=a.get("thoughts",[])
	var refreshed:=false
	for thought in thoughts:
		if thought.kind==kind and thought.get("targetId")=="player":
			thought.start=SimClock.total_days(w.data.clock);refreshed=true;break
	if not refreshed: thoughts.append({"kind":kind,"label":"被說了難聽的話" if kind=="harsh_words" else "愉快的聊天","mood":-4 if kind=="harsh_words" else 3,"opinion":-1 if kind=="harsh_words" else 0,"targetId":"player","targetName":player.name,"start":SimClock.total_days(w.data.clock),"days":2 if kind=="harsh_words" else 1})
	a.thoughts=thoughts.slice(maxi(0,thoughts.size()-14))


static func _record(a: Dictionary,w: SimWorld,key: String) -> void:
	var actions: Array=w.data.get("playerActions",[])
	actions.append({"tick":w.data.tickCount,"dayKey":SimTrace.day_key(w.data.clock),"type":key,"text":"","npcId":a.id,"npcName":a.name,"targetId":null,"targetName":"","aff0":a.relationships.player.affinity})
	w.data.playerActions=actions.slice(maxi(0,actions.size()-60))

const INTENTS := {
	"gossip": ["打聽消息", "最近鎮上有什麼新鮮事嗎?"],
	"flirt": ["示好", "跟你在一起總是特別開心。"],
	"threaten": ["威脅", "你最好識相點,別逼我出手。"],
	"request": ["提出委託", "有件事想拜託你幫個忙。"]
}
static func apply_intent(a: Dictionary,w: SimWorld,key: String) -> String:
	if not INTENTS.has(key): return ""
	var player: Dictionary=w.data.agents.player
	var rel:=SimSocial.relationship(a,player)
	var notice:=""
	match key:
		"gossip":
			var candidates: Array=w.data.get("gossip",[]).filter(func(g): return g.get("about") is String and not g.about.is_empty() and g.about!=a.name and g.about!=player.name)
			candidates=candidates.slice(maxi(0,candidates.size()-8))
			SimRelationships.modify(rel,"affinity",1)
			if candidates.is_empty(): notice=a.name+"說最近沒什麼新鮮事 · 好感 +1"
			else:
				var item: Dictionary=w.rng.pick(candidates)
				var history: Array=player.get("chatHistory",[])
				history.append({"speaker":a.name,"target":player.name,"text":"(壓低聲音) "+str(item.content),"time":SimSocial.time_string(w.data.clock)})
				player.chatHistory=history
				notice=a.name+"透露了一則八卦 · 好感 +1"
		"flirt":
			if float(rel.affinity)>25:
				SimRelationships.modify(rel,"romanticInterest",3);SimRelationships.modify(rel,"affinity",1)
				_thought(a,w,"nice_chat");notice=a.name+"心跳漏了一拍 · 浪漫 +3 · 好感 +1"
			else:
				SimRelationships.modify(rel,"affinity",-3);notice="太唐突了，"+a.name+"有點尷尬 · 好感 −3"
		"threaten":
			SimRelationships.modify(rel,"trust",-12);SimRelationships.modify(rel,"affinity",-8)
			SimFeuds._mood(a,w,-5);_thought(a,w,"harsh_words")
			notice=a.name+"怕了你，但更討厭你了 · 信任 −12 · 好感 −8"
		"request":
			if float(rel.trust)>=10 or float(rel.affinity)>=30:
				SimRelationships.modify(rel,"affinity",3)
				SimGossip._remember(a,w.data,"答應幫"+player.name+"一個忙",5,["player"])
				notice=a.name+"答應幫你了 · 好感 +3（目前記為承諾，尚未建立工作任務）"
			else: notice=a.name+"跟你還不夠熟，婉拒了"
	_record(a,w,key)
	return notice

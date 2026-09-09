class_name SimStargazing
extends RefCounted
## Agent._doStargazing, including the original random draw order.
static func process(a: Dictionary,w: SimWorld) -> void:
	a.needs.recreation=minf(100,a.needs.recreation+2)
	a.needs.comfort=minf(100,a.needs.comfort+1)
	SimFeuds._mood(a,w,.5)
	if w.rng.next_float()<.15:
		var others: Array=w.data.agents.values().filter(func(b): return b.id!=a.id and b.currentLocation==a.currentLocation and b.activity=="stargazing")
		if not others.is_empty():
			var b: Dictionary=w.rng.pick(others)
			var compat:=SimDialogue.compatibility(a.personality.traits,b.personality.traits)
			var shared: String="一起在"+str(a.currentLocation).replace("_"," ")+"看星星"
			for pair in [[a,b],[b,a]]:
				var rel:=SimSocial.relationship(pair[0],pair[1])
				SimRelationships.modify(rel,"affinity",floor(w.rng.next_int(1,4)*compat+.5))
				if rel.affinity>20: SimRelationships.modify(rel,"romanticInterest",floor(w.rng.next_int(0,2)*compat+.5))
				SimRelationships.add_shared_memory(rel,shared)
			SimSocial.log_message(w.data,"social",a.name+"和"+b.name+"一起看星星，感情升溫了。",a.name,b.name)
			SimSocial.remember(a,w.data,"social","和"+b.name+"一起看星星，很浪漫。",7,b.name)
			SimSocial.remember(b,w.data,"social","和"+a.name+"一起看星星，很浪漫。",7,a.name)
	if w.rng.next_float()<.02:
		var discoveries: Array=[
			["看到了一顆流星劃過天際！",10,"流星"],
			["發現了一個從未見過的星座圖案。",5,"神秘星座"],
			["看到了罕見的月暈現象！",8,"月暈奇觀"],
			["在星光下發現了一株發光的植物！",12,"夜光植物"]]
		var discovery: Array=w.rng.pick(discoveries)
		SimFeuds._mood(a,w,discovery[1]);a.currentThought=discovery[0]
		SimSocial.log_message(w.data,"discovery",a.name+discovery[0],a.name,"")
		SimFeuds._memory(a,w,"discovery",discovery[0],8,[])
		w.data.events.conversationTopics.append(discovery[2])

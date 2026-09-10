class_name SimHeartEvents
extends RefCounted
static func rules() -> Dictionary:
	return JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/heart_event_rules.json"))
static func check_new(w: SimWorld) -> void:
	if not w.heart_events_enabled or w.event_comments.any(func(item): return item.get("kind","")=="heart"): return
	var players: Array=w.data.agents.values().filter(func(a): return a.get("isPlayer",false))
	if players.is_empty(): return
	var player: Dictionary=players[0]
	if not w.data.get("heartEventsFired") is Dictionary: w.data.heartEventsFired={}
	var definitions:=rules()
	for npc in w.data.agents.values():
		if npc.get("isPlayer",false) or npc.get("isDead",false): continue
		var rel: Dictionary=npc.get("relationships",{}).get(player.id,{})
		if rel.is_empty(): continue
		if not w.data.heartEventsFired.get(npc.id) is Array: w.data.heartEventsFired[npc.id]=[]
		var fired: Array=w.data.heartEventsFired[npc.id]
		for event in definitions.events:
			if event.id in fired: continue
			if float(rel.get("affinity",0))<float(event.min.get("affinity",-100)) or float(rel.get("romanticInterest",0))<float(event.min.get("romantic",0)): continue
			fired.append(event.id)
			var lines: Array=definitions.fallbacks.romance if event.get("romance",false) else definitions.fallbacks.friend
			var fallback: String=str(w.rng.pick(lines)).replace("{job}",str(SimPlayerChat.job(w,npc).get("title","日子")))
			var traits: Array=npc.personality.get("traits",[])
			if "shy" in traits: fallback="那個..."+fallback
			elif "abrasive" in traits: fallback+="...講完了,不准笑。"
			w.event_comments.append({"kind":"heart","npc":npc.id,"player":player.id,"event":event.scenario,"definition":event.duplicate(true),"fallback":fallback})
			return
static func prompt(w: SimWorld,item: Dictionary) -> String:
	var npc: Dictionary=w.data.agents[item.npc]
	var rel: Dictionary=npc.get("relationships",{}).get(item.player,{})
	var memories: Array=rel.get("sharedMemories",[]).slice(-3).map(func(m): return str(m).left(300))
	return SimEventComments.prompt(w,item).replace("1–2 句","2–4 句")+"\n這是重要的友情或感情時刻，改用 2–4 句真摯台詞。背景："+str(npc.personality.get("background","")).left(600)+"\n共同回憶（遊戲資料）："+JSON.stringify(memories)
static func apply(w: SimWorld,item: Dictionary,response: String="") -> bool:
	if not w.event_comments.any(func(p): return is_same(p,item)): return false
	w.event_comments.erase(item)
	if not w.data.agents.has(item.npc) or not w.data.agents.has(item.player): return false
	var npc: Dictionary=w.data.agents[item.npc];var player: Dictionary=w.data.agents[item.player]
	if npc.get("isDead",false) or not player.get("isPlayer",false): return false
	var text:=SimEventComments.clean_text(response,str(npc.name),str(item.fallback))
	if not player.get("chatHistory") is Array: player.chatHistory=[]
	player.chatHistory.append({"speaker":npc.name,"target":player.name,"text":text,"time":SimSocial.time_string(w.data.clock)})
	SimFeuds._memory(npc,w,"conversation","我對"+str(player.name)+"說出了真心話："+text,9,[player.name])
	var rel:=SimSocial.relationship(npc,player);var event: Dictionary=item.definition
	SimRelationships.add_shared_memory(rel,str(event.name)+"："+text)
	SimSocial.log_message(w.data,"player_chat",str(event.icon)+" "+str(npc.name)+" → "+str(player.name)+": "+text,npc.name,player.name)
	return true

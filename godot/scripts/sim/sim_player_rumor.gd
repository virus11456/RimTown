class_name SimPlayerRumor
extends RefCounted
const TONES := {"praise":"誇讚他","diss":"酸他一下","ship":"亂點鴛鴦"}
static func available(w: SimWorld) -> bool:
	return w.data.get("_godot4a",{}).get("last_rumor_day","")!=SimTrace.day_key(w.data.clock)
static func candidates(w: SimWorld,listener: String) -> Array:
	return w.data.agents.values().filter(func(a): return a.id!=listener and not a.get("isPlayer",false) and not a.get("isDead",false))
static func send(w: SimWorld,listener_id: String,about_id: String,tone: String) -> Dictionary:
	if not available(w): return {"ok":false,"error":"今天已經爆過料了，明天再來。"}
	if not TONES.has(tone) or not w.data.agents.has("player") or not w.data.agents.has(listener_id) or not w.data.agents.has(about_id): return {"ok":false,"error":"找不到爆料對象。"}
	var player: Dictionary=w.data.agents.player;var listener: Dictionary=w.data.agents[listener_id];var about: Dictionary=w.data.agents[about_id]
	if listener_id==about_id or listener.get("isPlayer",false) or listener.get("isDead",false) or about.get("isPlayer",false) or about.get("isDead",false): return {"ok":false,"error":"對象已改變，請重新選擇。"}
	var ship_with:=""
	if tone=="ship":
		var others: Array=candidates(w,listener_id).filter(func(a): return a.id!=about_id and SimGossip._partner(a).is_empty())
		if others.is_empty(): return {"ok":false,"error":"目前沒有適合配對的單身居民。"}
		ship_with=w.rng.pick(others).name
	var gossip:=SimGossip.seed_player(w.data,player,listener,about,tone,w.rng,ship_with)
	var extension: Dictionary=w.data.get("_godot4a",{});extension.last_rumor_day=SimTrace.day_key(w.data.clock);w.data._godot4a=extension
	var tr: Array=listener.personality.traits
	var delta:=3 if "gossip" in tr else (-1 if "kind" in tr else 1)
	var reaction:="哇這個猛!放心,我幫你「不小心」說出去 👀" if "gossip" in tr else ("欸...在背後這樣說人家不太好吧...不過我聽到了。" if "kind" in tr else "喔~?有意思,我記下了。")
	SimRelationships.modify(SimSocial.relationship(listener,player),"affinity",delta)
	var history: Array=player.get("chatHistory",[])
	history.append({"speaker":player.name,"target":listener.name,"text":"🗣️(偷偷說) "+gossip.content,"time":SimSocial.time_string(w.data.clock)})
	var reply:={"speaker":listener.name,"target":player.name,"text":reaction,"time":SimSocial.time_string(w.data.clock)}
	history.append(reply.duplicate(true));player.chatHistory=history.slice(maxi(0,history.size()-10000))
	if listener.get("chatHistory") is Array:
		var local_history: Array=listener.chatHistory;local_history.append(reply);listener.chatHistory=local_history.slice(maxi(0,local_history.size()-10000))
	return {"ok":true,"content":gossip.content,"reaction":reaction,"affinity":delta}

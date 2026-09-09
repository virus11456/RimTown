class_name SimPlayerWhisper
extends RefCounted
## Offline plantWhisper rules. AI rewriting and replanning are separate integrations.
static func apply(w: SimWorld,id: String,text: String) -> void:
	var npc: Dictionary=w.data.agents[id];var player: Dictionary=w.data.agents.player
	var targets: Array=[]
	var target: Dictionary={}
	for a in w.data.agents.values():
		if a.get("isPlayer",false) or a.get("isDead",false) or a.id==id: continue
		if a.name in text:
			targets.append(a.name)
			if target.is_empty(): target=a
	SimFeuds._memory(npc,w,"whisper",text,8,targets.slice(0,2))
	if not target.is_empty():
		var rel:=SimSocial.relationship(npc,target)
		SimRelationships.modify(rel,"affinity",0);SimRelationships.modify(rel,"romanticInterest",0)
	var actions: Array=w.data.get("playerActions",[])
	var entry:={"tick":w.data.tickCount,"dayKey":SimTrace.day_key(w.data.clock),"type":"whisper","text":SimPlayerOffline.utf16_left(text,60),"npcId":npc.id,"npcName":npc.name,"targetId":null if target.is_empty() else target.id,"targetName":"" if target.is_empty() else target.name,"aff0":npc.get("relationships",{}).get("player",{}).get("affinity",null)}
	if not target.is_empty(): entry.tAff0=npc.relationships[target.id].affinity
	actions.append(entry);w.data.playerActions=actions.slice(maxi(0,actions.size()-60))
	SimSocial.log_message(w.data,"whisper","🤫 你在"+npc.name+"耳邊低語...一個念頭在他心裡生根了。",player.name,npc.name)
	var history: Array=player.get("chatHistory",[])
	history.append({"speaker":player.name,"target":npc.name,"text":"🤫 (耳語) "+text,"time":SimSocial.time_string(w.data.clock)})
	history.append({"speaker":npc.name,"target":player.name,"text":"💭 ("+npc.name+"若有所思,喃喃自語) "+text,"time":SimSocial.time_string(w.data.clock)})
	player.chatHistory=history.slice(maxi(0,history.size()-10000))

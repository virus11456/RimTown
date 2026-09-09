class_name SimPlayerGift
extends RefCounted
const GIFTS := {"food":{"name":"美味餐點","cost":10,"base":5},"herbs":{"name":"草藥花束","cost":5,"base":5},"cloth":{"name":"精緻布料","cost":5,"base":5},"tools":{"name":"精良工具","cost":2,"base":5},"silver":{"name":"銀幣紅包","cost":25,"base":4}}
static func favorite(a: Dictionary) -> String:
	return {"farmer":"tools","miner":"tools","carpenter":"tools","blacksmith":"tools","doctor":"herbs","researcher":"herbs","priest":"herbs","chef":"food","cook":"food","guard":"food","merchant":"silver","tailor":"cloth"}.get(str(a.get("jobKey","")),"")
static func available(w: SimWorld,id: String) -> bool:
	return w.data.get("_godot4a",{}).get("gift_days",{}).get(id,"")!=SimTrace.day_key(w.data.clock)
static func stock(w: SimWorld,key: String) -> float:
	return float(w.data.get("stockpile",{}).get("resources",{}).get(key,0))
static func send(w: SimWorld,id: String,key: String) -> Dictionary:
	if not GIFTS.has(key) or not w.data.agents.has("player") or not w.data.agents.has(id) or id=="player" or w.data.agents[id].get("isDead",false): return {"ok":false,"error":"找不到送禮對象或禮物。"}
	if not available(w,id): return {"ok":false,"error":"這位居民今天已經收過禮物，明天再送吧。"}
	var gift: Dictionary=GIFTS[key]
	if stock(w,key)<float(gift.cost): return {"ok":false,"error":"小鎮公共庫存不足。"}
	var npc: Dictionary=w.data.agents[id];var player: Dictionary=w.data.agents.player
	w.data.stockpile.resources[key]-=gift.cost
	var history: Array=w.data.stockpile.get("history",[])
	history.append({"tick":w.data.tickCount,"resource":key,"amount":-gift.cost,"reason":"送禮給"+npc.name,"source":""})
	w.data.stockpile.history=history.slice(maxi(0,history.size()-10000))
	var extension: Dictionary=w.data.get("_godot4a",{});var days: Dictionary=extension.get("gift_days",{});days[id]=SimTrace.day_key(w.data.clock);extension.gift_days=days;w.data._godot4a=extension
	var preferred:=favorite(npc)==key;var gain: int=int(gift.base)*(2 if preferred else 1)
	var rel:=SimSocial.relationship(npc,player);SimRelationships.modify(rel,"affinity",gain)
	if preferred: SimRelationships.modify(rel,"romanticInterest",2)
	var kind:="fav_gift" if preferred else "gift_received"
	var thoughts: Array=npc.get("thoughts",[]);var found:=false
	for thought in thoughts:
		if thought.kind==kind and thought.get("targetId")=="player": thought.start=SimClock.total_days(w.data.clock);found=true;break
	if not found: thoughts.append({"kind":kind,"label":"收到最愛的禮物" if preferred else "收到禮物","mood":10 if preferred else 6,"opinion":0,"days":3 if preferred else 2,"targetId":"player","targetName":player.name,"start":SimClock.total_days(w.data.clock)})
	npc.thoughts=thoughts.slice(maxi(0,thoughts.size()-14))
	SimFeuds._memory(npc,w,"gift","收到"+player.name+"送的"+str(gift.name)+(",是我的最愛!" if preferred else ""),7 if preferred else 5,["player"])
	var reply: String=w.rng.pick(["這是我的最愛!你怎麼知道的?太感謝了!","哇!我一直想要這個!你真懂我!"] if preferred else ["謝謝你!我很喜歡。","你真貼心,謝謝!"])
	var chat: Array=player.get("chatHistory",[])
	chat.append({"speaker":player.name,"target":npc.name,"text":"🎁(送出"+str(gift.name)+")","time":SimSocial.time_string(w.data.clock)})
	chat.append({"speaker":npc.name,"target":player.name,"text":reply,"time":SimSocial.time_string(w.data.clock)});player.chatHistory=chat.slice(maxi(0,chat.size()-10000))
	SimSocial.log_message(w.data,"relationship","🎁 你送給"+npc.name+str(gift.name)+(",對方超喜歡!" if preferred else "")+"(好感+"+str(gain)+")",npc.name,"")
	SimPlayerInteraction._record(npc,w,"gift");w.data.playerActions.back().text=gift.name
	return {"ok":true,"reply":reply,"gain":gain,"favorite":preferred}

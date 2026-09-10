class_name SimRaids
extends RefCounted
const CHOICES: Dictionary={"defend":"全力防禦","negotiate":"談判求和","evacuate":"疏散避難"}
static func rules() -> Array:
	return JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/raid_rules.json"))
static func book(w: SimWorld) -> Dictionary:
	if not w.quest_balance.has("raids"): w.quest_balance.raids={"pending":{},"history":[],"serial":0,"last_day":-5,"checked_day":-1}
	return w.quest_balance.raids
static func guards(w: SimWorld) -> Array:
	return w.data.agents.values().filter(func(a): return not a.get("isPlayer",false) and not a.get("isDead",false) and a.get("jobKey")=="guard" and SimProcessing.can_work(a))
static func base_strength(w: SimWorld) -> float:
	return guards(w).size()*2+float(w.data.buildings.activeEffects.get("defense_bonus",0))
static func strength(w: SimWorld) -> float:
	return base_strength(w)+SimCareers.defense_bonus(w)+guards(w).size()*2*float(w.data.news.activeModifiers.get("guard_bonus",0))
static func chance(w: SimWorld) -> float:
	var rep:=float(w.data.reputationSystem.get("reputation",0));var shield:=.15 if rep>=70 else (.08 if rep>=40 else 0.0)
	return clampf((.10+float(w.data.news.activeModifiers.get("raid_chance",0))+float(w.data.buildings.activeEffects.get("raid_chance",0)))*(1-shield),0,.5)
static func daily(w: SimWorld) -> void:
	var day:=SimClock.total_days(w.data.clock)
	# Sheltering expires even when future raids are disabled.
	for a in w.data.agents.values():
		if a.has("_raidShelterUntil") and day>=int(a._raidShelterUntil): a.erase("_raidShelterUntil")
	if not w.raids_enabled: return
	var b:=book(w)
	if int(b.checked_day)==day: return
	b.checked_day=day
	if not b.pending.is_empty():
		if int(w.data.tickCount)>=int(b.pending.deadline): decide(w,int(b.pending.id),"")
		return
	if day-int(b.last_day)<5: return
	if w.rng.next_float()<chance(w): warn(w)
static func warn(w: SimWorld) -> bool:
	if not w.raids_enabled: return false
	var b:=book(w)
	if not b.pending.is_empty(): return false
	b.serial+=1;var raid: Dictionary=w.rng.pick(rules()).duplicate(true)
	raid.merge({"id":b.serial,"deadline":int(w.data.tickCount)+96,"created":int(w.data.tickCount)},true)
	b.pending=raid;b.last_day=SimClock.total_days(w.data.clock)
	SimSocial.log_message(w.data,"raid","⚠️ "+str(raid.description)+"小鎮正在準備應對。","","")
	SimIndustry.news(w,"event",str(raid.name)+"：一天內決定應對方式。",8)
	return true
static func recommendation(w: SimWorld,p: Dictionary) -> String:
	if strength(w)+1+(3 if not guards(w).is_empty() else 0)>=float(p.threat_level): return "defend"
	if SimEconomy.amount(w,"silver")>=float(p.threat_level)*15+20: return "negotiate"
	return "evacuate"
static func decide(w: SimWorld,id: int,suggestion: String) -> Dictionary:
	var b:=book(w);var p: Dictionary=b.pending
	if not w.raids_enabled or p.is_empty() or int(p.id)!=id or (not suggestion.is_empty() and not CHOICES.has(suggestion)): return {"ok":false,"message":"事件已結束或選項無效。"}
	var mayor:=SimGovernance.mayor(w);var player_decides:=mayor=="player" and not suggestion.is_empty()
	var choice:=suggestion if player_decides else recommendation(w,p)
	var accepted:=suggestion==choice
	var actor:=str(w.data.agents.get(mayor,{}).get("name","值勤守衛"))
	var reason:="鎮長直接下令。" if player_decides else ("採納你的建議。" if accepted else "依守備、威脅與公共預算決定。")
	if not player_decides and not suggestion.is_empty() and not accepted: reason="未採納建議："+("現有守備足以迎戰。" if choice=="defend" else ("守備不足，且可負擔求和費。" if choice=="negotiate" else "守備與預算不足，優先避難。"))
	if choice=="negotiate" and SimEconomy.amount(w,"silver")<float(p.threat_level)*15: return {"ok":false,"message":"公共銀幣不足，未結算；請選擇其他方案。"}
	var result:={"id":id,"day":SimClock.total_days(w.data.clock),"name":p.name,"attacker":p.attacker,"threat":p.threat_level,"choice":choice,"suggestion":suggestion,"authority":actor,"reason":reason,"victory":false,"losses":{},"defense":0.0}
	for a in w.data.agents.values():
		if not a.get("isDead",false): SimFeuds._mood(a,w,float(p.effects.get("mood_all",0)))
	match choice:
		"negotiate":
			var cost: float=p.threat_level*15;SimEconomy.consume(w,"silver",cost,"鎮務求和："+str(p.name));result.losses.silver=cost
			result.message="支付求和費，避免本次衝突；不算成功抵禦。"
		"evacuate":
			for resource in ["food","wood","stone"]:
				var loss:=floorf(SimEconomy.amount(w,resource)*.15)
				if loss>0: SimEconomy.consume(w,resource,loss,"疏散損失："+str(p.name));result.losses[resource]=loss
			shelter(w);result.message="居民在家避難至翌日，部分物資損失；不算成功抵禦。"
		"defend":
			result.defense=strength(w)+w.rng.next_int(1,3)+(3 if not guards(w).is_empty() else 0)
			result.victory=float(result.defense)>=float(p.threat_level)
			if result.victory:
				SimQuests.count(w,"raidsSurvived");result.message="小鎮成功抵禦了"+str(p.attacker)+"！"
				for g in guards(w): SimFeuds._mood(g,w,10);SimFeuds._memory(g,w,"raid","協助抵禦了"+str(p.attacker),8,[])
			else:
				for pair in [["food",10,30],["silver",5,20]]:
					var loss:=minf(SimEconomy.amount(w,pair[0]),w.rng.next_int(pair[1],pair[2]))
					if loss>0: SimEconomy.consume(w,pair[0],loss,"遭"+str(p.attacker)+"掠奪");result.losses[pair[0]]=loss
				shelter(w);result.message="防線被突破，損失物資，居民在家避難至翌日。"
	b.pending={};b.history.append(result);b.history=b.history.slice(-30)
	w.data.events._daysSinceRaid=0
	var event:={"name":p.name,"description":result.message,"severity":p.severity,"effects":p.effects.duplicate(true),"event_type":"raid"}
	w.data.events.eventLog.append([SimSocial.time_string(w.data.clock),event]);w.data.events.conversationTopics.append(str(p.effects.get("conversation_topic",p.name)));w.data.events.conversationTopics=w.data.events.conversationTopics.slice(-5)
	SimSocial.log_message(w.data,"raid",actor+"決定「"+str(CHOICES[choice])+"」："+str(result.message),actor,"")
	SimIndustry.news(w,"event",str(result.message),8)
	for a in w.data.agents.values():
		if not a.get("isDead",false): SimFeuds._memory(a,w,"raid",actor+"決定「"+str(CHOICES[choice])+"」；"+str(result.message),7,[])
	return {"ok":true,"message":result.message,"result":result}
static func shelter(w: SimWorld) -> void:
	for a in w.data.agents.values():
		if a.get("isPlayer",false) or a.get("isDead",false) or a.get("jobKey")=="guard": continue
		a._raidShelterUntil=SimClock.total_days(w.data.clock)+1;a.currentLocation=a.homeLocation;a.activity="sleeping";a._locationStayRemaining=0
		w.runtime[a.id].targetLocation=null

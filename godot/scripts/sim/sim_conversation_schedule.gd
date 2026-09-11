class_name SimConversationSchedule
extends RefCounted

# Capture facts, not countdowns or animation coordinates. Return detached values
# so changes made while a transport awaits cannot also change its baseline.
static func fields(source: Variant, keys: Array) -> Dictionary:
	var result: Dictionary={}
	if source is Dictionary:
		for key in keys:
			if source.has(key): result[key]=str(source[key]).left(160) if source[key] is String else source[key]
	return result.duplicate(true)

static func context(w: SimWorld,id: String) -> Dictionary:
	var a: Dictionary=w.data.agents.get(id,{})
	var pending:=fields(a.get("_pendingHangout"),["withId","location","issued_tick","not_before","expires_at","agenda_until"])
	var token:=str(a.get("_activeHangout",""))
	var active:=fields(SimHangoutVisits.records(w).get(token),["people","place","issued_tick","until","departed","arrived","state","reason","paused","pause_until"])
	var ids: Array=[id]
	if pending.has("withId") and pending.withId not in ids: ids.append(pending.withId)
	for person in active.get("people",[]).slice(0,2):
		if person not in ids: ids.append(person)
	var people: Dictionary={}
	for person in ids:
		var peer: Dictionary=w.data.agents.get(person,{})
		people[person]={"name":str(peer.get("name",person)).left(80),"absent":peer.is_empty(),"dead":peer.get("isDead",false),"sheltering":peer.has("_raidShelterUntil"),"hungry":float(peer.get("needs",{}).get("hunger",100))<15,"exhausted":float(peer.get("needs",{}).get("rest",100))<10,"activity":str(peer.get("activity","")).left(40)}
	var place:=str(active.get("place",pending.get("location","")))
	return {"enabled":SimHangoutSafety.enabled(w),"pending":pending,"active":active,"lastOutcome":fields(w.quest_balance.get("hangout_status",{}).get(id),["state","reason"]),"people":people,"place":fields(w.data.townMap.locations.get(place),["name"]),"rule":"同行是居民彼此的安排，與玩家邀約分開。pending／traveling／單方 arrived 不等於碰面，只有 met 已完成；paused 暫停，cancelled／missed 未完成。依目前原因回答，不沿用舊承諾、不把口頭文字當行動。"}

static func capture(w: SimWorld,id: String) -> Dictionary:
	return {"leisure":SimLeisureChat.context(w,id),"workplace":SimWorkplaces.context(w,id),"appointment":SimAppointments.current(w),"hangout":context(w,id)}.duplicate(true)

class_name SimDailyTalk
extends RefCounted
# Local, proximity-based spontaneous greetings. No background API calls or rewards.
static func enabled(w: SimWorld) -> bool:
	return bool(w.quest_balance.get("daily_talk_enabled",true))
static func eligible(w: SimWorld,m: SimMotion,id: String) -> bool:
	if id=="player" or not w.data.agents.has(id) or not m.positions.has(id) or not m.positions.has("player"): return false
	var a: Dictionary=w.data.agents[id]
	if a.get("isDead",false) or a.has("_raidShelterUntil") or a.activity not in ["wandering","socializing","recreation","idle"]: return false
	if float(a.needs.rest)<25 or float(a.needs.hunger)<25: return false
	var rel: Dictionary=a.get("relationships",{}).get("player",{})
	if float(rel.get("affinity",0))<0: return false
	if float(a.needs.social)>60 and float(rel.get("affinity",0))<25: return false
	var job:=SimPlayerChat.job(w,a);var hour:=int(w.data.clock.hour)
	if job.has("work_hours"):
		var start:=int(job.work_hours[0]);var end:=int(job.work_hours[1])
		if (hour>=start and hour<end if start<end else hour>=start or hour<end): return false
	var place:=SimCareerPresence.place(m,id)
	if not SimCareerPresence.together(m,"player",id,place): return false
	var p: Dictionary=m.positions.player;var n: Dictionary=m.positions[id]
	return Vector2(p.x,p.y).distance_to(Vector2(n.x,n.y))<=48
static func observe(w: SimWorld,m: SimMotion) -> String:
	if not enabled(w) or not w.data.agents.has("player"): return ""
	var player: Dictionary=w.data.agents.player;var hour:=int(w.data.clock.hour)
	if player.get("isDead",false) or player.has("_raidShelterUntil") or player.activity=="sleeping" or hour<8 or hour>=21: return ""
	if not w.event_comments.is_empty() or SimAppointments.LIVE.has(SimAppointments.current(w).get("state","")): return ""
	var old: Dictionary=w.quest_balance.get("daily_talk",{})
	if int(w.data.tickCount)-int(old.get("last_tick",-1000))<16: return ""
	var day:=SimTrace.day_key(w.data.clock)
	var same_day: bool=old.get("day","")==day
	if same_day and int(old.get("used",0))>=2: return ""
	var candidates: Array=[]
	for id in w.data.agents:
		if same_day and id in old.get("visits",[]): continue
		if eligible(w,m,id): candidates.append(id)
	if candidates.is_empty(): return ""
	# Closest resident first, stable ID tie-break; do not consume simulation RNG.
	var p: Dictionary=m.positions.player
	candidates.sort_custom(func(a,b):
		var da:=Vector2(m.positions[a].x-p.x,m.positions[a].y-p.y).length_squared()
		var db:=Vector2(m.positions[b].x-p.x,m.positions[b].y-p.y).length_squared()
		return str(a)<str(b) if is_equal_approx(da,db) else da<db)
	var id: String=candidates[0];var npc: Dictionary=w.data.agents[id]
	var book:=old.duplicate(true)
	if not same_day: book.day=day;book.used=0;book.visits=[]
	var topics: Dictionary=book.get("topics",{})
	var topic: String="mood" if float(npc.mood)<0 else ("familiar" if float(npc.get("relationships",{}).get("player",{}).get("affinity",0))>=25 else "greeting")
	if topics.get(id,"")==topic: topic="season"
	var text: String={"mood":"今天心情有些悶，剛好碰到你，想打聲招呼。","familiar":"見到你真好。今天有什麼想聊的嗎？","greeting":"剛好在這裡碰到你，今天過得如何？","season":"已經是"+str(w.data.clock.season)+"了。你最近在鎮上過得還習慣嗎？"}[topic]
	var recall:=SimTalkRecall.pick(w,id,book)
	if recall.is_empty(): recall=SimLeisureChat.recall(w,id,book)
	if not recall.is_empty():
		text=recall.text;topic="recall"
		var recalled: Array=book.get("recalled",[])
		recalled.append(recall.key);book.recalled=recalled.slice(-20)
	topics[id]=topic
	for key in topics.keys():
		if not w.data.agents.has(key): topics.erase(key)
	book.topics=topics;book.used=int(book.get("used",0))+1;book.visits.append(id);book.last_tick=int(w.data.tickCount);book.last_npc=id;book.last_text=text
	w.quest_balance.daily_talk=book
	var history: Array=player.get("chatHistory",[])
	var entry:={"speaker":npc.name,"target":player.name,"text":text,"time":SimSocial.time_string(w.data.clock),"_godotOffline":true}
	if not recall.is_empty(): entry._godotRecall=recall.source
	history.append(entry);player.chatHistory=history.slice(-10000)
	SimFeuds._memory(npc,w,"conversation","在現場向"+str(player.name)+"搭話："+text,3,[player.name])
	SimFeuds._memory(player,w,"conversation",str(npc.name)+"在現場向我搭話："+text,3,[npc.name])
	return id

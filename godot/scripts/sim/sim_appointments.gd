class_name SimAppointments
extends RefCounted
# One player appointment at a time. No resources, romance rewards or logical arrival shortcuts.
const PLACES := ["town_square"]
const LIVE := ["offered", "accepted", "waiting"]
static func current(w: SimWorld) -> Dictionary:
	return w.quest_balance.get("appointments",{}).get("current",{})
static func reason(w: SimWorld,id: String) -> String:
	if not w.data.agents.has(id) or w.data.agents[id].get("isDead",false): return "對方已離開或過世"
	var a: Dictionary=w.data.agents[id]
	if a.has("_raidShelterUntil"): return "鎮上避難中"
	if float(a.needs.rest)<10 or float(a.needs.hunger)<15: return "對方需要先休息或進食"
	return ""
static func free_hour(w: SimWorld,id: String,hour: int) -> bool:
	var job:=SimPlayerChat.job(w,w.data.agents[id])
	if job.is_empty() or not job.has("work_hours"): return true
	var start:=int(job.work_hours[0]);var end:=int(job.work_hours[1])
	# Include the commute hour, including jobs spanning midnight.
	for h in 3:
		var value:=posmod(hour+h,24)
		if value==posmod(start-1,24) or (value>=start and value<end if start<end else value>=start or value<end): return false
	return true
static func offer(w: SimWorld,id: String,place: String="town_square") -> String:
	if id=="player" or not w.data.agents.has("player") or not reason(w,id).is_empty(): return "目前無法安排邀約。"
	if not PLACES.has(place) or not w.data.townMap.locations.has(place): return "這個地點無法安排見面。"
	if LIVE.has(current(w).get("state","")): return "已有待回覆或進行中的約定，請先處理。"
	var book: Dictionary=w.quest_balance.get("appointments",{})
	if int(w.data.tickCount)-int(book.get("last_offer_tick",-1000))<96: return "邀約每天最多一份，請稍後再安排。"
	var hour:=-1
	for candidate in [18,19,17,16,15,14,13,12,11,10,9,8]:
		if free_hour(w,id,candidate): hour=candidate;break
	if hour<0: return "對方明天沒有合適的空檔。"
	var delay:=96-int(w.data.clock.hour)*4-int(w.data.clock.minute)/15+hour*4
	book.last_offer_tick=int(w.data.tickCount)
	book.current={"npc":id,"place":place,"due":int(w.data.tickCount)+delay,"until":int(w.data.tickCount)+delay+8,"expires":int(w.data.tickCount)+8,"state":"offered","time":"小鎮第 %d 天 %02d:00"%[SimClock.total_days(w.data.clock)+2,hour],"hour":hour,"reason":"等待玩家回覆"}
	book.history=book.get("history",[]);w.quest_balance.appointments=book
	return "收到邀約，請到「見面約定」接受或拒絕；接受後才會排入行程。"
static func finish(w: SimWorld,state: String,why: String) -> void:
	var a:=current(w)
	if not LIVE.has(a.get("state","")): return
	a.state=state;a.reason=why
	var book: Dictionary=w.quest_balance.appointments
	book.history.append(a.duplicate(true));book.history=book.history.slice(-20)
	for id in ["player",a.npc]:
		if w.data.agents.has(id): SimFeuds._memory(w.data.agents[id],w,"appointment","見面約定："+why,5,[])
	if w.data.agents.has(a.npc):
		w.data.agents[a.npc]._locationStayRemaining=0;w.data.agents[a.npc].erase("_appointmentDestination")
static func respond(w: SimWorld,accept: bool) -> bool:
	var a:=current(w)
	if a.get("state")!="offered": return false
	if int(w.data.tickCount)>=int(a.expires): finish(w,"expired","邀約超過回覆時間，未排入行程");return false
	if not accept: finish(w,"declined","玩家婉拒邀約");return true
	var why:=reason(w,a.npc)
	if not why.is_empty(): finish(w,"cancelled",why);return false
	a.state="accepted";a.reason="已接受，到時間後請自行前往見面地點"
	for id in ["player",a.npc]: SimFeuds._memory(w.data.agents[id],w,"appointment","已約定於"+a.time+"在"+str(w.data.townMap.locations[a.place].get("name",a.place))+"見面",5,[])
	return true
static func tick(w: SimWorld) -> void:
	var a:=current(w)
	if not LIVE.has(a.get("state","")): return
	if not w.data.agents.has("player") or w.data.agents.player.get("isDead",false): finish(w,"cancelled","玩家已無法赴約");return
	if a.state=="offered":
		if int(w.data.tickCount)>=int(a.expires): finish(w,"expired","邀約超過回覆時間，未排入行程")
		return
	var why:=reason(w,a.npc)
	if not why.is_empty():
		# A need arising before the meeting is handled by normal eating/sleeping first.
		if why!="對方需要先休息或進食" or int(w.data.tickCount)>=int(a.due): finish(w,"cancelled",why)
		return
	if not w.data.townMap.locations.has(a.place): finish(w,"cancelled","見面地點已不存在");return
	if not free_hour(w,a.npc,int(a.hour)): finish(w,"cancelled","對方的工作時間改變，與約定衝突");return
	if int(w.data.tickCount)>=int(a.until):
		finish(w,"missed","等待時間結束，未在現場碰面（玩家未到或雙方未靠近）" if a.get("npc_arrived",false) else "等待時間結束，對方尚未抵達；未視為完成見面")
static func directing(w: SimWorld,id: String) -> bool:
	var a:=current(w)
	if not w.data.agents.has(id) or not reason(w,id).is_empty(): return false
	var hour:=int(w.data.clock.hour)
	if hour<6 or hour>=22: return false
	var job:=SimPlayerChat.job(w,w.data.agents[id])
	if job.has("work_hours"):
		var start:=int(job.work_hours[0]);var end:=int(job.work_hours[1])
		if (hour>=start and hour<end if start<end else hour>=start or hour<end): return false
	return a.get("state") in ["accepted","waiting"] and a.npc==id and int(w.data.tickCount)>=int(a.due)-32 and int(w.data.tickCount)<int(a.until)
static func observe(w: SimWorld,m: SimMotion) -> void:
	var a:=current(w)
	if not a.get("state") in ["accepted","waiting"] or int(w.data.tickCount)<int(a.due) or int(w.data.tickCount)>=int(a.until): return
	if not reason(w,a.npc).is_empty(): return
	if SimCareerPresence.place(m,a.npc)!=a.place: return
	a.state="waiting";a.npc_arrived=true;a.reason="對方已抵達，正在等待你靠近"
	if not SimCareerPresence.together(m,"player",a.npc,a.place): return
	var p: Dictionary=m.positions.player;var n: Dictionary=m.positions[a.npc]
	if Vector2(p.x,p.y).distance_to(Vector2(n.x,n.y))>48: return
	finish(w,"met","雙方已在約定地點實際碰面")
	var npc: Dictionary=w.data.agents[a.npc];var player: Dictionary=w.data.agents.player
	var history: Array=player.get("chatHistory",[])
	history.append({"speaker":npc.name,"target":player.name,"text":"你來了！很高興我們都記得這次約定。","time":SimSocial.time_string(w.data.clock),"_godotOffline":true})
	player.chatHistory=history.slice(-10000)

static func reschedule_error(w: SimWorld) -> String:
	var a:=current(w)
	if a.get("state")!="accepted": return "只有已接受、尚未到場等待的約定可以改期。"
	if int(a.get("reschedule_count",0))>=1: return "這份約定已改期一次，不能反覆順延。"
	if int(w.data.tickCount)>int(a.due)-8: return "請至少在約定前兩個遊戲小時提出改期。"
	if not w.data.agents.has("player") or w.data.agents.player.get("isDead",false): return "玩家已無法赴約。"
	var why:=reason(w,a.npc)
	if not why.is_empty(): return why+"，目前無法確認改期。"
	if not w.data.townMap.locations.has(a.place): return "原本的見面地點已不存在。"
	if not free_hour(w,a.npc,int(a.hour)): return "對方隔天這個時段有工作，無法同意改期。"
	return ""
static func reschedule(w: SimWorld) -> Dictionary:
	var error:=reschedule_error(w)
	if not error.is_empty(): return {"ok":false,"error":error}
	var a:=current(w);var old_time: String=a.time;var old_due:=int(a.due)
	var due:=old_due+96
	var minutes:=int(w.data.clock.hour)*60+int(w.data.clock.minute)+(due-int(w.data.tickCount))*15
	var day:=SimClock.total_days(w.data.clock)+int(minutes/1440)+1
	var new_time: String="小鎮第 %d 天 %02d:00"%[day,int(a.hour)]
	var why: String="對方同意改期："+old_time+" → "+new_time
	var entry:=a.duplicate(true);entry.state="rescheduled";entry.reason=why;entry.changed_tick=int(w.data.tickCount)
	var book: Dictionary=w.quest_balance.appointments
	book.history.append(entry);book.history=book.history.slice(-20)
	a.due=due;a.until=int(a.until)+96;a.time=new_time;a.reason=why;a.reschedule_count=1
	a.previous_due=old_due;a.previous_time=old_time;a.erase("npc_arrived")
	var npc: Dictionary=w.data.agents[a.npc]
	npc.erase("_appointmentDestination");npc._locationStayRemaining=0
	w.runtime[a.npc].targetLocation=null
	for id in ["player",a.npc]: SimFeuds._memory(w.data.agents[id],w,"appointment","與"+str(npc.name if id=="player" else w.data.agents.player.name)+"的約定改期："+old_time+" → "+new_time,5,[])
	return {"ok":true,"notice":why}

class_name SimAppointmentChanges
extends RefCounted
# Work conflicts may propose one replacement; the player must explicitly accept it.
static func propose(w: SimWorld) -> bool:
	var a:=SimAppointments.current(w)
	if a.get("state")!="accepted" or int(a.get("reschedule_count",0))>=1: return false
	if not SimAppointments.reason(w,a.npc).is_empty() or not w.data.townMap.locations.has(a.place): return false
	if SimAppointments.free_hour(w,a.npc,int(a.hour)): return false
	var hour:=-1
	for candidate in [18,19,17,16,15,14,13,12,11,10,9,8]:
		if SimAppointments.free_hour(w,a.npc,candidate): hour=candidate;break
	if hour<0: return false
	var now:=int(w.data.tickCount)
	# Use the day after the original appointment, or tomorrow if the original is past.
	var old_midnight:=int(a.due)-int(a.hour)*4
	var next_midnight:=now-int(w.data.clock.hour)*4-int(w.data.clock.minute)/15+96
	var due:=maxi(old_midnight+96,next_midnight)+hour*4
	var minutes:=int(w.data.clock.hour)*60+int(w.data.clock.minute)+(due-now)*15
	var time: String="小鎮第 %d 天 %02d:00"%[SimClock.total_days(w.data.clock)+int(minutes/1440)+1,hour]
	a.proposal={"due":due,"until":due+8,"hour":hour,"time":time,"expires":now+8}
	a.state="change_offered";a.reason="對方工作時段改變，原約定暫停；提議改為"+time+"，等待你回覆"
	var npc: Dictionary=w.data.agents[a.npc];var player: Dictionary=w.data.agents.player
	npc.erase("_appointmentDestination");npc._locationStayRemaining=0;w.runtime[a.npc].targetLocation=null
	var text: String="我的工作時段改變，原本的約定沒辦法赴約了。可以改成"+time+"，在原來的廣場見面嗎？請在兩個遊戲小時內回覆。"
	var history: Array=player.get("chatHistory",[])
	history.append({"speaker":npc.name,"target":player.name,"text":text,"time":SimSocial.time_string(w.data.clock),"_godotOffline":true});player.chatHistory=history.slice(-10000)
	for id in ["player",a.npc]: SimFeuds._memory(w.data.agents[id],w,"appointment","與"+str(npc.name if id=="player" else player.name)+"的工作衝突改約提議（尚未同意）："+str(a.time)+" → "+time,5,[])
	return true
static func tick(w: SimWorld) -> void:
	var a:=SimAppointments.current(w)
	if a.get("state")!="change_offered": return
	var why:=SimAppointments.reason(w,a.npc)
	if not why.is_empty() and why!="對方需要先休息或進食": SimAppointments.finish(w,"cancelled",why);return
	if int(w.data.tickCount)>=int(a.proposal.expires): SimAppointments.finish(w,"cancelled","改約提議未獲回覆，原約定因工作衝突取消");return
	if not w.data.townMap.locations.has(a.place): SimAppointments.finish(w,"cancelled","見面地點已不存在");return
	if not SimAppointments.free_hour(w,a.npc,int(a.proposal.hour)): SimAppointments.finish(w,"cancelled","新時段又有工作衝突，取消約定而不反覆改期")
static func respond(w: SimWorld,accept: bool) -> bool:
	var a:=SimAppointments.current(w)
	if a.get("state")!="change_offered": return false
	tick(w)
	if a.state!="change_offered": return false
	if not accept: SimAppointments.finish(w,"cancelled","玩家婉拒改約，原約定因工作衝突取消");return true
	var why:=SimAppointments.reason(w,a.npc)
	if not w.data.agents.has("player") or w.data.agents.player.get("isDead",false): why="玩家已無法赴約"
	if not why.is_empty(): SimAppointments.finish(w,"cancelled",why+"，無法確認新約定");return false
	var proposal: Dictionary=a.proposal.duplicate(true)
	var old_time: String=a.time;var old_due:=int(a.due)
	var message: String="玩家同意 NPC 改約："+old_time+" → "+str(proposal.time)
	var entry:=a.duplicate(true);entry.state="rescheduled";entry.reason=message
	var book: Dictionary=w.quest_balance.appointments;book.history.append(entry);book.history=book.history.slice(-20)
	for key in ["due","until","hour","time"]: a[key]=proposal[key]
	a.previous_time=old_time;a.previous_due=old_due;a.reschedule_count=1;a.reason=message;a.state="accepted";a.erase("proposal");a.erase("npc_arrived")
	for id in ["player",a.npc]: SimFeuds._memory(w.data.agents[id],w,"appointment","與"+str(w.data.agents[a.npc].name if id=="player" else w.data.agents.player.name)+"："+message,5,[])
	return true

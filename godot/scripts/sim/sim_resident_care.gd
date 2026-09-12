class_name SimResidentCare
extends RefCounted
# Bounded fatigue care / supportive conversation; no goods or career rewards.
const PROVIDER_DAILY_LIMIT := 3
const MAX_TRAVEL_TICKS := 16 # At most four in-game hours, including arrival observation.
const SERVICE_TICKS := 2
const RECOVERY_REASON := "完成前可能需要先吃飯或休息。"
static func eligible(w: SimWorld,id: String) -> bool:
	var a: Dictionary=w.data.agents.get(id,{})
	if id=="player" or a.is_empty() or not SimServiceStay.priority(w,id).is_empty(): return false
	if a.has("_careRecovery") or a.get("_serviceStay",false) or SimLeisurePlan.directing(w,id): return false
	return w.quest_balance.get("careers",{}).get("active",{}).get("target","")!=id
static func provider_ready(w: SimWorld,m: SimMotion,id: String) -> bool:
	var a: Dictionary=w.data.agents.get(id,{})
	if id=="player" or a.is_empty() or a.get("isDead",false): return false
	if a.get("_serviceStay",false) or w.quest_balance.get("careers",{}).get("active",{}).get("target","")==id: return false
	if SimAppointments.directing(w,id) or SimLeisurePlan.directing(w,id) or SimHangoutVisits.directing(w,id): return false
	if a.get("jobKey","") not in ["doctor","priest"] or a.activity!="working": return false
	if a.has("_raidShelterUntil") or float(a.needs.hunger)<20 or float(a.needs.rest)<10: return false
	if not SimWorkSchedule.working(SimWorkSchedule.job(a,w.rules.jobs),int(w.data.clock.hour)): return false
	for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
		if not str(a.get(key,"")).is_empty(): return false
	if str(SimWorkSchedule.job(a,w.rules.jobs).get("workplace",""))!=a.currentLocation: return false
	var p: Dictionary=m.positions.get(id,{})
	return not p.is_empty() and not p.get("walking",true) and p.get("doorPhase")==null and SimCareerPresence.place(m,id)==a.currentLocation and w.data.townMap.locations.has(a.currentLocation)
static func needed(a: Dictionary,job: String) -> bool:
	return float(a.needs.rest)>=10 and float(a.needs.rest)<=40 if job=="doctor" else float(a.mood)<0
static func allowance(w: SimWorld,a: Dictionary,provider: Dictionary,job: String) -> bool:
	var b:=SimCareers.book(w)
	var key:="treated" if job=="doctor" else "counseled"
	var quota: Dictionary=provider.get("_careProvided",{})
	return str(a.id) not in b.get(key,[]) and (int(quota.get("day",-1))!=SimClock.total_days(w.data.clock) or int(quota.get("used",0))<PROVIDER_DAILY_LIMIT)
static func complete(w: SimWorld,a: Dictionary,provider: Dictionary) -> void:
	var v: Dictionary=a._careVisit
	if not allowance(w,a,provider,str(v.job)): clear(a,"今日同類照護或接待額度已用完。",w.data.tickCount);return
	var b:=SimCareers.book(w);var key:="treated" if v.job=="doctor" else "counseled"
	if not b.has(key): b[key]=[]
	b[key].append(str(a.id))
	var day:=SimClock.total_days(w.data.clock);var quota: Dictionary=provider.get("_careProvided",{})
	provider._careProvided={"day":day,"used":int(quota.get("used",0))+1 if int(quota.get("day",-1))==day else 1}
	var before: float=a.needs.rest if v.job=="doctor" else a.mood
	if v.job=="doctor": a.needs.rest=minf(100,float(a.needs.rest)+15)
	else:
		SimFeuds._mood(a,w,8);a.mood=clampf(float(a.mood)+8,-100,100)
	var amount: float=(float(a.needs.rest) if v.job=="doctor" else float(a.mood))-before
	var notice:="完成疲憊照護，體力 +%.0f。"%amount if v.job=="doctor" else "完成談心陪伴，心情 +%.0f。"%amount
	SimFeuds._memory(a,w,"care",str(provider.name)+"："+notice,5,[str(provider.id)])
	clear(a,notice,w.data.tickCount,"completed",amount)
static func clear(a: Dictionary,reason: String,tick: int=-1,state: String="cancelled",amount: float=0) -> void:
	if a.has("_careVisit"):
		var v: Dictionary=a._careVisit;var rows: Array=a.get("_careResults",[])
		rows.append({"state":state,"tick":tick,"provider":v.get("provider",""),"job":v.get("job",""),"amount":amount,"reason":reason})
		while rows.size()>8: rows.pop_front()
		a._careResults=rows
	a.erase("_careVisit");a.erase("_careDestination");a.erase("_careHolding")
	a._careVisitNotice=reason
	if a.activity in ["care_travel","care_wait"]: a.activity="wandering";a._locationStayRemaining=0
static func route_distance(m: SimMotion,id: String,place: String,goal: Vector2) -> float:
	var p: Dictionary=m.positions.get(id,{})
	if p.is_empty(): return INF
	var start:=Vector2(p.x,p.y)
	# Match SimMotion's actual exit -> destination door -> exact care position.
	var destination: Variant=m.door(place,id)
	if m.inside(start)==place or destination==null: return SimHangoutRoute.segment(m,start,goal)
	var length:=0.0
	var exit_door: Variant=m.door(m.inside(start),id)
	if exit_door!=null:
		var exit_point:=Vector2(exit_door.x,exit_door.y)
		length+=SimHangoutRoute.segment(m,start,exit_point);start=exit_point
	var door_point:=Vector2(destination.x,destination.y)
	return length+SimHangoutRoute.segment(m,start,door_point)+SimHangoutRoute.segment(m,door_point,goal)
static func queue_order(w: SimWorld,ids: Array) -> Array:
	var result:=ids.duplicate()
	result.sort_custom(func(left,right):
		var a: int=int(w.data.agents[left].get("_careQueue",{}).get("since",2147483647))
		var b: int=int(w.data.agents[right].get("_careQueue",{}).get("since",2147483647))
		return str(left)<str(right) if a==b else a<b)
	return result
static func travel_ticks(m: SimMotion,id: String,place: String,goal: Vector2) -> int:
	var length:=route_distance(m,id,place,goal)
	if not is_finite(length) or m.travel_budget()<=0: return MAX_TRAVEL_TICKS+1
	return ceili(length/m.travel_budget())+1
static func feasibility(w: SimWorld,a: Dictionary,b: Dictionary,goal: Vector2) -> String:
	var m: SimMotion=w.social.observed_motion
	if m==null or not m.positions.has(str(a.id)): return "尚未取得位置。"
	var length:=route_distance(m,str(a.id),str(b.currentLocation),goal)
	if is_inf(length): return "目前沒有可通行的接待路線。"
	var travel:=travel_ticks(m,str(a.id),str(b.currentLocation),goal)
	if travel>MAX_TRAVEL_TICKS: return "步行超過四小時的赴診上限，先保留必要作息。"
	var duration:=travel+SERVICE_TICKS
	if float(a.needs.hunger)-duration*2<20 or float(a.needs.rest)-duration*1.5<10: return RECOVERY_REASON
	if float(b.needs.hunger)-duration*2<20 or float(b.needs.rest)-duration*1.5<10: return "服務者需要先用餐或休息。"
	var job:=SimWorkSchedule.job(b,w.rules.jobs)
	for offset in range(duration+1):
		var hour:=posmod(floori((int(w.data.clock.hour)*60+int(w.data.clock.minute)+offset*15)/60.0),24)
		if not SimWorkSchedule.working(job,hour): return "抵達並完成前，服務者就要下班。"
		if not SimLeisurePlan.person_available(a,w.rules.jobs,hour): return "照護會擠到上工準備或睡眠時段。"
	var now:=int(w.data.tickCount)
	for id in [str(a.id),str(b.id)]:
		if SimAppointments.overlaps(w,id,now,now+duration+1) or SimHangoutRoute.leisure_conflict(w,id,now,now+duration+1): return "已有約定或休閒安排，先保留原行程。"
	if not SimHangoutRoute.return_fits(m,a,w.data.clock,w.rules.jobs,str(b.currentLocation),duration): return "照護後沒有足夠時間慢走返家。"
	return ""
static func end_recovery(w: SimWorld,a: Dictionary,reason: String,state: String="cancelled",code: String="") -> void:
	if not a.has("_careRecovery"): return
	var task: Dictionary=a._careRecovery
	var rows: Array=a.get("_careRecoveryResults",[])
	var event:={"tick":int(w.data.tickCount),"state":state,"reason":reason,"code":code,"meal_ticks":int(task.get("meal_ticks",0)),"rest_ticks":int(task.get("rest_ticks",0)),"home":str(task.home)}
	rows.append(event);a._careRecoveryResults=rows.slice(-8)
	SimFeuds._memory(a,w,"care_recovery",reason+"（已記錄在家用餐 %d 分鐘、休息 %d 分鐘；遊戲時間。）"%[event.meal_ticks*15,event.rest_ticks*15],3,[])
	a.erase("_careRecovery");a.erase("_careDeferred");a._careVisitNotice=reason
static func begin_recovery(w: SimWorld,a: Dictionary,duration: int) -> void:
	var m: SimMotion=w.social.observed_motion;var now:=int(w.data.tickCount)
	if a.has("_careRecovery") or int(a.get("_careRecoveryDay",-1))==SimClock.total_days(w.data.clock): return
	var distance:=SimHomeRest.remaining_distance(m,a)
	if not is_finite(distance): return
	var travel:=ceili(distance/m.travel_budget())+1
	if travel>16 or float(a.needs.hunger)-travel*2<15 or float(a.needs.rest)-travel*1.5<10: return
	for offset in range(travel+5):
		var hour:=posmod(floori((int(w.data.clock.hour)*60+int(w.data.clock.minute)+offset*15)/60.0),24)
		if not SimLeisurePlan.person_available(a,w.rules.jobs,hour): return
	if SimAppointments.overlaps(w,str(a.id),now,now+travel+5) or SimHangoutRoute.leisure_conflict(w,str(a.id),now,now+travel+5): return
	a._careRecovery={"home":str(a.homeLocation),"day":SimClock.total_days(w.data.clock),"arrive_until":now+travel,"until":now+travel+5,"hunger_target":20+duration*2,"rest_target":10+duration*1.5}
	a._careRecoveryDay=SimClock.total_days(w.data.clock);a.erase("_careQueue")
	a._careVisitNotice="先慢走返家，到家後用餐或短暫休息，再確認是否仍需要照護。"
const RECOVERY_STOPS := {
	"disabled":"社交安排已關閉，結束這次返家恢復。", "unavailable":"目前無法確認步行位置，結束這次返家恢復。",
	"unavailable_resident":"居民狀態已改變，結束這次返家恢復。", "raid":"需要先避難，結束這次返家恢復。",
	"home_changed":"住處已變更，結束舊住處的恢復安排。", "deadline":"恢復安排總期限已到。", "new_day":"已跨日，結束前一天的恢復安排。",
	"work":"需要上工，先結束短暫恢復。", "sleep_schedule":"已到正常睡眠時段，改依原本作息休息。",
	"commute":"需要準備通勤上工，先結束短暫恢復。", "home_return":"需要依正常睡眠安排返家，先結束短暫恢復。",
	"appointment":"需要赴已確認的約定，先結束短暫恢復。", "leisure":"需要依既有休閒安排出發，先結束短暫恢復。",
	"hangout":"需要赴同行見面安排，先結束短暫恢復。", "player_service":"正在接受玩家服務，結束自行恢復安排。",
	"hunger":"需要優先處理飢餓，結束這次短暫恢復。", "fatigue":"體力已過低，改依必要休息安排處理。",
	"arrival_timeout":"未能按時到家，結束這次短暫恢復。", "left_home":"已離開住家，結束這次短暫恢復。"
}
static func recovery_stop(w: SimWorld,a: Dictionary) -> String:
	var task: Dictionary=a._careRecovery;var id:=str(a.id)
	if not w.social_enabled: return "disabled"
	if w.social.observed_motion==null or not w.social.observed_motion.stable_routes: return "unavailable"
	if a.get("isPlayer",false) or a.get("isDead",false): return "unavailable_resident"
	if a.has("_raidShelterUntil"): return "raid"
	if task.home!=a.homeLocation: return "home_changed"
	if int(w.data.tickCount)>=int(task.until): return "deadline"
	if int(task.day)!=SimClock.total_days(w.data.clock): return "new_day"
	if SimWorkSchedule.working(SimWorkSchedule.job(a,w.rules.jobs),int(w.data.clock.hour)): return "work"
	if SimShiftSleep.asleep(a,w.rules.jobs,int(w.data.clock.hour)): return "sleep_schedule"
	if not SimCommute.plan(w,a).is_empty(): return "commute"
	var home_plan:=SimHomeRest.plan(w,a)
	if not home_plan.is_empty() and not home_plan.get("settled",false): return "home_return"
	if SimAppointments.directing(w,id): return "appointment"
	if SimLeisurePlan.directing(w,id): return "leisure"
	if SimHangoutVisits.directing(w,id): return "hangout"
	if SimServiceStay.holding(w,id): return "player_service"
	if float(a.needs.hunger)<15: return "hunger"
	if float(a.needs.rest)<10: return "fatigue"
	return ""
static func observe_recovery_followup(w: SimWorld,a: Dictionary) -> void:
	var rows: Array=a.get("_careRecoveryResults",[]);var m: SimMotion=w.social.observed_motion
	if rows.is_empty() or m==null or not m.positions.has(str(a.id)): return
	var event: Dictionary=rows.back()
	if event.has("followup") or int(w.data.tickCount)!=int(event.tick)+1: return
	var p: Dictionary=m.positions[str(a.id)]
	event.followup={"tick":int(w.data.tickCount),"intent":SimAgenda.activity(a),"place":SimAgenda.place_name(w,m,SimCareerPresence.room(m,str(a.id))),"x":float(p.x),"y":float(p.y)}
static func recovery_activity(w: SimWorld,a: Dictionary) -> String:
	if not a.has("_careRecovery"): return ""
	var task: Dictionary=a._careRecovery;var now:=int(w.data.tickCount);var id:=str(a.id)
	var stop:=recovery_stop(w,a)
	if not stop.is_empty():
		end_recovery(w,a,RECOVERY_STOPS[stop],"cancelled",stop);return ""
	if not SimHomeRest.arrived(w,a):
		if now>int(task.arrive_until) or task.has("finish"):
			var code:="left_home" if task.has("finish") else "arrival_timeout"
			end_recovery(w,a,RECOVERY_STOPS[code],"cancelled",code);return ""
		return "heading_home"
	if not task.has("finish"): task.finish=now+4
	if float(a.needs.hunger)>=float(task.hunger_target) and float(a.needs.rest)>=float(task.rest_target):
		end_recovery(w,a,"已達到這次恢復目標，重新評估是否需要照護。","recovered");return ""
	if now>=int(task.finish):
		end_recovery(w,a,"短暫恢復時間已到，仍需依目前身體狀況安排生活。","time_limit");return ""
	return "eating" if float(a.needs.hunger)<float(task.hunger_target) else "sleeping"
static func record_recovery(w: SimWorld,a: Dictionary) -> void:
	if not a.has("_careRecovery") or not SimHomeRest.arrived(w,a): return
	var task: Dictionary=a._careRecovery
	if int(task.get("observed_tick",-1))==int(w.data.tickCount): return
	task.observed_tick=int(w.data.tickCount)
	if a.activity=="eating": task.meal_ticks=int(task.get("meal_ticks",0))+1
	if a.activity=="sleeping": task.rest_ticks=int(task.get("rest_ticks",0))+1
static func interrupt_for_player(w: SimWorld,target: String) -> void:
	for a in w.data.agents.values():
		if a.has("_careVisit") and (str(a.id)==target or str(a._careVisit.get("provider",""))==target):
			clear(a,"玩家已開始照護，結束這次居民接待。",w.data.tickCount)
static func tick(w: SimWorld) -> void:
	var m: SimMotion=w.social.observed_motion
	if m==null or not m.stable_routes or not w.social_enabled:
		for a in w.data.agents.values():
			if a.has("_careVisit"): clear(a,"目前無法繼續關懷行程。",w.data.tickCount)
			a.erase("_careQueue")
			if a.has("_careRecovery"):
				var code:="disabled" if not w.social_enabled else "unavailable"
				end_recovery(w,a,RECOVERY_STOPS[code],"cancelled",code)
		return
	SimCareers.book(w) # Expire yesterday's player reservation before checking NPC availability.
	var ids: Array=w.data.agents.keys();ids.sort();var used: Dictionary={}
	for a in w.data.agents.values():
		if a.has("_careRecovery") and (a.get("isDead",false) or a.get("isPlayer",false)):
			end_recovery(w,a,RECOVERY_STOPS.unavailable_resident,"cancelled","unavailable_resident")
		var queued: Dictionary=a.get("_careQueue",{})
		if not queued.is_empty() and (int(queued.day)!=SimClock.total_days(w.data.clock) or not eligible(w,str(a.id)) or not needed(a,str(queued.job))):
			a.erase("_careQueue");a._careVisitNotice="候補已結束，先依目前需要安排生活。"

	for id in ids:
		var a: Dictionary=w.data.agents[id]
		if not a.has("_careVisit"): continue
		var v: Dictionary=a._careVisit;var provider: String=str(v.get("provider",""))
		if not eligible(w,id) or not provider_ready(w,m,provider) or used.has(provider) or int(w.data.tickCount)>=int(v.get("until",0)):
			clear(a,"求助中止：行程優先、服務者離開或等候逾時。",w.data.tickCount);continue
		if v.state=="travel" and v.has("travel_until") and int(w.data.tickCount)>int(v.travel_until):
			clear(a,"未能在預留步行時間內抵達，結束這次赴診。",w.data.tickCount);continue
		var b: Dictionary=w.data.agents[provider]
		if b.jobKey!=v.job or b.currentLocation!=v.place or not needed(a,v.job): clear(a,"目前不再需要這次關懷。",w.data.tickCount);continue
		if not allowance(w,a,b,v.job): clear(a,"今日同類照護或接待額度已用完。",w.data.tickCount);continue
		used[provider]=true
		var p: Dictionary=m.positions.get(id,{})
		var q: Dictionary=m.positions[provider]
		var arrived: bool=not p.is_empty() and not p.get("walking",true) and p.get("doorPhase")==null and SimCareerPresence.together(m,id,provider,v.place) and Vector2(p.x,p.y).distance_to(Vector2(q.x,q.y))<=48
		if v.state=="visiting" and not arrived: clear(a,"雙方已離開，結束這次關懷。",w.data.tickCount);continue
		if arrived and v.state=="travel":
			v.state="visiting";v.finish=int(w.data.tickCount)+SERVICE_TICKS
			a._careVisitNotice="已實際到場，開始約三十分鐘的關懷照護（遊戲時間）。"
			w.social.converse(b,a,w.data,w.rng,w.rules.jobs);b._lastInteractionTick=w.data.tickCount
		if v.state=="visiting" and int(w.data.tickCount)>=int(v.finish): complete(w,a,b);continue
		a._careHolding=v.state=="visiting"
	for id in queue_order(w,ids):
		var a: Dictionary=w.data.agents[id]
		if a.has("_careVisit") or not eligible(w,id) or int(a.get("_careVisitDay",-1))==SimClock.total_days(w.data.clock): continue
		for provider in ids:
			if provider==id or not provider_ready(w,m,provider): continue
			var b: Dictionary=w.data.agents[provider]
			if not needed(a,b.jobKey) or not allowance(w,a,b,b.jobKey): continue
			var q: Dictionary=m.positions[provider];var goal:=Vector2.INF
			for offset in [Vector2(24,0),Vector2(-24,0),Vector2(0,24),Vector2(0,-24),Vector2(12,0),Vector2(-12,0),Vector2(0,12),Vector2(0,-12)]:
				var candidate: Vector2=Vector2(q.x,q.y)+offset
				if m.layout._walkable(candidate) and m.location_at(candidate)==b.currentLocation: goal=candidate;break
			if not goal.is_finite(): continue
			var reason:=feasibility(w,a,b,goal)
			if not reason.is_empty():
				a._careDeferred={"day":SimClock.total_days(w.data.clock),"tick":int(w.data.tickCount),"reason":reason};a._careVisitNotice="暫緩求助："+reason
				if reason==RECOVERY_REASON:
					begin_recovery(w,a,travel_ticks(m,id,str(b.currentLocation),goal)+SERVICE_TICKS)
					if a.has("_careRecovery"): break
				continue
			if used.has(provider):
				if not a.has("_careQueue"): a._careQueue={"day":SimClock.total_days(w.data.clock),"since":int(w.data.tickCount),"job":str(b.jobKey)}
				a._careVisitNotice="候補求助：目前有人接受照護，空檔出現後會重新確認行程。"
				continue
			a.erase("_careQueue")
			a.erase("_careDeferred")
			var travel:=travel_ticks(m,id,str(b.currentLocation),goal)
			a._careVisit={"provider":provider,"job":b.jobKey,"place":b.currentLocation,"x":goal.x,"y":goal.y,"state":"travel","travel_until":int(w.data.tickCount)+travel,"until":int(w.data.tickCount)+travel+SERVICE_TICKS+1}
			a._careVisitDay=SimClock.total_days(w.data.clock);a._careVisitNotice="步行赴診，預留最多 %d 分鐘；到場後照護三十分鐘（遊戲時間）。"%(travel*15);used[provider]=true;break
static func apply(w: SimWorld,a: Dictionary,run: Dictionary) -> bool:
	if not a.has("_careVisit"): return false
	if not eligible(w,str(a.id)): clear(a,"先處理必要行程。",w.data.tickCount);return false
	a.currentLocation=a._careVisit.place;a._careDestination=a.currentLocation
	a.activity="care_wait" if a.get("_careHolding",false) else "care_travel"
	run.targetLocation=null;a._locationStayRemaining=0
	return true

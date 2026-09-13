class_name SimCareAvailability
extends RefCounted
# Read-only view: opening the panel must never reset quotas or reserve a visit.
static func remaining(w: SimWorld,b: Dictionary) -> int:
 var quota: Dictionary=b.get("_careProvided",{})
 return maxi(0,SimResidentCare.PROVIDER_DAILY_LIMIT-int(quota.get("used",0))) if int(quota.get("day",-1))==SimClock.total_days(w.data.clock) else SimResidentCare.PROVIDER_DAILY_LIMIT
static func next_shift(w: SimWorld,job: Dictionary) -> String:
 var minute:=int(w.data.clock.hour)*60+int(w.data.clock.minute)
 if SimWorkSchedule.working(job,int(w.data.clock.hour)):return "目前在工時內；接待仍以實際到場及狀態為準。"
 for offset in range(1,97):
  var future:=minute+offset*15
  if SimWorkSchedule.working(job,posmod(floori(future/60.0),24)):
   return "下次排班："+("今天" if future<1440 else "明天")+" %02d:%02d。"%[posmod(floori(future/60.0),24),future%60]
 return "目前沒有有效接待班表。"
static func status(w: SimWorld,m: SimMotion,b: Dictionary) -> String:
 var job:=SimWorkSchedule.job(b,w.rules.jobs)
 if not w.data.townMap.locations.has(str(job.get("workplace",""))):return "接待設施尚未建成"
 if not w.social_enabled:return "居民自主社交已關閉"
 if m==null or not m.stable_routes or not m.positions.has(str(b.id)):return "尚無可確認的步行位置"
 if b.has("_raidShelterUntil"):return "正在避難"
 if not SimWorkSchedule.working(job,int(w.data.clock.hour)):return "目前未到接待工時"
 if remaining(w,b)==0:return "今日居民接待額度已滿"
 if not SimResidentCare.provider_ready(w,m,str(b.id)):
  return "暫時無法接待："+SimAgenda.activity(b)
 for a in w.data.agents.values():
  if str(a.get("_careVisit",{}).get("provider",""))==str(b.id):return "已有居民赴診或正在接受照護"
 return "在現場，可重新評估接待"
static func reason(w: SimWorld,m: SimMotion,a: Dictionary,b: Dictionary,state: String) -> String:
 if a.is_empty():return "找不到這位居民。"
 if a.get("isPlayer",false):return "旅人由你操作，這裡不會安排自動赴診。"
 if a.id==b.id:return "這位居民是服務者本人。"
 if a.get("isDead",false):return "居民已離世。"
 if a.has("_careVisit"):return "已有赴診安排，依目前行程進行。"
 if a.has("_careRecovery"):return "正在返家準備，完成後再評估。"
 var key:="treated" if b.jobKey=="doctor" else "counseled"
 var book: Dictionary=w.quest_balance.get("careers",{})
 if int(book.get("day",-1))==SimClock.total_days(w.data.clock) and str(a.id) in book.get(key,[]):return "今天已完成同類照護。"
 if int(a.get("_careVisitDay",-1))==SimClock.total_days(w.data.clock):return "今天已使用一次居民求助機會。"
 if not SimResidentCare.needed(a,str(b.jobKey)):return "目前沒有這類照護需求。"
 if state!="在現場，可重新評估接待":return state+"。"
 var priority:=SimServiceStay.priority(w,str(a.id))
 if not priority.is_empty():return priority
 if not SimResidentCare.eligible(w,str(a.id)):return "目前有優先安排，稍後再評估。"
 var goal:=SimResidentCare.meeting_goal(m,b)
 if not goal.is_finite():return "目前沒有可用的近距離接待位置。"
 var why:=SimResidentCare.feasibility(w,a,b,goal)
 if why==SimResidentCare.RECOVERY_REASON:
  var access:=SimResidentCare.recovery_access(w,a,b,goal)
  if not str(access.reason).is_empty():return str(access.reason)
  var plan:=SimResidentCare.recovery_plan(w,a,int(access.duration))
  if not str(plan.reason).is_empty():return str(plan.reason)
  return "需要先回家準備；出發時仍會重新確認。"
 return "目前行程初步可行，居民會依需求自行決定。" if why.is_empty() else why
static func rows(w: SimWorld,m: SimMotion,id: String) -> Array:
 var result: Array=[];var ids: Array=w.data.agents.keys();ids.sort()
 for provider in ids:
  var b: Dictionary=w.data.agents[provider]
  if b.get("isPlayer",false) or b.get("isDead",false) or b.get("jobKey","") not in ["doctor","priest"]:continue
  var job:=SimWorkSchedule.job(b,w.rules.jobs);var state:=status(w,m,b)
  var actual:="位置尚未取得"
  if m!=null and m.positions.has(str(provider)):actual=SimAgenda.place_name(w,m,SimCareerPresence.room(m,str(provider)))
  result.append({"id":provider,"name":str(b.name),"role":"疲憊照護" if b.jobKey=="doctor" else "談心陪伴","hours":"%02d:00–%02d:00"%[int(job.work_hours[0]),int(job.work_hours[1])],"place":str(w.data.townMap.locations.get(str(job.workplace),{}).get("name","接待設施尚未建成")),"actual":actual,"status":state,"remaining":remaining(w,b),"next":next_shift(w,job),"reason":reason(w,m,w.data.agents.get(id,{}),b,state)})
 return result

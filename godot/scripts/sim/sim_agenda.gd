class_name SimAgenda
extends RefCounted
static func place_name(w: SimWorld,m: SimMotion,room: String) -> String:
	if room.is_empty(): return "道路或場所之外"
	if m.layout.houses.has(room):
		var parent: String=m.layout.houses[room].parentLocId
		return str(w.data.townMap.locations.get(parent,{}).get("name","住宅區"))+"（住家）"
	return str(w.data.townMap.locations.get(room,{}).get("name","其他場所"))
static func activity(a: Dictionary) -> String:
	if a.activity=="idle" and a.get("_homeReturn",{}).get("settled",false): return "在家準備休息"
	return {"heading_home":"慢走返家","care_travel":"前往尋求關懷","care_wait":"在現場接受關懷","receiving_service":"在現場接受服務","hangout_travel":"同行赴約／等候","planned_leisure":"休閒安排","appointment_travel":"赴約","appointment_wait":"等待見面"}.get(a.activity,SimTrace.activity_label(a))
static func current(w: SimWorld,m: SimMotion,id: String) -> Dictionary:
	if not w.data.agents.has(id): return {}
	var a: Dictionary=w.data.agents[id]
	var room:=SimCareerPresence.room(m,id);var destination: String=a.currentLocation
	var target_room:=m.layout._house_id(id,destination) if destination.begins_with("residential_") else destination
	var arrived: bool=not room.is_empty() and room==target_room
	var moving: bool=m.positions.get(id,{}).get("walking",false)
	var blocked:=m.obstruction(id)
	var text:=activity(a)
	var reception:=SimResidentCare.reception(w,id)
	if not reception.is_empty(): text="留在接待點，等待"+str(w.data.agents[reception].name)+"赴診" if w.data.agents[reception]._careVisit.state=="travel" else "留在接待點照護"+str(w.data.agents[reception].name)
	if a.get("isDead",false): text="已過世"
	elif not m.positions.has(id): text="位置尚未取得"
	elif not blocked.is_empty(): text=blocked+"（預定："+text+"）"
	elif not arrived: text=("前往目的地" if moving else "尚未抵達目的地")+"（預定："+text+"）"
	elif moving: text="在場所內移動（預定："+text+"）"
	return {"room":room,"actual":place_name(w,m,room),"destination":destination,"target":str(w.data.townMap.locations.get(destination,{}).get("name","未指定")),"arrived":arrived,"blocked":blocked,"text":text}
static func attendance(w: SimWorld,m: SimMotion,id: String) -> String:
	var a: Dictionary=w.data.agents.get(id,{})
	if a.is_empty() or a.get("isPlayer",false) or a.get("isDead",false): return ""
	var job:=SimWorkSchedule.job(a,w.rules.jobs)
	if job.is_empty() or not SimWorkSchedule.working(job,int(w.data.clock.hour)): return ""
	if not w.data.townMap.locations.has(job.workplace): return "工作場所尚未建成，目前無法到場上工。"
	if m==null or not m.positions.has(id): return "工時內，位置尚未取得，無法確認是否到場。"
	var p: Dictionary=m.positions[id]
	if SimCareerPresence.place(m,id)!=job.workplace: return "工時內，目前不在工作場所；目前活動："+activity(a)+"。"
	if p.get("walking",false) or p.get("doorPhase")!=null: return "工時內，正在工作場所進出或移動。"
	return "工時內，已在工作場所；目前活動："+activity(a)+"。"
static func routine(w: SimWorld,id: String) -> Array:
	if not w.data.agents.has(id): return []
	var a: Dictionary=w.data.agents[id]
	if a.get("isPlayer",false) or a.get("isDead",false): return []
	var sleep_window:=SimShiftSleep.window(a,w.rules.jobs)
	var start:=int(sleep_window.start);var end:=int(sleep_window.end)
	var rows: Array=["平常睡眠：%02d:00–%02d:00"%[start,end]]
	if a.has("_careVisitNotice"): rows.append("最近求助："+str(a._careVisitNotice))
	if a.has("_careRecovery"):
		var recovery: Dictionary=a._careRecovery
		if SimHomeRest.arrived(w,a):
			rows.append("在家用餐／短暫休息：最多剩餘 %d 分鐘；結束後重新評估需要（遊戲時間）。"%(maxi(0,mini(int(recovery.get("finish",recovery.until)),int(recovery.until))-int(w.data.tickCount))*15))
		else:
			rows.append("先返家恢復：剩餘 %d 分鐘抵達；走路時不恢復體力（遊戲時間）。"%(maxi(0,int(recovery.arrive_until)-int(w.data.tickCount))*15))
	for result in a.get("_careRecoveryResults",[]):
		rows.append("返家恢復紀錄："+str(result.reason)+"（在家用餐 %d 分鐘、休息 %d 分鐘；遊戲時間。）"%[int(result.get("meal_ticks",0))*15,int(result.get("rest_ticks",0))*15])
		if result.has("followup"): rows.append("下一刻觀察：當時在"+str(result.followup.place)+"；當時意圖："+str(result.followup.intent)+"。")
	for result in a.get("_careResults",[]):
		rows.append(("照護完成：" if result.get("state","")=="completed" else "求助中止：")+str(w.data.agents.get(str(result.get("provider","")),{}).get("name","居民"))+"："+str(result.get("reason","")))
	if a.has("_careVisit"):
		var provider: Dictionary=w.data.agents.get(str(a._careVisit.provider),{})
		rows.append("關懷對象："+str(provider.get("name","居民"))+"；到場並完成停留後才結算照護。")
		var visit: Dictionary=a._careVisit
		if visit.state=="travel" and visit.has("travel_until"):
			rows.append("步行赴診：剩餘 %d 分鐘抵達；實際到場後才開始照護（遊戲時間）。"%(maxi(0,int(visit.travel_until)-int(w.data.tickCount))*15))
		elif visit.state=="visiting":
			rows.append("正在照護：剩餘 %d 分鐘；必要行程或雙方離開會中止（遊戲時間）。"%(maxi(0,int(visit.get("finish",w.data.tickCount))-int(w.data.tickCount))*15))
	if a.has("_shiftSleep") and sleep_window.get("facility_available",true):
		rows.append("依班表保留 %d 小時睡眠時段，預留 %d 小時通勤。"%[sleep_window.duration,sleep_window.lead])
		if sleep_window.get("conflict",false): rows.append("班表空檔不足以容納估計通勤；保留完整睡眠，仍可能遲到。")
	# Read the exact job table used by SimWorld's daily activity decisions.
	var job: Dictionary=SimWorkSchedule.job(a,w.rules.jobs)
	if not job.is_empty():
		rows.append("工時：%02d:00–%02d:00 · %s"%[int(job.work_hours[0]),int(job.work_hours[1]),str(w.data.townMap.locations.get(job.workplace,{}).get("name","工作場所"))])
		if a.has("_guardShift"):
			rows.append("守衛輪值："+("夜班，白天補眠。" if a._guardShift=="night" else "白班。"))
			if job.workplace=="town_square": rows.append("哨站尚未建成，先在現有廣場值勤；沒有新增免費設施。")
		if SimHomeRest.physical(w) and not w.data.townMap.locations.has(job.workplace):
			var name: String={"clinic":"診所","farm":"農場","guardpost":"哨站"}.get(job.workplace,"指定工作設施")
			rows.append("工作設施未就緒："+name+"目前不存在，清醒且需求穩定時留在現有地點待命；設施可用後恢復正常通勤，不算一般遲到。")
		elif a.has("_shiftSleep"): rows.append("通勤依當下路徑提早出發，最多四小時；提早到場後等候開工。")
		else: rows.append("上班準備：%02d:00 起（清醒且尚未到工作場所時）"%posmod(int(job.work_hours[0])-1,24))
	if SimHomeRest.physical(w): rows.append("睡前依返家路程最多提早四小時出發；工作、已確認的玩家約定及緊急需求優先，提早到家不提前計算睡眠。")
	rows.append("其他時間依飢餓、疲勞、社交與娛樂需求安排；睡眠、避難等可能調整原作息。")
	return rows

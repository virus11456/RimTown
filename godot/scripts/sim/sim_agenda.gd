class_name SimAgenda
extends RefCounted
static func place_name(w: SimWorld,m: SimMotion,room: String) -> String:
	if room.is_empty(): return "道路或場所之外"
	if m.layout.houses.has(room):
		var parent: String=m.layout.houses[room].parentLocId
		return str(w.data.townMap.locations.get(parent,{}).get("name","住宅區"))+"（住家）"
	return str(w.data.townMap.locations.get(room,{}).get("name","其他場所"))
static func activity(a: Dictionary) -> String:
	return {"hangout_travel":"同行赴約／等候","planned_leisure":"休閒安排","appointment_travel":"赴約","appointment_wait":"等待見面"}.get(a.activity,SimTrace.activity_label(a))
static func current(w: SimWorld,m: SimMotion,id: String) -> Dictionary:
	if not w.data.agents.has(id): return {}
	var a: Dictionary=w.data.agents[id]
	var room:=SimCareerPresence.room(m,id);var destination: String=a.currentLocation
	var target_room:=m.layout._house_id(id,destination) if destination.begins_with("residential_") else destination
	var arrived: bool=not room.is_empty() and room==target_room
	var moving: bool=m.positions.get(id,{}).get("walking",false)
	var text:=activity(a)
	if a.get("isDead",false): text="已過世"
	elif not m.positions.has(id): text="位置尚未取得"
	elif not arrived: text=("前往目的地" if moving else "尚未抵達目的地")+"（預定："+text+"）"
	elif moving: text="在場所內移動（預定："+text+"）"
	return {"room":room,"actual":place_name(w,m,room),"destination":destination,"target":str(w.data.townMap.locations.get(destination,{}).get("name","未指定")),"arrived":arrived,"text":text}
static func routine(w: SimWorld,id: String) -> Array:
	if not w.data.agents.has(id): return []
	var a: Dictionary=w.data.agents[id]
	if a.get("isPlayer",false) or a.get("isDead",false): return []
	var sleep_window:=SimShiftSleep.window(a,w.rules.jobs)
	var start:=int(sleep_window.start);var end:=int(sleep_window.end)
	var rows: Array=["平常睡眠：%02d:00–%02d:00"%[start,end]]
	if a.has("_shiftSleep"):
		rows.append("依班表保留 %d 小時睡眠時段，預留 %d 小時通勤。"%[sleep_window.duration,sleep_window.lead])
		if sleep_window.get("conflict",false): rows.append("班表空檔不足以容納估計通勤；保留完整睡眠，仍可能遲到。")
	# Read the exact job table used by SimWorld's daily activity decisions.
	var job: Dictionary=w.rules.jobs.get(str(a.get("jobKey","")),{})
	if not job.is_empty():
		rows.append("工時：%02d:00–%02d:00 · %s"%[int(job.work_hours[0]),int(job.work_hours[1]),str(w.data.townMap.locations.get(job.workplace,{}).get("name","工作場所"))])
		if a.has("_shiftSleep"): rows.append("通勤依當下路徑提早出發，最多四小時；提早到場後等候開工。")
		else: rows.append("上班準備：%02d:00 起（清醒且尚未到工作場所時）"%posmod(int(job.work_hours[0])-1,24))
	if SimHomeRest.physical(w): rows.append("睡前依返家路程最多提早四小時出發；工作、已確認的玩家約定及緊急需求優先，提早到家不提前計算睡眠。")
	rows.append("其他時間依飢餓、疲勞、社交與娛樂需求安排；睡眠、避難等可能調整原作息。")
	return rows

class_name SimLeisurePlan
extends RefCounted
const LIVE := ["scheduled","traveling","attending"]
static func enabled(w: SimWorld) -> bool:
	return bool(w.quest_balance.get("leisure_plans_enabled",false))
static func plans(w: SimWorld) -> Dictionary:
	return w.quest_balance.get("leisure_plans",{})
static func available(w: SimWorld,id: String,hour: int) -> bool:
	var a: Dictionary=w.data.agents[id];var traits: Array=a.personality.get("traits",[])
	var start:=2 if "night_owl" in traits else 20 if "early_bird" in traits else 22
	var end:=9 if "night_owl" in traits else 5 if "early_bird" in traits else 6
	if (hour>=start or hour<end if start>end else hour>=start and hour<end): return false
	var job: Dictionary=w.rules.jobs.get(str(a.get("jobKey","")),{})
	return job.is_empty() or not (hour>=int(job.work_hours[0])-1 and hour<int(job.work_hours[1]))
static func finish(w: SimWorld,id: String,state: String,why: String) -> void:
	var p: Dictionary=plans(w).get(id,{})
	if not LIVE.has(p.get("state","")): return
	p.state=state;p.reason=why
	if w.data.agents.has(id):
		w.data.agents[id].erase("_leisureDestination");w.data.agents[id]._locationStayRemaining=0
static func tick(w: SimWorld) -> void:
	if not enabled(w):
		for id in plans(w): finish(w,id,"cancelled","自主休閒安排已關閉")
		return
	var book:=plans(w);var day:=SimTrace.day_key(w.data.clock);var now:=int(w.data.tickCount)
	for id in w.data.agents:
		var a: Dictionary=w.data.agents[id]
		if a.get("isPlayer",false): continue
		if a.get("isDead",false): finish(w,id,"cancelled","居民已過世");continue
		if book.get(id,{}).get("day","")!=day:
			var hour:=-1
			for h in [18,19,16,14,12,10,9]:
				if h*60<int(w.data.clock.hour)*60+int(w.data.clock.minute)+60: continue
				if available(w,id,h) and available(w,id,h+1): hour=h;break
			var place: String="park" if w.data.townMap.locations.has("park") else "town_square"
			var due:=now+hour*4-int(w.data.clock.hour)*4-int(w.data.clock.minute)/15 if hour>=0 else now
			book[id]={"day":day,"place":place,"due":due,"until":due+8,"hour":hour,"state":"scheduled" if hour>=0 else "skipped","reason":"依空檔安排休閒，尚未抵達" if hour>=0 else "今天沒有足夠的休閒空檔","dwell":0}
		w.quest_balance.leisure_plans=book
		var p: Dictionary=book[id]
		if not LIVE.has(p.state): continue
		if a.has("_raidShelterUntil"): finish(w,id,"cancelled","避難優先");continue
		if not w.data.townMap.locations.has(p.place): finish(w,id,"cancelled","休閒場所已不存在");continue
		if not available(w,id,int(p.hour)) or not available(w,id,int(p.hour)+1): finish(w,id,"cancelled","工時或睡眠安排改變");continue
		var meeting:=SimAppointments.current(w)
		if meeting.get("npc")==id and meeting.get("state") in ["accepted","waiting"] and int(meeting.due)-32<int(p.until) and int(meeting.until)>int(p.due)-16:
			finish(w,id,"cancelled","已確認的見面約定優先");continue
		if now>=int(p.until): finish(w,id,"missed","時段已結束，未完成實際到場停留");continue
		if float(a.needs.hunger)<15 or float(a.needs.rest)<10:
			p.state="scheduled";p.dwell=0;p.erase("observed_tick");p.reason="先處理進食或休息需求"
	for id in book.keys():
		if not w.data.agents.has(id): book.erase(id)
	w.quest_balance.leisure_plans=book
static func directing(w: SimWorld,id: String) -> bool:
	var p: Dictionary=plans(w).get(id,{})
	if not enabled(w) or not LIVE.has(p.get("state","")) or not w.data.agents.has(id): return false
	var a: Dictionary=w.data.agents[id]
	if a.get("isDead",false) or a.get("isPlayer",false) or not w.data.townMap.locations.has(p.place): return false
	if not available(w,id,int(p.hour)) or not available(w,id,int(p.hour)+1): return false
	var meeting:=SimAppointments.current(w)
	if meeting.get("npc")==id and meeting.get("state") in ["accepted","waiting"] and int(meeting.due)-32<int(p.until) and int(meeting.until)>int(p.due)-16: return false
	return int(w.data.tickCount)>=int(p.due)-16 and int(w.data.tickCount)<int(p.until) and available(w,id,int(w.data.clock.hour)) and not a.has("_raidShelterUntil") and float(a.needs.hunger)>=15 and float(a.needs.rest)>=10
static func observe(w: SimWorld,m: SimMotion) -> void:
	if not enabled(w): return
	for id in plans(w):
		var p: Dictionary=plans(w)[id]
		if not directing(w,id):
			if LIVE.has(p.get("state","")): p.state="scheduled";p.dwell=0;p.erase("observed_tick")
			continue
		if int(w.data.tickCount)<int(p.due) or SimCareerPresence.place(m,id)!=p.place:
			p.state="traveling";p.dwell=0;p.observed_tick=int(w.data.tickCount);p.reason="前往休閒場所，尚未開始停留";continue
		if p.state!="attending": p.dwell=0;p.state="attending";p.observed_tick=int(w.data.tickCount)
		elif int(w.data.tickCount)>int(p.get("observed_tick",w.data.tickCount)):
			p.dwell=int(p.dwell)+1;p.observed_tick=int(w.data.tickCount)
		p.reason="已抵達，實際停留 %d／2 段"%int(p.dwell)
		if int(p.dwell)>=2:
			finish(w,id,"completed","已實際抵達並停留三十分鐘")
			w.data.agents[id].needs.recreation=minf(100,float(w.data.agents[id].needs.recreation)+15)
			SimFeuds._memory(w.data.agents[id],w,"activity","依自己的安排到"+str(w.data.townMap.locations[p.place].get("name","戶外場所"))+"休閒，實際停留後完成。",3,[])

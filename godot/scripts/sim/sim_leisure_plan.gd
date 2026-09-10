class_name SimLeisurePlan
extends RefCounted
const LIVE := ["scheduled","traveling","attending"]
static func enabled(w: SimWorld) -> bool:
	return bool(w.quest_balance.get("leisure_plans_enabled",false))
static func plans(w: SimWorld) -> Dictionary:
	return w.quest_balance.get("leisure_plans",{})
static func history(w: SimWorld,id: String) -> Array:
	return w.quest_balance.get("leisure_history",{}).get(id,[])
static func remember(w: SimWorld,id: String,p: Dictionary) -> void:
	var book: Dictionary=w.quest_balance.get("leisure_history",{})
	var rows: Array=book.get(id,[])
	if rows.any(func(row): return row.day==p.day): return
	rows.append({"day":p.day,"hour":p.hour,"place":p.place,"place_name":str(w.data.townMap.locations.get(p.place,{}).get("name","已移除的場所")),"state":p.state,"reason":p.reason,"resolved_tick":int(w.data.tickCount)})
	while rows.size()>7: rows.pop_front()
	book[id]=rows;w.quest_balance.leisure_history=book
static func choose(w: SimWorld,id: String) -> Dictionary:
	var candidates: Array=[18,19,16,14,12,10,9]
	var rows:=history(w,id);var basis: Dictionary={}
	if not rows.is_empty():
		var last: Dictionary=rows.back();var age:=int(w.data.tickCount)-int(last.get("resolved_tick",-9999))
		if last.state in ["missed","completed"] and age>=0 and age<=192:
			basis=last.duplicate(true)
			var earlier: Array=[9,10,12,14,16,18,19]
			earlier=earlier.filter(func(h): return h<int(last.hour))
			var later: Array=candidates.filter(func(h): return h>int(last.hour))
			candidates=earlier+later+[int(last.hour)] if last.state=="missed" else [int(last.hour)]+candidates.filter(func(h): return h!=int(last.hour))
	var result:={"hour":-1,"basis":basis,"explanation":"依目前工時與睡眠空檔安排。"}
	for h in candidates:
		if h*60<int(w.data.clock.hour)*60+int(w.data.clock.minute)+60: continue
		if available(w,id,h) and available(w,id,h+1): result.hour=h;break
	if not basis.is_empty():
		if basis.state=="completed":
			result.explanation="上次已實際完成休閒，這次優先沿用成功的時段。" if result.hour==int(basis.hour) else "上次已完成，但原時段目前不適用，依作息另選空檔。"
		elif result.hour>=0 and result.hour<int(basis.hour): result.explanation="上次未完成到場停留，這次改選較早的空檔。"
		elif result.hour>int(basis.hour): result.explanation="上次未完成到場停留；沒有可用的更早空檔，這次試較晚時段，增加下班後的趕路時間。"
		else: result.explanation="上次未完成到場停留；目前沒有其他可用空檔，仍依作息安排。"
	return result
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
	remember(w,id,p)
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
			if book.has(id) and LIVE.has(book[id].get("state","")): finish(w,id,"missed","前一日已結束，未完成實際到場停留")
			var choice:=choose(w,id);var hour: int=choice.hour
			var place: String="park" if w.data.townMap.locations.has("park") else "town_square"
			var due:=now+hour*4-int(w.data.clock.hour)*4-int(w.data.clock.minute)/15 if hour>=0 else now
			book[id]={"day":day,"place":place,"due":due,"until":due+8,"hour":hour,"state":"scheduled" if hour>=0 else "skipped","reason":"依空檔安排休閒，尚未抵達" if hour>=0 else "今天沒有足夠的休閒空檔","dwell":0,"basis":choice.basis,"explanation":choice.explanation}
		w.quest_balance.leisure_plans=book
		var p: Dictionary=book[id]
		if p.state=="skipped": remember(w,id,p)
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
	var past: Dictionary=w.quest_balance.get("leisure_history",{})
	for id in past.keys():
		if not w.data.agents.has(id): past.erase(id)
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
			p.dwell=int(p.dwell)+1 if int(w.data.tickCount)-int(p.observed_tick)==1 else 0
			p.observed_tick=int(w.data.tickCount)
		p.reason="已抵達，實際停留 %d／2 段"%int(p.dwell)
		if int(p.dwell)>=2:
			finish(w,id,"completed","已實際抵達並停留三十分鐘")
			w.data.agents[id].needs.recreation=minf(100,float(w.data.agents[id].needs.recreation)+15)
			SimFeuds._memory(w.data.agents[id],w,"activity","依自己的安排到"+str(w.data.townMap.locations[p.place].get("name","戶外場所"))+"休閒，實際停留後完成。",3,[])

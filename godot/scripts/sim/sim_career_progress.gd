class_name SimCareerProgress
extends RefCounted
const STAGES: Array=["起步","入門","熟練","專精"]
static func progress(w: SimWorld,job: String) -> Dictionary:
	# Read-only default: opening the page does not backfill or award achievements.
	return w.quest_balance.get("career_progress",{}).get(job,{"completed":0,"days":[],"targets":[],"routes":[],"directions":[],"stage":0})
static func ticks(w: SimWorld,job: String) -> int:
	return 2 if int(progress(w,job).stage)>=3 else (3 if int(progress(w,job).stage)>=2 else 4)
static func special(w: SimWorld,job: String,p: Dictionary,stage: int) -> bool:
	if stage==1: return true
	match job:
		"guard": return p.routes.size()>=(3 if stage==3 else 1)
		"doctor","priest": return p.targets.size()>=(3 if stage==3 else 2)
		"farmer","carpenter","researcher": return p.targets.size()>=(2 if stage==3 else 1)
		"trader": return p.directions.size()>=(2 if stage==3 else 1)
	return true
static func detail(job: String,stage: int) -> String:
	if stage==1: return "完成一次符合真實需求的值勤。"
	match job:
		"guard": return "累計完成 %d 天完整三點巡邏。"%(3 if stage==3 else 1)
		"doctor","priest": return "服務至少 %d 位不同居民。"%(3 if stage==3 else 2)
		"farmer": return "照料至少 %d 塊不同農田。"%(2 if stage==3 else 1)
		"carpenter": return "協助至少 %d 項不同工程。"%(2 if stage==3 else 1)
		"researcher": return "參與至少 %d 項不同研究。"%(2 if stage==3 else 1)
		"trader": return "完成採購與交售兩種交接。" if stage==3 else "完成至少一種交易交接。"
	return "僅計入材料核准有效且實際入庫的批次。"
static func record(w: SimWorld,t: Dictionary) -> void:
	var job: String=t.job;var p: Dictionary=progress(w,job).duplicate(true);var day:=SimClock.total_days(w.data.clock)
	p.completed=mini(15,int(p.completed)+1)
	if not day in p.days and p.days.size()<5: p.days.append(day)
	if not str(t.target) in p.targets and p.targets.size()<3: p.targets.append(str(t.target))
	if job=="guard" and SimCareers.book(w).visits.size()==3 and not day in p.routes and p.routes.size()<3: p.routes.append(day)
	if job=="trader":
		var direction: String="sell" if t.args[1].isBuying else "buy"
		if not direction in p.directions: p.directions.append(direction)
	for stage in [1,2,3]:
		if int(p.stage)>=stage: continue
		if int(p.completed)<[0,1,6,15][stage] or p.days.size()<[0,1,3,5][stage] or not special(w,job,p,stage): break
		p.stage=stage
		SimSocial.log_message(w.data,"career","職涯任務完成："+str(SimCareers.JOBS[job].name)+" · "+str(STAGES[stage])+"。",w.data.agents.player.name,"")
	if not w.quest_balance.has("career_progress"): w.quest_balance.career_progress={}
	w.quest_balance.career_progress[job]=p

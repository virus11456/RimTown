class_name SimTrace
extends RefCounted
static func truth(value: Variant) -> bool:
	if value==null: return false
	if value is String: return not value.is_empty()
	if value is bool: return value
	if value is float or value is int: return value!=0
	return true
static func day_key(clock: Dictionary) -> String:
	return "%s-%s-%s"%[int(clock.year),clock.season,int(clock.day)]
static func minute(value: Variant) -> int:
	var regex:=RegEx.new();regex.compile("([0-9]{1,2}):([0-9]{2})")
	var found:=regex.search(str(value) if value!=null else "")
	return int(found.get_string(1))*60+int(found.get_string(2)) if found else -1
static func plan(a: Dictionary,clock: Dictionary) -> Dictionary:
	var blocks: Array=a.get("dailyPlan",{}).get("blocks",[]) if a.get("dailyPlan") is Dictionary else []
	var now: int=int(clock.hour)*60+int(clock.minute)
	var current: Dictionary={};var start:=-1;var end:=1440
	for block in blocks:
		var time:=minute(block.get("time",""))
		if time>=0 and time<=now and time>=start:
			current=block;start=time;end=1440
			for next in blocks:
				var candidate:=minute(next.get("time",""))
				if candidate>time and candidate<end: end=candidate
	if current.is_empty(): return {}
	var steps: Array=current.get("steps",[]) if current.get("steps") is Array else []
	steps=steps.filter(func(s): return truth(s))
	var step: String=""
	if not steps.is_empty(): step=str(steps[floori(clampf(float(now-start)/maxi(1,end-start),0,.999)*steps.size())])
	return {"goal":current.get("text","") if truth(current.get("text")) else "","step":step}
static func record(a: Dictionary,w: SimWorld) -> void:
	var day:=day_key(w.data.clock);var run: Dictionary=w.runtime[a.id]
	if not a.get("todayTrace") is Array or a.get("_traceDay","")!=day:
		a.todayTrace=[];a._traceDay=day;run.trace_key=""
	var text: String=activity_label(a)
	if a.activity not in ["sleeping","eating"]:
		var current:=plan(a,w.data.clock)
		if not current.is_empty(): text=str(current.goal)+("（"+str(current.step)+"）" if not str(current.step).is_empty() else "")
	var key:=text+"|"+str(a.currentLocation)
	if run.get("trace_key","")==key: return
	run.trace_key=key
	a.todayTrace.append({"m":int(w.data.clock.hour)*60+int(w.data.clock.minute),"text":text,"loc":a.currentLocation})
	a.todayTrace=a.todayTrace.slice(maxi(0,a.todayTrace.size()-160))

static func activity_label(a: Dictionary) -> String:
	var labels:={"sleeping":"睡覺","eating":"進食","working":"工作","socializing":"社交","wandering":"閒逛","recreation":"娛樂","idle":"閒置","stargazing":"看星星","night_mischief":"搞事","night_stroll":"夜間散步","exploring":"探險中","mourning":"弔念","commuting":"趕著去上工"}
	return labels.get(a.activity,a.activity)

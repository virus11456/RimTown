extends RefCounted
const KINDS := ["appointment","service","resident_care","care_recovery","leisure"]
static func kind(source: Dictionary) -> String:
	return str(source.get("kind","appointment"))
static func supported(source: Dictionary) -> bool:
	return kind(source) in KINDS and source.has("npc") and (source.has("resolved_tick") or source.has("facts"))
static func matches(row: Dictionary,source: Dictionary,fields: Array) -> bool:
	for field in fields:
		if not row.has(field) or not source.has(field) or row[field]!=source[field]: return false
	return true
static func resolve(w: SimWorld,id: String,source: Dictionary) -> Dictionary:
	if not supported(source) or str(source.get("npc",""))!=id: return {}
	var type:=kind(source);var choices: Array=[];var time_key:="resolved_tick"
	match type:
		"appointment": choices=w.quest_balance.get("appointments",{}).get("history",[])
		"service": choices=w.quest_balance.get("service_outcomes",[]);time_key="tick"
		"resident_care": choices=w.data.agents.get(id,{}).get("_careResults",[]);time_key="tick"
		"care_recovery": choices=w.data.agents.get(id,{}).get("_careRecoveryResults",[]);time_key="tick"
		"leisure": choices=SimLeisurePlan.history(w,id)
	var found: Array=[]
	for value in choices:
		if not value is Dictionary: continue
		var row: Dictionary=value
		if not row.has(time_key) or int(row[time_key])<0 or int(row[time_key])>int(w.data.tickCount): continue
		if type=="resident_care":
			if not source.has("facts") or not source.facts is Dictionary: continue
			var fact: Dictionary=source.facts
			if row.get("state","")!="completed" or not matches(row,fact,["tick","state","provider","job"]): continue
			if row.job not in ["doctor","priest"]: continue
			var valid:=true
			for milestone in ["home","work"]:
				if not fact.has(milestone): continue
				if not fact[milestone] is Dictionary or not row.get("followup",{}).get(milestone,{}) is Dictionary: valid=false;break
				var point: Dictionary=row.get("followup",{}).get(milestone,{})
				if not matches(point,fact[milestone],["tick","when","place"]) or int(point.get("tick",-1))<=int(row.tick) or int(point.get("tick",-1))>int(w.data.tickCount) or int(point.get("tick",-1))>int(row.get("followup",{}).get("until",-1)): valid=false
			if not valid: continue
		else:
			if int(row[time_key])!=int(source.get("resolved_tick",-1)) or str(row.get("state",""))!=str(source.get("state","")): continue
			match type:
				"appointment":
					if row.get("npc","")!=id or row.state not in ["met","missed","cancelled"] or str(row.get("time",""))!=str(source.get("time","")): continue
					if source.has("due") and int(row.get("due",-1))!=int(source.due): continue
				"service":
					if row.get("npc","")!=id or row.get("job","") not in ["doctor","priest"] or row.state not in ["completed","cancelled"] or not matches(row,source,["job","reason"]): continue
					var identity:=str(int(row.serial)) if row.has("serial") else "legacy:"+JSON.stringify([id,str(row.job),str(row.state),int(row.tick),str(row.get("reason","")),str(row.get("time","")),str(row.get("place","")),bool(row.get("stay",false))]).sha256_text()
					if identity!=str(source.get("identity","")): continue
				"care_recovery":
					if row.state not in ["recovered","time_limit","cancelled"] or not matches(row,source,["code","meal_ticks","rest_ticks"]): continue
				"leisure":
					if row.state not in ["completed","missed","cancelled"] or not matches(row,source,["day"]): continue
		found.append(row)
	# Older sources sometimes lack a unique identity: do not pick an arbitrary record.
	if found.size()!=1: return {}
	var row: Dictionary=found[0];var lines: Array=[]
	var title: String={"appointment":"見面約定紀錄","service":"玩家照護與談心服務","resident_care":"居民赴診紀錄","care_recovery":"返家恢復紀錄","leisure":"休閒行程紀錄"}[type]
	var status: String={"met":"已實際見面","missed":"未完成","cancelled":"已中止或取消","completed":"已完成","recovered":"已達恢復目標","time_limit":"恢復時間已用完"}.get(str(row.state),"未確認")
	lines.append("結果："+status)
	match type:
		"appointment":
			lines.append("原約定時間："+str(row.get("time","未保存")))
			lines.append("原約定場所："+str(w.data.townMap.locations.get(row.get("place",""),{}).get("name","場所已移除")))
		"service":
			lines.append("服務："+("疲憊照護" if row.job=="doctor" else "談心陪伴"))
			lines.append("結果時間："+str(row.get("time","未保存")))
			lines.append("當時服務場所："+str(row.get("place","未保存")))
		"resident_care":
			lines.append("照護者："+str(w.data.agents.get(str(row.provider),{}).get("name","原照護者已離開")))
			lines.append("這段回憶提到的後續到場：")
			var any:=false
			for milestone in ["home","work"]:
				if not source.facts.has(milestone): continue
				var point: Dictionary=row.followup[milestone]
				lines.append(("到家：" if milestone=="home" else "上工：")+str(point.when)+" · "+str(point.place));any=true
			if not any: lines.append("這段回憶沒有引用已確認的返家或上工紀錄。")
		"care_recovery": lines.append("實際在家用餐 %d 分鐘、休息 %d 分鐘（遊戲時間）。"%[int(row.meal_ticks)*15,int(row.rest_ticks)*15])
		"leisure":
			lines.append("行程日期："+str(row.get("day","未保存")))
			lines.append("原安排場所："+str(row.get("place_name","未保存")))
	if not str(row.get("reason","")).is_empty(): lines.append("結果說明："+str(row.reason).left(300))
	return {"title":title,"lines":lines}

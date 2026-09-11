class_name SimGovernance
extends RefCounted
static func mayor(w: SimWorld) -> String:
	for a in w.data.agents.values():
		if a.get("jobKey")=="mayor" and not a.get("isDead",false): return str(a.id)
	return ""
static func direct(w: SimWorld) -> bool:
	return not w.governance_enabled or mayor(w)=="player"
static func book(w: SimWorld) -> Dictionary:
	if not w.quest_balance.has("governance"): w.quest_balance.governance={"proposals":[],"serial":0}
	return w.quest_balance.governance
static func fingerprint(action: String,args: Array,costs: Dictionary) -> String:
	return JSON.stringify([action,args,costs],"",true).sha256_text()
static func permit(w: SimWorld,action: String,args: Array,costs: Dictionary) -> bool:
	for amount in costs.values():
		if not (amount is float or amount is int) or not is_finite(float(amount)) or float(amount)<0: w.governance_notice="無效公共支出。";return false
	if direct(w): return true
	var b:=book(w);var signature:=fingerprint(action,args,costs);var day:=SimClock.total_days(w.data.clock)
	for p in b.proposals:
		if p.signature!=signature: continue
		if p.status=="approved" and p.approver==mayor(w) and int(p.expires)>=day: return true
		if p.status=="pending" or (p.status=="rejected" and int(p.reviewed)==day):
			w.governance_notice="提案待鎮長審核。" if p.status=="pending" else str(p.reason);return false
	if b.proposals.filter(func(p): return p.status in ["pending","approved"]).size()>=3:
		w.governance_notice="最多保留三件待處理提案，請先執行或撤回。";return false
	b.serial+=1
	b.proposals.append({"id":b.serial,"signature":signature,"action":action,"args":args.duplicate(true),"costs":costs.duplicate(true),"status":"pending","submitted":day,"reason":"等待現任鎮長審核。","approver":"","expires":-1,"reviewed":-1})
	if b.proposals.size()>50:
		for i in b.proposals.size():
			if b.proposals[i].status not in ["pending","approved"]: b.proposals.remove_at(i);break
	w.governance_notice="已提出建議，尚未扣款；鎮長每天審核一案。";return false
static func complete(w: SimWorld,action: String,args: Array,costs: Dictionary,success: bool) -> void:
	if not success or direct(w): return
	var signature:=fingerprint(action,args,costs)
	for p in book(w).proposals:
		if p.signature==signature and p.status=="approved": p.status="executed";p.reason="已依核准位置補選址，未重複扣料或施工。" if action=="building_site" else "依核准內容執行，公共帳本已記錄。";return
static func cancel(w: SimWorld,id: int) -> void:
	for p in book(w).proposals:
		if int(p.id)==id and p.status in ["pending","approved"]: p.status="cancelled";p.reason="旅人撤回。";return
static func daily(w: SimWorld) -> void:
	if not w.governance_enabled: return
	var b:=book(w);var day:=SimClock.total_days(w.data.clock)
	if int(b.get("review_day",-1))==day: return
	b.review_day=day
	for p in b.proposals:
		if p.status=="approved" and (int(p.expires)<day or p.approver!=mayor(w)):
			p.status="expired";p.reason="核准期限已過或鎮長更替，請重新提案。"
	for p in b.proposals:
		if p.status!="pending": continue
		if mayor(w).is_empty(): p.reason="目前沒有鎮長，暫緩審核。";return
		var reason:="";var population: int=w.data.agents.size()
		var essential: bool=(p.action=="career_materials" and p.args[0]=="cook") or (p.action=="career_trade" and not p.args[1].isBuying and p.args[1].resource in ["food","meals"]) or p.action=="plant" or (p.action=="building" and p.args[0] in ["granary","farm_irrigation"]) or (p.action=="industry" and p.args[0]=="farming") or (p.action=="trade" and not p.args[1].isBuying and p.args[1].resource in ["food","meals"])
		if not essential and SimEconomy.amount(w,"food")+SimEconomy.amount(w,"meals")-float(p.costs.get("food",0))-float(p.costs.get("meals",0))<population*2: reason="鎮上食物不足，先改善糧食供應。"
		for key in p.costs:
			var reserve:=0.0
			for other in b.proposals:
				if other.status=="approved": reserve+=float(other.costs.get(key,0))
			if SimEconomy.amount(w,key)-reserve<float(p.costs[key])+(20 if key=="silver" and not essential else 0): reason="公共預算不足或已有核准用途，暫不支用。"
		p.reviewed=day;p.approver=mayor(w)
		p.status="approved" if reason.is_empty() else "rejected";p.reason="核准此用途，三天內執行；執行時仍需材料足夠。" if reason.is_empty() else reason;p.expires=day+3
		SimFeuds._memory(w.data.agents[p.approver],w,"governance","我審核了旅人的"+describe(w,p)+"提案："+str(p.reason),6,[w.data.agents.player.name])
		SimSocial.log_message(w.data,"governance","鎮長審核提案 #"+str(p.id)+"："+str(p.reason),w.data.agents[p.approver].name,"");return
static func execute(w: SimWorld,id: int) -> bool:
	for p in book(w).proposals:
		if int(p.id)!=id or p.status!="approved": continue
		if p.approver!=mayor(w) or int(p.expires)<SimClock.total_days(w.data.clock): return false
		var a: Array=p.args
		match p.action:
			"career_trade":
				w.governance_notice="交易已核准，請回職業頁並到交易站完成交接；不在此遠端成交。";return false
			"career_materials":
				w.governance_notice="材料用途已核准。請回職業與值勤頁，親自到場開始工作；完成才扣料。";return false
			"decoration": return SimCombos.place(w,a[0],Vector2i(int(a[1]),int(a[2])))
			"remove_decoration":
				for item in w.data.get("decorations",[]):
					if item==a[0]: return SimCombos.remove(w,item)
			"work_policy": return SimEconomy.set_policy(w,a[0],a[1])
			"research": return SimResearch.start(w,a[0])
			"recipe": return SimProcessing.set_recipe(w,a[0],a[1])
			"staff": return SimProcessing.assign(w,a[0],a[1])
			"remove_staff": return SimProcessing.remove_worker(w,a[0])
			"transfer": return SimProcessing.transfer(w,a[0],a[1],float(a[2]),a[3])
			"order": return SimProcessing.fulfill(w,a[0])
			"building_site": return SimBuildings.place_completed(w,str(a[0]),Vector2i(int(a[1]),int(a[2])))
			"building": return not SimBuildings.start(w,a[0],a[1],Vector2i(int(a[2]),int(a[3]))).is_empty()
			"industry": return SimIndustry.choose(w,a[0])
			"industry_upgrade": return SimIndustry.upgrade(w,a[0])
			"factory": return SimProcessing.build(w,a[0])
			"plant": return SimFarm.plant(w,int(a[0]),a[1])
			"fertilize": return SimFarm.fertilize(w,int(a[0]))
			"trade":
				var m: Variant=w.data.trade.get("merchant")
				if not m is Dictionary or m.name!=a[0]: return false
				for i in m.offers.size():
					if m.offers[i]==a[1]: return SimTrade.execute(w,i,float(a[2]),m.offers[i]).get("ok",false)
	return false

static func gift_remaining(w: SimWorld) -> int:
	var b:=book(w)
	if int(b.get("gift_day",-1))!=SimClock.total_days(w.data.clock): return 2
	return maxi(0,2-int(b.get("gift_count",0)))
static func record_gift(w: SimWorld) -> void:
	var b:=book(w);var day:=SimClock.total_days(w.data.clock)
	if int(b.get("gift_day",-1))!=day: b.gift_day=day;b.gift_count=0
	b.gift_count=int(b.get("gift_count",0))+1

static func describe(w: SimWorld,p: Dictionary) -> String:
	var a: Array=p.args
	match p.action:
		"career_materials": return str(SimCareers.JOBS.get(a[0],{}).get("name",a[0]))+" · 單次值勤材料（完成才扣料）"
		"building_site":
			var matches: Array=w.data.buildings.completed.filter(func(item): return str(item.get("id",""))==str(a[0]))
			var name: String=str(matches[0].get("name","已完工工程")) if matches.size()==1 else "已完工工程"
			return name+" · 補選址 (%d, %d)，不重複扣料"%[int(a[1]),int(a[2])]
		"building": return str(SimBuildings.rules().templates.get(a[0],{}).get("name",a[0]))+("升級" if a[1] else " · 選址 (%d, %d)"%[a[2],a[3]])
		"industry","industry_upgrade": return str(SimIndustry.rules().industries.get(a[0],{}).get("name",a[0]))
		"factory": return str(SimProcessing.rules().get(a[0],{}).get("name",a[0]))
		"trade","career_trade": return str(a[0])+" · "+("賣出 " if a[1].isBuying else "買入 ")+str(a[1].resource)+" × "+str(a[2])+" · 單價 "+str(a[1].price)
		"plant": return "農地 %d · %s"%[a[0],SimFarm.rules().crops.get(a[1],{}).get("name",a[1])]
	return "、".join(a.map(func(value): return str(value)))

class_name SimEconomy
extends RefCounted
static func amount(w: SimWorld,key: String) -> float:
	return float(w.data.stockpile.resources.get(key,0))
static func change(w: SimWorld,key: String,value: float,reason: String,source: String="") -> void:
	w.data.stockpile.resources[key]=amount(w,key)+value
	var history: Array=w.data.stockpile.get("history",[])
	history.append({"tick":w.data.tickCount,"resource":key,"amount":value,"reason":reason,"source":source})
	w.data.stockpile.history=history.slice(maxi(0,history.size()-10000))
static func consume(w: SimWorld,key: String,value: float,reason: String,source: String="") -> bool:
	if amount(w,key)<value: return false
	change(w,key,-value,reason,source);return true
static func log_event(w: SimWorld,text: String,agent: String="") -> void:
	SimSocial.log_message(w.data,"economy",text,agent,"")
static func daily(w: SimWorld) -> void:
	var rules: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/economy_rules.json"))
	for key in rules.raw:
		var gap:=40-amount(w,key)
		if gap>0: change(w,key,gap,"原料自動補給")
	if not w.data.get("workPolicy") is Dictionary: w.data.workPolicy={}
	var industry_jobs: Array=[]
	for key in w.data.get("industry",{}).get("industries",{}):
		if rules.industryJobs.has(key): industry_jobs.append(rules.industryJobs[key])
	var news: Dictionary=w.data.get("news",{}).get("activeModifiers",{})
	var weather: Dictionary=w.data.get("weather",{})
	var disaster: Dictionary=weather.get("activeDisaster",{}) if weather.get("activeDisaster") is Dictionary else {}
	var farm_weather: float=float(rules.weather.get(weather.get("current",""),0))+float(disaster.get("effects",{}).get("farm",0))
	for a in w.data.agents.values():
		var key: String=str(a.get("jobKey","") if a.get("jobKey")!=null else "")
		if a.get("isPlayer",false) or not rules.recipes.has(key): continue
		var recipe: Dictionary=rules.recipes[key]
		var policy: String=w.data.workPolicy.get(rules.craft.get(key,""),"normal")
		if policy=="off":
			SimFeuds._mood(a,w,4);SimFeuds._memory(a,w,"daily","今天工坊休工，難得清閒，多了些時間陪伴身邊的人。",3,[]);continue
		var level:=SimWorld.skill_level(float(a.get("skills",{}).get(recipe.skill,{}).get("xp",0))) if a.get("skills",{}).has(recipe.skill) else 0
		var eff:=0.5+(float(level)/20)*2.0
		if key in industry_jobs: eff*=.5
		if policy=="extra":
			if consume(w,"silver",8,a.name+"的加班津貼"):
				eff*=1.5;SimFeuds._mood(a,w,-3)
				if w.rng.next_float()<.3: SimFeuds._memory(a,w,"daily","連日加班，身體有點吃不消，但訂單堆著總得有人做。",4,[])
			else: log_event(w,"銀庫不足，付不出"+a.name+"的加班津貼，今日照常排班。")
		if key=="farmer": eff*=float(rules.seasons.get(w.data.clock.season,1));eff*=1+float(news.get("farm_bonus",0))+farm_weather
		if key=="miner": eff*=1+float(news.get("mining_bonus",0))
		eff*=1+(float(a.mood)-50)/500
		eff*=.9+w.rng.next_float()*.2
		var can_produce:=true
		for resource in recipe.inputs:
			if amount(w,resource)<float(recipe.inputs[resource]): can_produce=false;break
		if not can_produce: eff*=.4;log_event(w,a.name+"材料短缺，用邊角料將就趕工。",a.name)
		else:
			for resource in recipe.inputs: consume(w,resource,float(recipe.inputs[resource]),a.name+"的生產",a.name)
		for resource in recipe.outputs: change(w,resource,floorf(float(recipe.outputs[resource])*eff*10+.5)/10,a.name+"（"+str(w.rules.jobs.get(key,{}).get("title","居民"))+"）",a.name)
		if key=="priest":
			for other in w.data.agents.values():
				if other.id!=a.id: SimFeuds._mood(other,w,1)
	var count: int=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false)).size()
	var needed:=1.5*count;var meals:=amount(w,"meals")
	if meals>=needed: consume(w,"meals",needed,"daily consumption")
	else:
		if meals>0: consume(w,"meals",meals,"daily consumption")
		if consume(w,"food",(needed-meals)*2,"緊急食物"): log_event(w,"餐食不夠！居民正在吃生食。")
		else:
			log_event(w,"糧食短缺！居民正在挨餓！")
			for a in w.data.agents.values(): SimFeuds._mood(a,w,-10);a.needs.hunger=maxf(0,a.needs.hunger-20)
	for loc in rules.nature:
		if w.data.get("townMap",{}).get("locations",{}).has(loc):
			for resource in rules.nature[loc]: change(w,resource,float(rules.nature[loc][resource])*.5,"natural ("+loc+")")
	consume(w,"tools",count*.05,"tool wear")
	consume(w,"clothing",count*(.06 if w.data.clock.season=="冬季" else .03),"clothing wear")
	var downcast: Array=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false) and a.mood<30).slice(0,3)
	for a in downcast:
		if consume(w,"medicine",1,a.name+"的診療"): SimFeuds._mood(a,w,6);SimFeuds._memory(a,w,"daily","去找醫生拿了藥，人舒服多了。",3,[])
	if w.data.clock.season=="冬季" and not consume(w,"wood",count*.3,"冬季取暖"):
		log_event(w,"木材不夠取暖！")
		for a in w.data.agents.values(): SimFeuds._mood(a,w,-8);a.needs.comfort=maxf(0,a.needs.comfort-15)
	var wasted:=floorf((amount(w,"meals")-ceilf(count*4.5))*.08)
	if wasted>0: consume(w,"meals",wasted,"餐食放到過期");log_event(w,str(int(wasted))+"份餐食放到過期倒掉了——考慮讓廚房排休。")
	var effects: Dictionary=w.data.get("buildings",{}).get("activeEffects",{})
	var spoiled:=floorf((amount(w,"food")-400-float(effects.get("food_capacity",0)))*.05*maxf(0,1+float(effects.get("food_decay",0))))
	if spoiled>0: consume(w,"food",spoiled,"存糧過多腐壞");log_event(w,"糧倉滿了，"+str(int(spoiled))+"份食物腐壞——可辦慶典或賣給商人消化存糧。")
static func set_policy(w: SimWorld,good: String,mode: String) -> bool:
	if good not in ["meals","tools","clothing","medicine","furniture"] or mode not in ["off","normal","extra"]: return false
	if not w.data.get("workPolicy") is Dictionary: w.data.workPolicy={}
	w.data.workPolicy[good]=mode
	var label: String={"off":"休工","normal":"正常排班","extra":"加班"}[mode]
	log_event(w,SimGossip._title(w.data)+"下令："+label+"（明日生效）")
	return true

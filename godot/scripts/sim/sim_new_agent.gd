class_name SimNewAgent
extends RefCounted
static var cached: Dictionary={}
static func rules() -> Dictionary:
	if cached.is_empty(): cached=JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/population_rules.json"))
	return cached
static func shuffle(values: Array,w: SimWorld) -> Array:
	var result:=values.duplicate()
	for i in range(result.size()-1,0,-1):
		var j:=w.rng.next_int(0,i);var value: Variant=result[i];result[i]=result[j];result[j]=value
	return result
static func skills(w: SimWorld,job: String,age: int,traits: Array) -> Dictionary:
	var result: Dictionary={}
	for key in rules().skills: result[key]={"xp":0,"passion":"無"}
	var cats:=shuffle(rules().skills,w)
	var counts: Array=[1 if w.rng.next_float()<.15 else 0,w.rng.next_int(0,2),w.rng.next_int(1,3),1 if w.rng.next_float()<.25 else 0]
	var index:=0
	for i in 4:
		for n in int(counts[i]):
			if index<cats.size(): result[cats[index]].passion=["狂熱","大","微","無能"][i];index+=1
	for key in traits:
		var category: String={"kind":"社交","charismatic":"社交","creative":"藝術","hardworking":"建造","romantic":"藝術","gossip":"社交"}.get(key,"")
		if category.is_empty(): continue
		if result[category].passion=="無": result[category].passion="微"
		elif result[category].passion=="微": result[category].passion="大"
	var pool:=maxi(0,age-16)*w.rng.next_int(30,60)
	var capable: Array=result.keys().filter(func(key): return result[key].passion!="無能")
	var weights: Array=capable.map(func(key): return {"無":1,"微":2,"大":3.5,"狂熱":5}[result[key].passion])
	while pool>0 and not capable.is_empty():
		var key: String=w.rng.weighted(capable,weights);var chunk:=mini(pool,w.rng.next_int(10,50));result[key].xp+=chunk;pool-=chunk
	var mapping: Dictionary=rules().jobSkills.get(job,{})
	for key in mapping.get("primary",[]):
		if result[key].passion!="無能":
			result[key].xp+=w.rng.next_int(200,600)
			if result[key].passion=="無": result[key].passion="微"
	for key in mapping.get("secondary",[]):
		if result[key].passion!="無能": result[key].xp+=w.rng.next_int(50,250)
	for key in mapping.get("primary",[]):
		if result[key].passion=="無能": result[key].passion="微"
	return result
static func attributes(w: SimWorld,traits: Array,job: String) -> Dictionary:
	var a:={"charm":3+w.rng.next_int(0,4),"vigor":3+w.rng.next_int(0,4),"wit":3+w.rng.next_int(0,4),"grit":3+w.rng.next_int(0,4)}
	if "charismatic" in traits: a.charm+=w.rng.next_int(1,3)
	if "romantic" in traits: a.charm+=1
	if "shy" in traits: a.charm-=1
	if "hardworking" in traits: a.vigor+=w.rng.next_int(1,2)
	if "lazy" in traits: a.vigor-=1
	if "glutton" in traits: a.vigor+=1
	if "creative" in traits or "perfectionist" in traits: a.wit+=w.rng.next_int(1,2)
	if "night_owl" in traits: a.wit+=1
	if "stoic" in traits or "optimist" in traits: a.grit+=w.rng.next_int(1,2)
	if "neurotic" in traits or "pessimist" in traits: a.grit-=1
	if job=="guard": a.grit+=2;a.vigor+=1
	elif job in ["researcher","doctor"]: a.wit+=2
	elif job in ["trader","priest"]: a.charm+=1
	elif job in ["miner","farmer","blacksmith","carpenter"]: a.vigor+=1
	elif job in ["tailor","cook"]: a.wit+=1
	for key in a: a[key]=clampi(int(a[key]),1,10)
	return a
static func create(w: SimWorld,id: String,name: String,age: int,gender: String,traits: Array,values: Array,background: String,home: String,job: String="") -> Dictionary:
	if w.data.agents.has(id): return {}
	var mood:=50.0
	for key in traits: mood+=float(w.rules.traits.get(key,{}).get("mood_base",0))
	var a:={"id":id,"name":name,"age":age,"gender":gender,"isPlayer":false,"_isPlayerChild":false,"_parentNames":null,"jobKey":null if job.is_empty() else job,"homeLocation":home,"currentLocation":home,"mood":mood,"activity":"idle","currentThought":"","personality":{"traits":traits.duplicate(),"values":values.duplicate(),"background":background},"needs":{"hunger":70,"rest":80,"social":60,"comfort":60,"recreation":50,"beauty":50},"skills":skills(w,job,age,traits),"relationships":{},"memory":[],"_lastInteractionTick":0,"_locationStayRemaining":0,"_mourningTargets":[],"_annualMourning":[],"thoughts":[],"attributes":attributes(w,traits,job),"dailyPlan":null}
	w.data.agents[id]=a;w.runtime[id]={"targetLocation":null,"moodModifier":0.0};return a

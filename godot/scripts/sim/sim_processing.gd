class_name SimProcessing
extends RefCounted
static func rules() -> Dictionary:
	return JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/processing_rules.json"))
static func log_event(w: SimWorld,kind: String,text: String) -> void:
	SimSocial.log_message(w.data,kind,text,"","")
static func build(w: SimWorld,key: String) -> bool:
	var def: Dictionary=rules().get(key,{})
	if def.is_empty() or w.data.processing.builtFactories.has(key) or not SimBuildings.affordable(w,def.cost): return false
	for r in def.cost: SimEconomy.consume(w,r,float(def.cost[r]),"建造"+str(def.name))
	w.data.processing.builtFactories[key]={"key":key,"status":"building","buildProgress":0,"buildRequired":def.buildDays,"recipe":null,"productionProgress":0,"workers":[],"warehouse":{}}
	log_event(w,"factory",str(def.icon)+" 開始建造"+str(def.name)+"！");return true
static func set_recipe(w: SimWorld,key: String,recipe_id: String) -> bool:
	var factory: Dictionary=w.data.processing.builtFactories.get(key,{})
	if factory.get("status")!="active": return false
	for recipe in rules().get(key,{}).get("recipes",[]):
		if recipe.id==recipe_id: factory.recipe=recipe_id;factory.productionProgress=0;return true
	return false
static func assign(w: SimWorld,key: String,id: String) -> bool:
	var factory: Dictionary=w.data.processing.builtFactories.get(key,{})
	if factory.get("status")!="active" or not w.data.agents.has(id): return false
	if factory.workers.size()>=int(rules()[key].workerSlots) or id in factory.workers: return false
	remove_worker(w,id);factory.workers.append(id);return true
static func remove_worker(w: SimWorld,id: String) -> void:
	for f in w.data.processing.builtFactories.values(): f.workers=f.workers.filter(func(worker): return worker!=id)
static func transfer(w: SimWorld,key: String,resource: String,amount: float,sell: bool=false) -> bool:
	var f: Dictionary=w.data.processing.builtFactories.get(key,{})
	if f.is_empty() or not is_finite(amount) or amount<=0: return false
	var take:=minf(amount,float(f.warehouse.get(resource,0)))
	if take<=0: return false
	var def: Dictionary=rules().get(key,{})
	if def.is_empty(): return false
	f.warehouse[resource]-=take
	if float(f.warehouse[resource])<=0: f.warehouse.erase(resource)
	if not sell: SimEconomy.change(w,resource,take,str(def.name)+"出貨");return true
	var price:=5.0
	for recipe in def.recipes:
		if recipe.output.has(resource): price=float(recipe.outputPrice);break
	var silver:=floorf(take*price+.5)
	SimEconomy.change(w,"silver",silver,"賣出"+resource,def.name)
	log_event(w,"factory",str(def.icon)+" 賣出 "+(str(int(take)) if take==floorf(take) else str(take))+" "+resource+"，獲得 "+str(int(silver))+" 銀幣");return true
static func fulfill(w: SimWorld,id: String) -> bool:
	for order in w.data.processing.orders:
		if order.id!=id or order.status!="active": continue
		var f: Dictionary=w.data.processing.builtFactories.get(order.factoryKey,{})
		if f.is_empty() or float(f.warehouse.get(order.product,0))<float(order.amount): return false
		f.warehouse[order.product]-=order.amount
		SimEconomy.change(w,"silver",float(order.reward),"訂單完成："+str(order.product));order.status="completed"
		log_event(w,"order","✅ 訂單完成！獲得 "+str(int(order.reward))+" 銀幣");return true
	return false
static func can_work(a: Dictionary) -> bool:
	var status: Variant=a.get("status")
	return status==null or (status is String and status in ["","normal"]) or (status is bool and not status) or ((status is int or status is float) and status==0)
static func auto_staff(w: SimWorld,defs: Dictionary) -> void:
	var factories: Dictionary=w.data.processing.builtFactories;var taken: Array=[]
	for f in factories.values(): taken.append_array(f.get("workers",[]))
	for key in factories:
		var f: Dictionary=factories[key];var def: Dictionary=defs.get(key,{})
		if f.status!="active" or def.is_empty(): continue
		f.workers=f.get("workers",[]).filter(func(id): return w.data.agents.has(id))
		while f.workers.size()<int(def.workerSlots):
			var pick: Dictionary={};var best:=INF
			for a in w.data.agents.values():
				if a.get("isPlayer",false) or a.get("isDead",false) or SimPlayerChat.job(w,a).get("key")=="mayor" or a.id in taken: continue
				var mood:=float(a.get("mood",50))
				if mood==0: mood=50
				var score:=(-100.0 if SimPlayerChat.job(w,a).get("key")==def.preferredJob else 0.0)-mood/100
				if score<best: best=score;pick=a
			if pick.is_empty(): break
			f.workers.append(pick.id);taken.append(pick.id)
			log_event(w,"factory",str(pick.name)+"主動到"+str(def.name)+"上工了。")
			SimFeuds._memory(pick,w,"daily","我開始在"+str(def.name)+"幫忙了，多一份收入也多認識些人。",4,[])
		if f.get("recipe")==null or str(f.recipe).is_empty(): f.recipe=def.recipes[0].id
static func daily(w: SimWorld) -> void:
	var defs:=rules();var manager: Dictionary=w.data.processing;auto_staff(w,defs)
	for key in manager.builtFactories:
		var f: Dictionary=manager.builtFactories[key];var def: Dictionary=defs.get(key,{})
		if def.is_empty(): continue
		if f.status=="building":
			var builders:=0
			for a in w.data.agents.values():
				if not a.get("isPlayer",false) and SimPlayerChat.job(w,a).get("key") in ["carpenter","miner","blacksmith"]: builders+=1
			f.buildProgress+=1+floorf(builders*.3)
			if float(f.buildProgress)>=float(f.buildRequired): f.status="active";log_event(w,"factory",str(def.icon)+" "+str(def.name)+"建造完成！")
			continue
		if f.status!="active" or f.get("recipe")==null: continue
		var recipe: Dictionary={}
		for item in def.recipes:
			if item.id==f.recipe: recipe=item;break
		if recipe.is_empty(): continue
		var workers: Array=f.workers.filter(func(id): return w.data.agents.has(id) and can_work(w.data.agents[id]))
		if workers.is_empty(): continue
		var efficiency:=float(workers.size())/float(def.workerSlots)
		for id in workers:
			var a: Dictionary=w.data.agents[id]
			if SimPlayerChat.job(w,a).get("key")==def.preferredJob: efficiency+=.1
			if float(a.mood)>50: efficiency+=.05
		if not SimBuildings.affordable(w,recipe.input): continue
		f.productionProgress+=efficiency
		if float(f.productionProgress)>=float(recipe.time):
			for r in recipe.input: SimEconomy.consume(w,r,float(recipe.input[r]),str(def.name)+"生產")
			var outputs: Array=[]
			for r in recipe.output:
				f.warehouse[r]=float(f.warehouse.get(r,0))+float(recipe.output[r]);outputs.append(str(int(recipe.output[r]))+" "+r)
			f.productionProgress-=recipe.time
			manager.recentOutput.append({"factory":key,"recipe":recipe.id,"output":recipe.output.duplicate(),"day":w.data.clock.day})
			manager.recentOutput=manager.recentOutput.slice(maxi(0,manager.recentOutput.size()-50))
			SimIndustry.news(w,"factory",str(def.name)+"產出了 "+", ".join(outputs),3)
	generate_orders(w,defs)
	for order in manager.orders:
		if order.status!="active": continue
		order.daysLeft-=1
		if float(order.daysLeft)<=0: order.status="expired";log_event(w,"order","❌ 訂單過期："+str(order.description))
	var done: Array=manager.orders.filter(func(o): return o.status!="active")
	manager.orders=manager.orders.filter(func(o): return o.status=="active")+done.slice(maxi(0,done.size()-20))
	if w.data.buildings.completed.any(func(b): return b.get("name")=="市集"):
		for key in manager.builtFactories:
			var f: Dictionary=manager.builtFactories[key]
			if f.status!="active": continue
			for r in f.warehouse.keys():
				if float(f.warehouse[r])>=3: transfer(w,key,r,2,true)
static func generate_orders(w: SimWorld,defs: Dictionary) -> void:
	var manager: Dictionary=w.data.processing
	if manager.orders.filter(func(o): return o.status=="active").size()>=3: return
	if w.rng.next_float()>.1: return
	var keys: Array=manager.builtFactories.keys().filter(func(k): return manager.builtFactories[k].status=="active")
	if keys.is_empty(): return
	var key: String=w.rng.pick(keys);var recipe: Dictionary=w.rng.pick(defs[key].recipes)
	var product: String=recipe.output.keys()[0];var amount:=w.rng.next_int(5,20);var multiplier:=1.5+w.rng.next_float()
	manager._orderCounter+=1
	manager.orders.append({"id":"order_"+str(int(manager._orderCounter)),"product":product,"amount":amount,"reward":floorf(float(recipe.outputPrice)*amount*multiplier+.5),"daysLeft":w.rng.next_int(3,7),"factoryKey":key,"description":"需要 "+str(amount)+" 個"+product,"status":"active"})
	log_event(w,"order","📋 新訂單：需要 "+str(amount)+" 個"+product+"！（"+str(int(floorf(multiplier*100+.5)))+"% 價格）")

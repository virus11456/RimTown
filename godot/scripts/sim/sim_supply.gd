class_name SimSupply
extends RefCounted
# Godot balance rules, separate from the original simulation compatibility mode.
static func total(w: SimWorld,resource: String) -> float:
	var amount:=SimEconomy.amount(w,resource)
	for f in w.data.processing.builtFactories.values(): amount+=float(f.warehouse.get(resource,0))
	return amount
static func target(w: SimWorld,resource: String,batch: float) -> float:
	var reserve:=maxf(batch*3,float(material_floor().get(resource,0)))
	for key in w.data.processing.builtFactories:
		var f: Dictionary=w.data.processing.builtFactories[key]
		if f.status!="active": continue
		for recipe in SimProcessing.rules().get(key,{}).get("recipes",[]):
			if recipe.id==f.recipe: reserve+=float(recipe.input.get(resource,0))*3
	for order in w.data.processing.orders:
		if order.status=="active" and order.product==resource: reserve+=float(order.amount)
	return reserve
static func blocked(w: SimWorld,recipe: Dictionary) -> bool:
	if not w.supply_enabled: return false
	for r in recipe.output:
		if total(w,r)+float(recipe.output[r])>target(w,r,float(recipe.output[r]))+.000001: return true
	return false
static func remaining(w: SimWorld,resource: String) -> float:
	if not w.supply_enabled: return INF
	var day:=SimClock.total_days(w.data.clock)
	var sales: Dictionary=w.supply_state.get("sales",{}) if int(w.supply_state.get("day",-1))==day else {}
	return maxf(0,4-float(sales.get(resource,0)))
static func record_sale(w: SimWorld,resource: String,amount: float) -> void:
	if not w.supply_enabled: return
	var day:=SimClock.total_days(w.data.clock)
	if int(w.supply_state.get("day",-1))!=day: w.supply_state={"day":day,"sales":{}}
	w.supply_state.sales[resource]=float(w.supply_state.sales.get(resource,0))+amount

static var _material_floor: Dictionary={}
static func material_floor() -> Dictionary:
	if not _material_floor.is_empty(): return _material_floor
	# Keep enough material for any individual future building/industry/factory purchase.
	_collect_costs(SimBuildings.rules())
	_collect_costs(SimIndustry.rules())
	_collect_costs(SimProcessing.rules())
	return _material_floor
static func _collect_costs(value: Variant) -> void:
	if value is Dictionary:
		for key in value:
			if key in ["cost","costs"] and value[key] is Dictionary:
				for r in value[key]:
					if value[key][r] is float or value[key][r] is int: _material_floor[r]=maxf(float(_material_floor.get(r,0)),ceilf(float(value[key][r])*1.25))
			else: _collect_costs(value[key])
	elif value is Array:
		for item in value: _collect_costs(item)
static func reserve(w: SimWorld,resource: String) -> float:
	if resource=="silver": return INF
	var population: int=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false) and not a.get("isDead",false)).size()
	var base:=60.0
	match resource:
		"meals": base=maxf(15,population*4.5)
		"food": base=maxf(80,population*6)
		"wood","stone","metal": base=200
		"tools","clothing","medicine": base=maxf(20,population*2)
		"research_points": base=100
	base=maxf(base,float(material_floor().get(resource,0)))
	# Three batches of each currently selected downstream recipe, including food chains.
	for key in w.data.processing.builtFactories:
		var f: Dictionary=w.data.processing.builtFactories[key]
		if f.status!="active": continue
		for recipe in SimProcessing.rules().get(key,{}).get("recipes",[]):
			if recipe.id==f.recipe: base+=float(recipe.input.get(resource,0))*3
	return base
static func room(w: SimWorld,resource: String) -> float:
	if not w.supply_enabled: return INF
	return maxf(0,reserve(w,resource)-total(w,resource))
static func produce(w: SimWorld,resource: String,amount: float,reason: String,source: String="") -> float:
	if not w.supply_enabled:
		SimEconomy.change(w,resource,amount,reason,source);return amount
	var accepted:=minf(maxf(0,amount),room(w,resource))
	if accepted>0: SimEconomy.change(w,resource,accepted,reason,source)
	return accepted
static func crop_space(w: SimWorld,key: String) -> bool:
	if not w.supply_enabled: return true
	var crop: Dictionary=SimFarm.rules().crops.get(key,{})
	if crop.is_empty(): return false
	var committed:=total(w,key)
	# Reserve the maximum quality harvest, so many plots cannot bypass sowing limits.
	for p in w.data.farm.plots:
		if p.crop==key and p.state in ["growing","ready"]: committed+=ceilf(float(crop.yield)*2.5)
	return committed+ceilf(float(crop.yield)*2.5)<=maxf(reserve(w,key),float(crop.yield)*2.5)

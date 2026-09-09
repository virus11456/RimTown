class_name SimSupply
extends RefCounted
# Godot balance rules, separate from the original simulation compatibility mode.
static func total(w: SimWorld,resource: String) -> float:
	var amount:=SimEconomy.amount(w,resource)
	for f in w.data.processing.builtFactories.values(): amount+=float(f.warehouse.get(resource,0))
	return amount
static func target(w: SimWorld,resource: String,batch: float) -> float:
	var reserve:=batch*3
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

class_name SimCareerTrade
extends RefCounted
static func remaining(w: SimWorld) -> float:
	return maxf(0,4-float(SimCareers.book(w).get("traded",0)))
static func quantity(w: SimWorld,offer: Dictionary) -> float:
	if not is_finite(float(offer.price)) or float(offer.price)<=0 or not is_finite(float(offer.amount)): return 0
	var resource: String=offer.resource
	if resource=="silver": return 0
	var reserve:=SimSupply.reserve(w,resource)
	var gap: float=reserve*.5-SimSupply.total(w,resource)
	if offer.isBuying:
		var floor_stock:=reserve*.75
		if resource in ["food","meals"]: floor_stock=maxf(floor_stock,w.data.agents.size()*2)
		gap=minf(SimEconomy.amount(w,resource)-floor_stock,SimSupply.remaining(w,resource))
	return floorf(maxf(0,minf(remaining(w),minf(float(offer.amount),gap))))
static func tasks(w: SimWorld) -> Array:
	var m: Variant=w.data.trade.get("merchant");var result: Array=[]
	if not m is Dictionary or not w.data.townMap.locations.has("general_store"): return result
	for i in m.offers.size():
		var offer: Dictionary=m.offers[i];var qty:=quantity(w,offer)
		if qty<1: continue
		var args: Array=[m.name,offer.duplicate(true),qty]
		var costs: Dictionary={str(offer.resource):qty} if offer.isBuying else {"silver":qty*float(offer.price)}
		var id:=SimGovernance.fingerprint("career_trade",args,costs)
		result.append({"id":id,"target":id,"location":"general_store","job":"trader","label":("餘貨交售" if offer.isBuying else "補給採購")+" · 報價 #"+str(i+1),"args":args,"costs":costs,"resource":offer.resource,"qty":qty,"total":qty*float(offer.price)})
	return result
static func approved(w: SimWorld,t: Dictionary) -> bool:
	if SimGovernance.direct(w): return true
	for p in SimGovernance.book(w).proposals:
		if p.signature==t.id and p.status=="approved" and p.approver==SimGovernance.mayor(w) and int(p.expires)>=SimClock.total_days(w.data.clock): return true
	return false
static func request(w: SimWorld,id: String) -> bool:
	if w.data.agents.player.jobKey!="trader": return false
	for t in tasks(w):
		if t.id==id: return SimGovernance.permit(w,"career_trade",t.args,t.costs)
	return false
static func settle(w: SimWorld,t: Dictionary) -> bool:
	if not approved(w,t) or not SimBuildings.affordable(w,t.costs): return false
	var m: Variant=w.data.trade.get("merchant")
	if not m is Dictionary or m.name!=t.args[0]: return false
	for i in m.offers.size():
		var offer: Dictionary=m.offers[i]
		if offer!=t.args[1] or quantity(w,offer)<float(t.qty): continue
		if not SimTrade._execute(w,i,float(t.qty),offer).get("ok",false): return false
		SimGovernance.complete(w,"career_trade",t.args,t.costs,true)
		if t.args[1].isBuying: SimSupply.record_sale(w,t.resource,float(t.qty))
		var b:=SimCareers.book(w);b.traded=float(b.get("traded",0))+float(t.qty)
		return true
	return false

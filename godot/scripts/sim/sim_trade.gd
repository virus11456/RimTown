class_name SimTrade
extends RefCounted
static func daily(w: SimWorld) -> void:
	var trade: Dictionary=w.data.trade;trade._daysSince=int(trade.get("_daysSince",0))+1
	if trade.get("merchant") is Dictionary:
		trade.merchant.daysRemaining-=1
		if trade.merchant.daysRemaining<=0:
			SimSocial.log_message(w.data,"trade","商人"+str(trade.merchant.name)+"已離開。","","");trade.merchant=null
		return
	var freq: float=w.data.buildings.activeEffects.get("merchant_frequency",1)
	var boost: float=w.data.get("news",{}).get("activeModifiers",{}).get("merchant_chance",0)
	if w.rng.next_float()<minf(.6,.15*freq+(int(trade._daysSince)-3)*.05+boost): spawn(w)
static func spawn(w: SimWorld) -> void:
	var rules: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/trade_rules.json"))
	var trade: Dictionary=w.data.trade;trade._daysSince=0
	var merchant: Dictionary=w.rng.pick(rules.merchants)
	var bonus: float=w.data.buildings.activeEffects.get("trade_bonus",0)
	var news: Dictionary=w.data.get("news",{}).get("activeModifiers",{})
	var reputation: float=w.data.get("reputationSystem",{}).get("reputation",0)
	var tier:=0
	for i in 6:
		if reputation>=[0,15,40,70,100,150][i]: tier=i
	var rep: float=[0,.03,.05,.08,.12,.15][tier]
	var offers: Array=[]
	for buying in [false,true]:
		for resource in merchant.buys if buying else merchant.sells:
			var base: float=rules.prices.get(resource,5)
			var amount:=w.rng.next_int(15,40) if buying else w.rng.next_int(10,30)
			var price: float=base*(.5+w.rng.next_float()*.3)*(1+bonus+float(news.get("sell_bonus",0))+rep) if buying else base*(1.2+w.rng.next_float()*.6)*(1-bonus-float(news.get("buy_bonus",0))-rep)
			offers.append({"resource":resource,"amount":amount,"price":floorf(price*10+.5)/10,"isBuying":buying})
	trade.merchant={"name":w.rng.pick(merchant.names),"specialty":merchant.specialty,"offers":offers,"daysRemaining":w.rng.next_int(2,4)}
	SimSocial.log_message(w.data,"trade","商人"+str(trade.merchant.name)+"到了！專長："+str(merchant.specialty)+"。","","")
static func execute(w: SimWorld,index: int,qty: float,expected: Dictionary={}) -> Dictionary:
	if not w.data.trade.get("merchant") is Dictionary: return {"error":"沒有商人"}
	var merchant: Dictionary=w.data.trade.merchant
	if index<0 or index>=merchant.offers.size(): return {"error":"無效交易"}
	var offer: Dictionary=merchant.offers[index]
	if not expected.is_empty() and not is_same(expected,offer): return {"error":"商品已改變，請重新選擇"}
	if not is_finite(qty) or qty<=0 or not is_finite(float(offer.price)) or float(offer.price)<0: return {"error":"無效數量或價格"}
	qty=minf(qty,float(offer.amount))
	if qty<=0: return {"error":"無效數量"}
	var total: float=qty*float(offer.price)
	if not is_finite(total): return {"error":"無效總價"}
	if offer.isBuying:
		if not SimEconomy.consume(w,offer.resource,qty,"賣給"+str(merchant.name)): return {"error":str(offer.resource)+"不足"}
		SimEconomy.change(w,"silver",total,"與"+str(merchant.name)+"交易")
	else:
		if not SimEconomy.consume(w,"silver",total,"向"+str(merchant.name)+"購買"): return {"error":"銀幣不足"}
		SimEconomy.change(w,offer.resource,qty,"與"+str(merchant.name)+"交易")
	offer.amount-=qty;merchant.offers=merchant.offers.filter(func(o): return o.amount>.5)
	SimSocial.log_message(w.data,"trade",("賣出" if offer.isBuying else "買入")+" "+str(qty).trim_suffix(".0")+" "+str(offer.resource)+"，"+str(int(floorf(total+.5)))+"銀幣。","","")
	return {"ok":true}

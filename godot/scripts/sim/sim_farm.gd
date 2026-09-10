class_name SimFarm
extends RefCounted
static func rules() -> Dictionary:
	return JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/farm_rules.json"))
static func plot(w: SimWorld,id: int) -> Dictionary:
	for p in w.data.farm.plots:
		if int(p.id)==id: return p
	return {}
static func till(w: SimWorld,id: int) -> bool:
	var p:=plot(w,id)
	if p.get("state")!="empty": return false
	p.state="tilled";return true
static func plant(w: SimWorld,id: int,key: String) -> bool:
	var p:=plot(w,id);var crop: Dictionary=rules().crops.get(key,{})
	if p.get("state")!="tilled" or crop.is_empty() or not SimSupply.crop_space(w,key): return false
	if int(w.data.industry.industries.get("farming",{}).get("level",0))<int(crop.reqLevel) or not w.data.clock.season in crop.seasons: return false
	if not SimEconomy.consume(w,"silver",float(crop.sellPrice)*2,str(crop.name)+"種子"): return false
	p.state="growing";p.crop=key;p.plantedDay=int(w.data.clock.day)+(int(w.data.clock.year)-1)*60;p.growthProgress=0;p.waterLevel=100;p.fertilized=false;return true
static func water(w: SimWorld,id: int) -> bool:
	var p:=plot(w,id)
	if p.get("state")!="growing": return false
	p.waterLevel=minf(100,float(p.waterLevel)+30);return true
static func fertilize(w: SimWorld,id: int) -> bool:
	var p:=plot(w,id)
	if p.get("state")!="growing" or p.fertilized: return false
	if not SimEconomy.consume(w,"herbs",2,"製作肥料"): return false
	p.fertilized=true;return true
static func harvest(w: SimWorld,id: int) -> bool:
	var p:=plot(w,id);var defs:=rules()
	if p.get("state")!="ready": return false
	var crop: Dictionary=defs.crops.get(p.crop,{})
	if crop.is_empty(): return false
	var score:=0
	if float(p.waterLevel)>80: score+=1
	if p.fertilized: score+=1
	if p.lastCrop!=null and str(p.lastCrop)!="" and p.lastCrop!=p.crop: score+=1
	for a in w.data.agents.values():
		if not a.get("isPlayer",false) and SimPlayerChat.job(w,a).get("key")=="farmer":
			if float(a.get("relationships",{}).get("player",{}).get("affinity",0))>=40: score+=1
			break
	var quality: String="excellent" if score>=3 else ("good" if score>=1 else "normal")
	var amount:=floorf(float(crop.yield)*float(defs.multipliers[quality])+.5)
	SimEconomy.change(w,p.crop,amount,"收穫"+str(crop.name)+"("+str(defs.quality[quality])+")","farm")
	var farm: Dictionary=w.data.farm
	farm.harvestLog.append({"crop":p.crop,"cropName":crop.name,"amount":amount,"quality":quality,"sellValue":floorf(float(crop.sellPrice)*amount+.5),"day":w.data.clock.day,"season":w.data.clock.season,"year":w.data.clock.year})
	farm.harvestLog=farm.harvestLog.slice(maxi(0,farm.harvestLog.size()-100))
	farm.totalHarvested[p.crop]=float(farm.totalHarvested.get(p.crop,0))+amount
	SimIndustry.news(w,"farm","收穫了 "+str(int(amount))+" 單位"+str(crop.name)+"（"+str(defs.quality[quality])+"品質）！",5)
	SimQuests.count(w,"harvestCount")
	p.lastCrop=p.crop;p.state="empty";p.crop=null;p.growthProgress=0;p.fertilized=false;return true
static func clear(w: SimWorld,id: int) -> bool:
	var p:=plot(w,id)
	if p.get("state")!="withered": return false
	p.state="empty";p.crop=null;p.growthProgress=0;return true
static func daily(w: SimWorld) -> void:
	var farm: Dictionary=w.data.farm;var industry: Dictionary=w.data.industry.industries.get("farming",{})
	farm.maxPlots=0
	if not industry.is_empty():
		farm.maxPlots=4
		for level in SimIndustry.rules().industries.farming.levels:
			if int(level.lv)==int(industry.level): farm.maxPlots=level.plots
		while farm.plots.size()<int(farm.maxPlots):
			farm._plotCounter=int(farm._plotCounter)+1
			farm.plots.append({"id":farm._plotCounter,"state":"empty","crop":null,"plantedDay":0,"growthProgress":0,"quality":"normal","waterLevel":100,"fertilized":false,"lastCrop":null})
	if farm.moodPenalty!=null:
		farm.moodPenalty.days-=1
		if float(farm.moodPenalty.days)<=0: farm.moodPenalty=null
	var defs:=rules()
	for p in farm.plots:
		if p.state!="growing": continue
		var crop: Dictionary=defs.crops.get(p.crop,{})
		if crop.is_empty(): continue
		if not w.data.clock.season in crop.seasons:
			p.state="withered";SimSocial.log_message(w.data,"farm",str(crop.icon)+" "+str(crop.name)+"因為季節不對而枯萎了！","","");continue
		p.waterLevel=maxf(0,float(p.waterLevel)-8)
		var growth:=100.0/float(crop.growDays)
		if float(p.waterLevel)>60: growth*=1.1
		elif float(p.waterLevel)<30: growth*=.5
		if p.fertilized: growth*=1.2
		if int(industry.get("level",0))>=3: growth*=1.3;p.waterLevel=minf(100,float(p.waterLevel)+5)
		if farm.moodPenalty!=null: growth*=1+float(farm.moodPenalty.penalty)
		p.growthProgress=minf(100,float(p.growthProgress)+growth)
		if float(p.growthProgress)>=100: p.state="ready";SimSocial.log_message(w.data,"farm",str(crop.icon)+" "+str(crop.name)+"成熟了！可以收穫。","","")
	for p in farm.plots:
		if p.state=="ready":
			p._readyDays=int(p.get("_readyDays",0))+1
			if int(p._readyDays)>3:
				p.state="withered";var crop: Dictionary=defs.crops.get(p.crop,{})
				SimSocial.log_message(w.data,"farm",str(crop.get("icon","🥀"))+" "+str(crop.get("name","作物"))+"因太久沒收穫而枯萎了。","","")
		else: p._readyDays=0

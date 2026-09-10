class_name SimCombos
extends RefCounted
static func rules() -> Dictionary:
	return JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/combo_rules.json"))
static func active(data: Dictionary) -> Array:
	var items: Array=[]
	for d in data.get("decorations",[]): items.append({"kind":d.type,"x":d.x,"y":d.y})
	for b in data.buildings.completed:
		var x: Variant=b.get("siteX")
		if b.get("buildingKey")!=null and str(b.buildingKey)!="" and (x is float or x is int) and is_finite(float(x)):
			items.append({"kind":b.buildingKey,"x":float(x)+1,"y":float(b.get("siteY",0))+1})
	var result: Array=[]
	for combo in rules().combos:
		for anchor in items:
			if anchor.kind!=combo.parts[0]: continue
			var found:=true
			for part in combo.parts.slice(1):
				if not items.any(func(i): return i.kind==part and maxf(absf(float(i.x)-float(anchor.x)),absf(float(i.y)-float(anchor.y)))<=4): found=false;break
			if found: result.append(combo);break
	return result
static func check_new(w: SimWorld) -> Array:
	if not w.data.get("combosFound") is Array: w.data.combosFound=[]
	var newly: Array=[]
	for combo in active(w.data):
		if combo.id in w.data.combosFound: continue
		w.data.combosFound.append(combo.id);newly.append(combo)
		SimSocial.log_message(w.data,"building","✨ 發現相鄰組合："+str(combo.icon)+str(combo.name)+"("+str(combo.desc)+")！全鎮心情大好","","")
		SimIndustry.news(w,"building","小鎮出現了「"+str(combo.name)+"」組合！",7)
		for a in w.data.agents.values(): SimFeuds._mood(a,w,6)
		SimEventComments.enqueue(w,"小鎮出現了新組合「"+str(combo.name)+"」("+str(combo.desc)+")")
	w.combo_notifications.append_array(newly)
	return newly
static func decoration(key: String) -> Dictionary:
	for def in rules().decorations:
		if def.type==key: return def
	return {}
static func place(w: SimWorld,key: String,site: Vector2i) -> bool:
	var def:=decoration(key)
	if def.is_empty() or not BuildingSites.allowed(w.data,site,1) or not SimBuildings.affordable(w,def.cost): return false
	for r in def.cost: SimEconomy.consume(w,r,float(def.cost[r]),"擺放"+str(def.name))
	if not w.data.get("decorations") is Array: w.data.decorations=[]
	w.data.decorations.append({"type":key,"x":site.x,"y":site.y})
	SimSocial.log_message(w.data,"building",str(def.icon)+" 你在小鎮擺放了"+str(def.name)+"(美觀+"+str(int(def.beauty))+")","","")
	if w.combos_enabled: check_new(w)
	return true
static func remove(w: SimWorld,item: Dictionary) -> bool:
	var index: int=-1
	for i in w.data.get("decorations",[]).size():
		if is_same(w.data.decorations[i],item): index=i;break
	if index<0: return false
	var def:=decoration(str(item.type));w.data.decorations.remove_at(index)
	for r in def.get("cost",{}): SimEconomy.change(w,r,floorf(float(def.cost[r])/2),"移除裝飾退款")
	return true

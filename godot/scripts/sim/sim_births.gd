class_name SimBirths
extends RefCounted
const TRAITS: Array=["kind","shy","charismatic","gossip","hardworking","lazy","perfectionist","creative","optimist","pessimist","neurotic","stoic","romantic","night_owl","early_bird"]
static func daily(w: SimWorld) -> void:
	if not w.births_enabled: return
	var life: Dictionary=w.data.lifecycle
	life._daysSinceCheck=int(life.get("_daysSinceCheck",0))+1
	if life._daysSinceCheck<2: return
	life._daysSinceCheck=0
	for a in w.data.agents.values():
		if a.get("isDead",false) or a.age<20 or a.age>45: continue
		var manager:=SimRelationships.new();manager.relationships=a.get("relationships",{})
		var partner:=manager.partner()
		if partner.is_empty() or partner.get("status")!="married" or str(a.id)>str(partner.targetId): continue
		var b: Dictionary=w.data.agents.get(partner.targetId,{})
		if b.is_empty() or b.get("isDead",false): continue
		var player_child: bool=a.get("isPlayer",false) or b.get("isPlayer",false)
		if player_child:
			if life.get("playerChildren",[]).size()>=3: continue
		elif w.data.agents.values().filter(func(n): return not n.get("isPlayer",false) and not n.get("isDead",false)).size()>=(SimPopulation.capacity(w) if w.population_enabled else 20): continue
		var age: float=(float(a.age)+float(b.age))/2
		var chance:=.005 if age>40 else (.01 if age>35 else .02)
		if float(partner.affinity)>60: chance*=1.5
		if w.rng.next_float()<chance: birth(w,a,b,player_child)
static func birth(w: SimWorld,a: Dictionary,b: Dictionary,player_child: bool=false) -> Dictionary:
	if not is_same(w.data.agents.get(a.get("id",""),{}),a) or not is_same(w.data.agents.get(b.get("id",""),{}),b) or a.id==b.id or a.get("isDead",false) or b.get("isDead",false): return {}
	var gender:="male" if w.rng.next_float()<.5 else "female"
	var names: Array=SimNewAgent.rules()[gender]
	var used: Array=w.data.agents.values().map(func(n): return n.name)
	used.append_array(w.data.lifecycle.get("graveyard",[]).map(func(n): return n.name))
	var available: Array=names.filter(func(n): return n not in used)
	var name: String=w.rng.pick(available) if not available.is_empty() else str(a.name).left(1)+str(w.rng.pick(names)).right(1)
	var original_name:=name;var suffix:=2
	while name in used: name=original_name+str(suffix);suffix+=1
	var inherited:=SimNewAgent.shuffle(a.personality.traits+b.personality.traits,w).slice(0,2)
	inherited.append(w.rng.pick(TRAITS.filter(func(t): return t not in inherited)))
	var values:=SimNewAgent.shuffle(a.personality.values+b.personality.values,w).slice(0,2)
	var id:="child_"+str(int(w.data.tickCount));suffix=2
	while w.data.agents.has(id): id="child_"+str(int(w.data.tickCount))+"_"+str(suffix);suffix+=1
	var child:=SimNewAgent.create(w,id,name,16,gender,inherited,values,str(a.name)+"和"+str(b.name)+"的孩子。在邊境鎮出生長大。",str(a.homeLocation))
	var life: Dictionary=w.data.lifecycle
	if not life.get("births") is Array: life.births=[]
	life.births.append({"name":name,"parentNames":[a.name,b.name],"birthTick":w.data.tickCount,"birthTime":SimSocial.time_string(w.data.clock)})
	for pair in [[a,b],[b,a]]:
		SimFeuds._mood(pair[0],w,25);SimFeuds._memory(pair[0],w,"relationship","我們的孩子"+name+"出生了！",10,[pair[1].name,name])
		var rel:=SimSocial.relationship(child,pair[0]);SimRelationships.modify(rel,"affinity",50);SimRelationships.modify(rel,"trust",40)
		SimRelationships.modify(SimSocial.relationship(pair[0],child),"affinity",60)
	if player_child:
		child._isPlayerChild=true;child._parentNames=[a.name,b.name]
		if not life.get("playerChildren") is Array: life.playerChildren=[]
		life.playerChildren.append({"agentId":id,"name":name,"parentNames":[a.name,b.name],"birthTick":w.data.tickCount})
		SimQuests.log_event(w,"🎉 你的孩子"+name+"出生了！將來可以繼承你的一切。","system")
	for resident in w.data.agents.values():
		if resident.id!=id: SimFeuds._mood(resident,w,5)
	var parents: String=str(a.name)+"和"+str(b.name)
	SimSocial.log_message(w.data,"birth","🎒 "+parents+"的孩子"+name+"出生了！全鎮慶祝！",name,"")
	w.data.gossip.append({"about":name,"content":parents+"生了個"+("男" if gender=="male" else "女")+"孩，取名"+name+"！","source":"鎮民","spreadCount":0,"tickCreated":w.data.tickCount,"isTrue":true})
	SimIndustry.news(w,"lifecycle",parents+"的孩子"+name+"出生了！",9)
	if w.data.get("dailyNews") is Dictionary: w.data.dailyNews.todayEvents.back().agents=[a.name,b.name,name]
	return child

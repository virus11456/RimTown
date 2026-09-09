class_name SimFactions
extends RefCounted
const TYPES={"work_buddies":["工作夥伴","🔨",5],"drinking_pals":["酒友","🍺",6],"gossip_circle":["八卦圈","🗣️",5],"scholars":["學者聯盟","📚",4],"romantics":["戀愛同盟","💕",4],"troublemakers":["搗蛋鬼","😈",4],"elders_council":["長者議會","🧓",5],"night_owls":["夜貓族","🦉",5]}
static func shuffled(values: Array,rng: SimRandom) -> Array:
	var result:=values.duplicate()
	for i in range(result.size()-1,0,-1):
		var j:=rng.next_int(0,i);var temp: Variant=result[i];result[i]=result[j];result[j]=temp
	return result
static func _log(w: SimWorld,text: String,a := "",b := "") -> void:
	SimSocial.log_message(w.data,"faction",text,a,b)
static func daily(w: SimWorld) -> void:
	if not w.data.get("factions") is Dictionary: w.data.factions={"factions":{},"_counter":0,"_daysSinceCheck":0}
	var system: Dictionary=w.data.factions
	system._daysSinceCheck=int(system.get("_daysSinceCheck",0))+1
	if system._daysSinceCheck<3: return
	system._daysSinceCheck=0
	var factions: Dictionary=system.factions
	var kept: Dictionary={}
	for id in factions.keys():
		var f: Dictionary=factions[id]
		if kept.has(f.type):
			for member in f.members:
				if not member in kept[f.type].members: kept[f.type].members.append(member)
			factions.erase(id)
		else: kept[f.type]=f
	_form(w,system)
	_cohesion(w,factions)
	_events(w,factions)
	for id in factions.keys():
		var f: Dictionary=factions[id]
		f.members=f.members.filter(func(member): return w.data.agents.has(member))
		if f.members.size()<2:
			if f.members.size()==1: _log(w,"「"+f.name+"」因人數不足而解散。",w.data.agents[f.members[0]].name)
			factions.erase(id)
static func _form(w: SimWorld,system: Dictionary) -> void:
	var factions: Dictionary=system.factions
	var npcs: Array=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false))
	var existing: Array=factions.values().map(func(f): return f.type)
	for type in TYPES:
		if type in existing: continue
		var candidates: Array=[]
		if type=="work_buddies":
			var groups: Dictionary={}
			for a in npcs:
				if not w.rules.jobs.has(str(a.get("jobKey",""))): continue
				if not groups.has(a.jobKey): groups[a.jobKey]=[]
				groups[a.jobKey].append(a)
			for group in groups.values():
				if group.size()>=2: candidates=group;break
		else:
			for a in npcs:
				var traits: Array=a.personality.traits
				var eligible:=false
				match type:
					"drinking_pals": eligible="glutton" in traits or "charismatic" in traits or a.get("memory",[]).any(func(m): return "酒" in str(m.get("content","")) or "tavern" in str(m.get("content","")))
					"gossip_circle": eligible="gossip" in traits or "charismatic" in traits
					"scholars": eligible="知識" in a.personality.get("values",[]) or w.rules.jobs.get(str(a.get("jobKey","")),{}).get("category")=="intellectual"
					"romantics": eligible="romantic" in traits or "kind" in traits
					"troublemakers": eligible="abrasive" in traits or "lazy" in traits
					"elders_council": eligible=a.get("age",0)>=40
					"night_owls": eligible="night_owl" in traits
				if eligible: candidates.append(a)
		candidates=candidates.slice(0,int(TYPES[type][2]))
		if candidates.size()<2 or w.rng.next_float()>=.3: continue
		var filtered: Array=candidates.filter(func(a): return factions.values().filter(func(f): return a.id in f.members).size()<2)
		if filtered.size()<2: continue
		system._counter=int(system.get("_counter",0))+1
		var id:="faction_"+str(system._counter)
		var f:={"id":id,"type":type,"name":TYPES[type][0],"icon":TYPES[type][1],"members":filtered.map(func(a): return a.id),"founderName":filtered[0].name,"formedTick":w.data.tickCount,"cohesion":50,"rivalFactionId":null,"allyFactionId":null}
		factions[id]=f
		var names: Array=filtered.map(func(a): return a.name)
		var text:="、".join(names)
		_log(w,f.icon+" "+text+"組成了「"+f.name+"」！",filtered[0].name)
		for a in filtered:
			SimFeuds._memory(a,w,"social","我加入了「"+f.name+"」，成員有"+text+"。",6,names)
			for b in filtered:
				if a.id==b.id: continue
				var compat:=SimDialogue.compatibility(a.personality.traits,b.personality.traits)
				var rel:=SimSocial.relationship(a,b)
				SimRelationships.modify(rel,"affinity",floor(w.rng.next_int(2,5)*compat+.5))
				SimRelationships.modify(rel,"trust",floor(w.rng.next_int(1,3)*compat+.5))
static func _cohesion(w: SimWorld,factions: Dictionary) -> void:
	for f in factions.values():
		var total:=0.0;var count:=0
		for i in f.members.size():
			for j in range(i+1,f.members.size()):
				var a: Dictionary=w.data.agents.get(f.members[i],{});var b: Dictionary=w.data.agents.get(f.members[j],{})
				if not a.is_empty() and not b.is_empty(): total+=SimSocial.relationship(a,b).affinity;count+=1
		if count>0: f.cohesion=clampf(50+total/count,0,100)
		for member in f.members.duplicate():
			var a: Dictionary=w.data.agents.get(member,{})
			if a.is_empty(): f.members=f.members.filter(func(id): return id!=member);continue
			var others: Array=f.members.filter(func(id): return id!=member)
			var sum:=0.0
			for id in others:
				if w.data.agents.has(id): sum+=SimSocial.relationship(a,w.data.agents[id]).affinity
			if sum/maxi(1,others.size())< -30 and w.rng.next_float()<.2:
				f.members=f.members.filter(func(id): return id!=member)
				_log(w,a.name+"退出了「"+f.name+"」。",a.name)
				SimFeuds._memory(a,w,"social","我退出了「"+f.name+"」，我受不了他們了。",5,[])
static func _cross(w: SimWorld,a: Dictionary,b: Dictionary,low: int,high: int,mood: int) -> void:
	for aid in a.members:
		for bid in b.members:
			if w.data.agents.has(aid) and w.data.agents.has(bid):
				SimRelationships.modify(SimSocial.relationship(w.data.agents[aid],w.data.agents[bid]),"affinity",w.rng.next_int(low,high))
				SimRelationships.modify(SimSocial.relationship(w.data.agents[bid],w.data.agents[aid]),"affinity",w.rng.next_int(low,high))
	for id in a.members+b.members:
		if w.data.agents.has(id): SimFeuds._mood(w.data.agents[id],w,mood)
static func _events(w: SimWorld,factions: Dictionary) -> void:
	var list: Array=factions.values().filter(func(f): return f.members.size()>=2)
	if list.size()<2 or w.rng.next_float()>.15: return
	list=shuffled(list,w.rng)
	var a: Dictionary=list[0];var b: Dictionary=list[1];var roll:=w.rng.next_float()
	if roll<.4:
		if a.get("rivalFactionId")==b.id or w.rng.next_float()<.3:
			a.rivalFactionId=b.id;b.rivalFactionId=a.id
			var text: String=w.rng.pick(["「"+a.name+"」和「"+b.name+"」在鎮上爆發了爭執！","「"+a.name+"」的成員公開批評「"+b.name+"」。","「"+a.name+"」和「"+b.name+"」因為意見不合發生衝突。"])
			_log(w,text)
			if not w.data.get("events") is Dictionary: w.data.events={}
			if not w.data.events.get("conversationTopics") is Array: w.data.events.conversationTopics=[]
			w.data.events.conversationTopics.append(text)
			_cross(w,a,b,-5,-2,-5)
			w.present_dispute(a.members,b.members)
	elif roll<.7:
		a.allyFactionId=b.id;b.allyFactionId=a.id
		if a.get("rivalFactionId")==b.id: a.rivalFactionId=null;b.rivalFactionId=null
		_log(w,w.rng.pick(["「"+a.name+"」和「"+b.name+"」決定攜手合作！","「"+a.name+"」邀請「"+b.name+"」一起舉辦活動。","「"+a.name+"」和「"+b.name+"」化敵為友，達成共識。"]))
		_cross(w,a,b,2,5,3)
	else:
		var f: Dictionary=w.rng.pick([a,b])
		if f.members.size()>=3 and w.rng.next_float()<.4:
			var members: Array=shuffled(f.members.filter(func(id): return w.data.agents.has(id)).map(func(id): return w.data.agents[id]),w.rng)
			if members.size()<2: return # Malformed legacy save; avoid dereferencing absent residents.
			var first: Dictionary=members[0];var second: Dictionary=members[1]
			var text: String=w.rng.pick([first.name+"在「"+f.name+"」聚會中公開指責"+second.name+"！",first.name+"和"+second.name+"在「"+f.name+"」內鬧不愉快。","「"+f.name+"」內部出現分裂，"+first.name+"帶頭反對"+second.name+"。"])
			_log(w,text,first.name,second.name)
			SimRelationships.modify(SimSocial.relationship(first,second),"affinity",w.rng.next_int(-8,-3))
			SimRelationships.modify(SimSocial.relationship(second,first),"affinity",w.rng.next_int(-6,-2))
			f.cohesion=maxf(0,f.cohesion-10)
			SimRomance._gossip(first,text,w)
			w.present_dispute([first.id],[second.id])

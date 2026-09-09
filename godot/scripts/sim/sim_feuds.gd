class_name SimFeuds
extends RefCounted
## World._processFeuds; AI scene generation and daily news callbacks excluded.
static func _memory(a: Dictionary,w: SimWorld,category: String,text: String,importance: int,names: Array) -> void:
	var memory:=SimMemory.new();memory.entries=a.get("memory",[])
	memory.add(int(w.data.tickCount),SimSocial.time_string(w.data.clock),category,text,importance,names)
	a.memory=memory.entries
static func _mood(a: Dictionary,w: SimWorld,delta: float) -> void:
	w.runtime[a.id].moodModifier=float(w.runtime[a.id].get("moodModifier",0))+delta
static func is_event(entry: Dictionary) -> bool:
	return entry.get("type")=="event" and (str(entry.get("content","")).begins_with("💢 ") or str(entry.get("content","")).begins_with("🗯️ "))
static func process(w: SimWorld) -> void:
	var npcs: Array=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false) and not a.get("isDead",false))
	if not w.data.get("feudCooldown") is Dictionary: w.data.feudCooldown={}
	var cooldown: Dictionary=w.data.feudCooldown
	# Preserve upstream's day-of-season + year formula, including seasonal rollover.
	var day:=int(w.data.clock.day)+(int(w.data.clock.year)-1)*60
	var seen: Dictionary={}
	for a in npcs:
		for tid in a.get("relationships",{}).keys():
			var rel: Dictionary=a.relationships[tid]
			var b: Dictionary=w.data.agents.get(tid,{})
			if b.is_empty() or b.get("isPlayer",false) or b.get("isDead",false): continue
			var key: String=(tid+"|"+a.id) if SimRomance._after(a.id,tid) else (a.id+"|"+tid)
			if seen.has(key): continue
			seen[key]=true
			var back: Dictionary=b.get("relationships",{}).get(a.id,{})
			if back.is_empty(): continue
			if rel.affinity<= -60 and back.affinity<= -60 and not rel.get("isFeud",false):
				rel.isFeud=true;back.isFeud=true;cooldown[key]=day
				_mood(a,w,-10);_mood(b,w,-10)
				_memory(a,w,"relationship","我和"+b.name+"徹底鬧翻,絕交了。這口氣嚥不下去。",9,[b.name])
				_memory(b,w,"relationship","我和"+a.name+"徹底鬧翻,絕交了。這口氣嚥不下去。",9,[a.name])
				SimSocial.log_message(w.data,"event","💢 "+a.name+"和"+b.name+"積怨徹底爆發,當眾撂下重話,正式絕交!","","")
				continue
			var last:=int(cooldown.get(key,0))
			if last==0: last= -99 # JS || treats zero as absent.
			if rel.affinity<= -35 and back.affinity<= -35 and day-last>=5 and w.rng.next_float()<.15:
				cooldown[key]=day
				SimRelationships.modify(rel,"affinity",-4);SimRelationships.modify(back,"affinity",-4)
				_mood(a,w,-6);_mood(b,w,-6)
				SimSocial.log_message(w.data,"event","🗯️ "+a.name+"和"+b.name+"在眾目睽睽下大吵一架,火藥味十足!","","")
				for witness in npcs:
					if witness.id==a.id or witness.id==b.id: continue
					var wa: float=witness.relationships.get(a.id,{}).get("affinity",0)
					var wb: float=witness.relationships.get(b.id,{}).get("affinity",0)
					if wa>=40 and wb<40:
						SimRelationships.modify(SimSocial.relationship(witness,b),"affinity",-3)
						_memory(witness,w,"observation","目睹"+a.name+"和"+b.name+"當眾大吵——我當然站"+a.name+"這邊。",4,[a.name,b.name])
					elif wb>=40 and wa<40:
						SimRelationships.modify(SimSocial.relationship(witness,a),"affinity",-3)
						_memory(witness,w,"observation","目睹"+a.name+"和"+b.name+"當眾大吵——我當然站"+b.name+"這邊。",4,[a.name,b.name])
					elif (wa!=0 or wb!=0) and w.rng.next_float()<.3:
						_memory(witness,w,"observation","看到"+a.name+"和"+b.name+"當眾大吵,小鎮的氣氛有點僵。",3,[a.name,b.name])

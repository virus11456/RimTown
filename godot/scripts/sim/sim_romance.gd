class_name SimRomance
extends RefCounted
## World._processRelationships, excluding AI drama, news and NPC event-chain callbacks.
const THOUGHTS={"got_together":["戀愛的甜蜜",20,0,5],"married":["新婚的幸福",25,0,8],"betrayed":["被劈腿背叛",-28,-4,15],"broke_up":["剛失戀",-15,0,8],"divorced":["離婚的傷痛",-20,0,12],"rival_formed":["跟人結了樑子",-6,-2,10],"jealous":["嫉妒的煎熬",-8,0,6]}
static func _thought(a: Dictionary,kind: String,w: SimWorld,target: Dictionary = {}) -> void:
	var thoughts: Array=a.get("thoughts",[])
	var id: Variant=target.get("id")
	for thought in thoughts:
		if thought.kind==kind and thought.get("targetId")==id:
			thought.start=SimClock.total_days(w.data.clock);return
	var rule: Array=THOUGHTS[kind]
	thoughts.append({"kind":kind,"label":rule[0],"mood":rule[1],"opinion":rule[2],"targetId":id,"targetName":target.get("name"),"start":SimClock.total_days(w.data.clock),"days":rule[3]})
	a.thoughts=thoughts.slice(maxi(0,thoughts.size()-14))
static func _mood(a: Dictionary,delta: float,w: SimWorld) -> void:
	w.runtime[a.id].moodModifier=float(w.runtime[a.id].get("moodModifier",0))+delta
static func _memory(a: Dictionary,text: String,importance: int,names: Array,w: SimWorld,category := "relationship") -> void:
	var memory:=SimMemory.new();memory.entries=a.get("memory",[])
	memory.add(int(w.data.tickCount),SimSocial.time_string(w.data.clock),category,text,importance,names)
	a.memory=memory.entries
static func _log(text: String,a: Dictionary,b: Dictionary,w: SimWorld) -> void:
	SimSocial.log_message(w.data,"relationship",text,a.name,b.name)
static func _gossip(a: Dictionary,text: String,w: SimWorld) -> void:
	# Original relationship events append directly, without the creator's 10k cap.
	if not w.data.has("gossip"): w.data.gossip=[]
	w.data.gossip.append({"about":a.name,"content":text,"source":"鎮民","spreadCount":0,"tickCreated":w.data.tickCount,"isTrue":true})
static func _status(ra: Dictionary,rb: Dictionary,status: String,w: SimWorld) -> void:
	ra.status=status;rb.status=status;ra.statusSince=w.data.tickCount;rb.statusSince=w.data.tickCount
static func _rel(a: Dictionary,b: Dictionary) -> Dictionary:
	return SimSocial.relationship(a,b)
static func _partner(a: Dictionary) -> Dictionary:
	for r in a.get("relationships",{}).values():
		if r.get("status") in ["dating","married"]: return r
	return {}
static func _after(a: String,b: String) -> bool:
	var aa:=a.to_utf16_buffer();var bb:=b.to_utf16_buffer()
	for i in range(0,mini(aa.size(),bb.size()),2):
		if aa.decode_u16(i)!=bb.decode_u16(i): return aa.decode_u16(i)>bb.decode_u16(i)
	return aa.size()>bb.size()
static func process(w: SimWorld) -> void:
	var npcs: Array=w.data.agents.values().filter(func(a): return not a.get("isPlayer",false))
	for a in npcs:
		for ra in a.get("relationships",{}).values():
			var b: Dictionary=w.data.agents.get(str(ra.targetId),{})
			if b.is_empty() or b.get("isPlayer",false) or _after(a.id,ra.targetId): continue
			var rb:=_rel(b,a)
			var couple: bool=ra.get("status") in ["married","dating"]
			if int(w.data.tickCount)-int(ra.get("lastInteractionTick",0))>50:
				if ra.affinity>5:
					SimRelationships.modify(ra,"affinity",-.3 if couple else -.8);SimRelationships.modify(rb,"affinity",-.3 if couple else -.8)
				if ra.romanticInterest>5 and not couple and ra.affinity<30:
					SimRelationships.modify(ra,"romanticInterest",-.5);SimRelationships.modify(rb,"romanticInterest",-.5)
			var ta: Array=a.personality.traits;var tb: Array=b.personality.traits
			if not ra.get("status") and ra.affinity>20 and ra.interactionCount>3:
				var compat:=1
				if "romantic" in ta or "romantic" in tb: compat+=2
				if "romantic" in ta and "romantic" in tb: compat+=1
				if "shy" in ta and "kind" in tb: compat+=1
				if "kind" in ta and "shy" in tb: compat+=1
				if "charismatic" in ta or "charismatic" in tb: compat+=1
				if "creative" in ta and "creative" in tb: compat+=1
				if "optimist" in ta and "optimist" in tb: compat+=1
				if "abrasive" in ta and "abrasive" in tb: compat-=2
				if "jealous" in ta or "jealous" in tb: compat-=1
				var charm: float=b.get("attributes",{}).get("charm",5)
				if charm==0: charm=5
				var growth:=maxi(0,floori(float(ra.affinity)/20)+compat+floori((charm-5)/2))
				if growth>0 and w.rng.next_float()<.45: SimRelationships.modify(ra,"romanticInterest",w.rng.next_int(1,mini(growth+1,5)))
				if ra.affinity>45 and compat>=3 and ra.romanticInterest>15 and w.rng.next_float()<.06:
					SimRelationships.modify(ra,"romanticInterest",w.rng.next_int(8,16))
					_log("💓 "+a.name+"對"+b.name+"的心動,好像悄悄加深了...",a,b,w)
					SimGossip.create_relationship(w.data,"crush",a,b,w.rng)
				if ra.romanticInterest>40 and rb.affinity>30 and not rb.get("status") and rb.romanticInterest<ra.romanticInterest:
					var crush: bool=b.relationships.values().any(func(r): return r.romanticInterest>55 and r.targetId!=a.id)
					if _partner(b).is_empty() and not crush and w.rng.next_float()<.3: SimRelationships.modify(rb,"romanticInterest",w.rng.next_int(2,5))
			if not ra.get("status") and ra.romanticInterest>45:
				var partner:=_partner(b)
				if not partner.is_empty() and partner.targetId!=a.id:
					var lucky: Dictionary=w.data.agents.get(str(partner.targetId),{})
					if not lucky.is_empty() and not lucky.get("isPlayer",false) and w.rng.next_float()<.13:
						var jealous:=_rel(a,lucky)
						SimRelationships.modify(jealous,"affinity",-w.rng.next_int(8,16) if jealous.affinity<0 else -w.rng.next_int(6,12))
						_thought(a,"jealous",w,lucky);_mood(a,-6,w)
						SimRelationships.modify(ra,"romanticInterest",-w.rng.next_int(2,5))
						_log("💔 "+a.name+"看著"+b.name+"和"+lucky.name+",心裡很不是滋味...",a,lucky,w)
						if w.rng.next_float()<.4: SimGossip.create_relationship(w.data,"jealous",a,lucky,w.rng,b.name)
				else:
					for rival in npcs:
						if rival.id==a.id or rival.id==b.id: continue
						var rival_crush: Dictionary=rival.relationships.get(b.id,{})
						if not rival_crush.is_empty() and rival_crush.romanticInterest>40 and w.rng.next_float()<.20:
							var feud:=_rel(a,rival);var back:=_rel(rival,a)
							var bite:=w.rng.next_int(10,20) if feud.affinity< -10 else w.rng.next_int(8,15)
							SimRelationships.modify(feud,"affinity",-bite);SimRelationships.modify(back,"affinity",-bite)
							SimRelationships.modify(feud,"trust",-5);SimRelationships.modify(back,"trust",-5)
							if not feud.get("_rivalGossiped",false) and feud.affinity<= -25:
								feud._rivalGossiped=true
								_thought(a,"rival_formed",w,rival);_thought(rival,"rival_formed",w,a)
								_log("⚡ "+a.name+"和"+rival.name+"為了"+b.name+"暗自較勁,關係越來越僵...",a,rival,w)
								SimGossip.create_relationship(w.data,"rivalry",a,rival,w.rng)
							break
			if ra.interactionCount>3 and not ra.get("status"):
				var friction:=0
				for pair in [["optimist","pessimist"],["hardworking","lazy"],["shy","charismatic"],["night_owl","early_bird"]]:
					if (pair[0] in ta and pair[1] in tb) or (pair[1] in ta and pair[0] in tb): friction+=2
				if "abrasive" in ta or "abrasive" in tb: friction+=1
				if "jealous" in ta and "charismatic" in tb: friction+=1
				if friction>0 and w.rng.next_float()<.16:
					SimRelationships.modify(ra,"affinity",-w.rng.next_int(2,friction+2));SimRelationships.modify(rb,"affinity",-w.rng.next_int(2,friction+2))
			if ra.affinity<= -40 and not ra.get("_rivalGossiped",false):
				ra._rivalGossiped=true;_mood(a,-4,w);SimGossip.create_relationship(w.data,"rivalry",a,b,w.rng)
			if not ra.get("status") and not rb.get("status") and _partner(a).is_empty() and _partner(b).is_empty() and ra.romanticInterest>50 and rb.romanticInterest>35 and ra.affinity>30 and rb.affinity>20 and w.rng.next_float()<.2:
				_status(ra,rb,"dating",w)
				_thought(a,"got_together",w,b);_thought(b,"got_together",w,a)
				_log(a.name+"和"+b.name+"開始交往了！",a,b,w)
				_memory(a,"我和"+b.name+"開始交往了！",9,[b.name],w);_memory(b,"我和"+a.name+"開始交往了！",9,[a.name],w)
				_mood(a,20,w);_mood(b,20,w);SimGossip.create_relationship(w.data,"newCouple",a,b,w.rng)
			if ra.get("status")=="dating" and rb.get("status")=="dating" and w.data.tickCount-ra.statusSince>300 and ra.affinity>50 and ra.romanticInterest>55 and rb.affinity>45 and rb.romanticInterest>45 and w.rng.next_float()<.10:
				_status(ra,rb,"married",w);_thought(a,"married",w,b);_thought(b,"married",w,a)
				_log(a.name+"和"+b.name+"結婚了！全鎮舉辦了盛大的婚禮！",a,b,w)
				_memory(a,"我和"+b.name+"結婚了！這是我人生中最幸福的一天。",10,[b.name],w);_memory(b,"我和"+a.name+"結婚了！太開心了。",10,[a.name],w)
				for guest in w.data.agents.values():
					_mood(guest,8,w)
					if guest.id!=a.id and guest.id!=b.id: _memory(guest,"參加了"+a.name+"和"+b.name+"的婚禮！",6,[a.name,b.name],w,"social")
				_gossip(a,a.name+"和"+b.name+"結婚了！婚禮好浪漫！",w)
			if ra.get("status") in ["dating","married"] and not ra.get("isCheating",false):
				for extra in a.relationships.values():
					if extra.targetId==ra.targetId: continue
					var third: Dictionary=w.data.agents.get(str(extra.targetId),{})
					if third.is_empty() or third.get("isPlayer",false): continue
					var third_rel:=_rel(third,a)
					var vulnerable: bool=ra.affinity<20 or "romantic" in ta or "neurotic" in ta
					if vulnerable and extra.romanticInterest>50 and third_rel.romanticInterest>40 and extra.affinity>30 and w.rng.next_float()<.06:
						extra.isCheating=true;third_rel.isCheating=true
						_log(a.name+"背著"+b.name+"和"+third.name+"有了秘密關係⋯⋯",a,third,w)
						_memory(a,"我背著"+b.name+"和"+third.name+"在一起了⋯⋯我知道這不對。",9,[b.name,third.name],w);_memory(third,"我和"+a.name+"開始了秘密關係。",8,[a.name],w)
						_gossip(a,"有人看到"+a.name+"和"+third.name+"偷偷在一起⋯⋯",w);break
			if ra.get("status") in ["dating","married"] and not ra.get("isCheating",false):
				var affair: Dictionary={}
				for r in b.relationships.values():
					if r.get("isCheating",false) and r.targetId!=a.id: affair=r;break
				if not affair.is_empty() and w.rng.next_float()<.15:
					var third: Dictionary=w.data.agents.get(str(affair.targetId),{})
					var third_name: String=third.get("name","某人")
					var action:="離婚" if ra.status=="married" else "分手"
					_status(ra,rb,"ex",w);SimRelationships.modify(ra,"affinity",-40);SimRelationships.modify(ra,"trust",-50);SimRelationships.modify(rb,"affinity",-20)
					affair.isCheating=false;affair.status=null
					if not third.is_empty():
						var back:=_rel(third,b);back.isCheating=false;back.status=null
					_thought(a,"betrayed",w,b)
					_log(a.name+"發現"+b.name+"劈腿"+third_name+"，兩人"+action+"了！",a,b,w)
					_memory(a,"發現"+b.name+"背著我和"+third_name+"在一起。我們"+action+"了。",10,[b.name,third_name],w);_memory(b,a.name+"發現了我的事情。我們"+action+"了。",10,[a.name],w)
					_mood(a,-30,w);_mood(b,-15,w);_gossip(b,b.name+"劈腿被"+a.name+"發現了！兩人"+action+"了！",w)
			if ra.get("status")=="dating" and rb.get("status")=="dating" and w.data.tickCount-ra.statusSince>100 and (ra.affinity< -10 or rb.affinity< -10 or (ra.romanticInterest<15 and rb.romanticInterest<15)) and w.rng.next_float()<.1:
				_separate(a,b,ra,rb,w,false)
			if ra.get("status")=="married" and rb.get("status")=="married" and w.data.tickCount-ra.statusSince>300 and ra.affinity< -30 and rb.affinity< -20 and w.rng.next_float()<.05:
				_separate(a,b,ra,rb,w,true)
static func _separate(a: Dictionary,b: Dictionary,ra: Dictionary,rb: Dictionary,w: SimWorld,married: bool) -> void:
	var action:="離婚" if married else "分手"
	_status(ra,rb,"ex",w)
	SimRelationships.modify(ra,"affinity",-15 if married else -10);SimRelationships.modify(rb,"affinity",-15 if married else -10)
	_thought(a,"divorced" if married else "broke_up",w);_thought(b,"divorced" if married else "broke_up",w)
	_log(a.name+"和"+b.name+action+"了。",a,b,w)
	_memory(a,"我和"+b.name+action+"了。",10 if married else 8,[b.name],w);_memory(b,"我和"+a.name+action+"了。",10 if married else 8,[a.name],w)
	_mood(a,-25 if married else -15,w);_mood(b,-25 if married else -15,w)
	if married:
		for guest in w.data.agents.values():
			if guest.id!=a.id and guest.id!=b.id: _mood(guest,-3,w)
	_gossip(a,a.name+"和"+b.name+action+("了⋯⋯好可惜。" if married else "了⋯⋯"),w)

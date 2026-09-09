class_name SimGossip
extends RefCounted
## GossipNetwork rules. Event/news producers and player whisper UI are separate systems.
static func _find(data: Dictionary,agent_name: String) -> Dictionary:
	for a in data.agents.values():
		if a.name==agent_name: return a
	return {}
static func _remember(a: Dictionary,data: Dictionary,text: String,importance: int,names: Array) -> void:
	var memory:=SimMemory.new()
	memory.entries=a.get("memory",[])
	memory.add(int(data.tickCount),SimSocial.time_string(data.clock),"social",text,importance,names)
	a.memory=memory.entries
static func _append(data: Dictionary,gossip: Dictionary) -> Dictionary:
	var items: Array=data.get("gossip",[])
	items.append(gossip)
	data.gossip=items.slice(maxi(0,items.size()-10000))
	return gossip
static func _partner(a: Dictionary) -> Dictionary:
	var manager:=SimRelationships.new()
	manager.relationships=a.get("relationships",{})
	return manager.partner()
static func _title(data: Dictionary) -> String:
	var p: Dictionary=data.agents.get("player",{})
	if p.is_empty():
		for a in data.agents.values():
			if a.get("isPlayer",false): p=a; break
	return "鎮長" if p.get("jobKey")=="mayor" else "旅人"
static func _thought(a: Dictionary,kind: String,data: Dictionary,source: Dictionary) -> void:
	var thoughts: Array=a.get("thoughts",[])
	for thought in thoughts:
		if thought.kind==kind and thought.get("targetId")==source.id:
			thought.start=SimClock.total_days(data.clock);return
	var praised:=kind=="praised"
	thoughts.append({"kind":kind,"label":"被人公開稱讚" if praised else "被人說壞話","mood":8 if praised else -10,"opinion":2 if praised else -3,"targetId":source.id,"targetName":source.name,"start":SimClock.total_days(data.clock),"days":4 if praised else 6})
	a.thoughts=thoughts.slice(maxi(0,thoughts.size()-14))
static func _post(data: Dictionary,author: Dictionary,text: String) -> void:
	var feed: Dictionary=data.get("townFeed",{})
	feed._counter=int(feed.get("_counter",0))+1
	var posts: Array=feed.get("posts",[])
	posts.append({"id":"p"+str(feed._counter),"authorId":author.id,"authorName":author.name,"text":text,"time":SimSocial.time_string(data.clock),"day":"第%d年 %s 第%d天"%[data.clock.year,data.clock.season,data.clock.day],"tick":data.tickCount,"likes":[],"comments":[]})
	feed.posts=posts.slice(maxi(0,posts.size()-120))
	data.townFeed=feed
	data._feedUnread=int(data.get("_feedUnread",0))+1
static func create_relationship(data: Dictionary,kind: String,a: Dictionary,b: Dictionary,rng: SimRandom,extra := "") -> Dictionary:
	var templates:={
		"crush":["欸你有沒有發現,"+a.name+"看"+b.name+"的眼神不太一樣...","我猜"+a.name+"對"+b.name+"有意思,不然幹嘛老是找藉口靠近!"],
		"jealous":["聽說"+a.name+"最近超針對"+b.name+"的,好像是為了"+(extra if not extra.is_empty() else "某個人")+"...",a.name+"跟"+b.name+"之間氣氛好僵,是在吃醋吧?"],
		"newCouple":["天大的消息!"+a.name+"和"+b.name+"在一起了!",a.name+"跟"+b.name+"湊成一對了,大家都說很配!"],
		"rivalry":[a.name+"和"+b.name+"鬧翻了,見面都不講話...","你敢信嗎?"+a.name+"跟"+b.name+"現在是死對頭了。"]}
	if not templates.has(kind): return {}
	var content: String=rng.pick(templates[kind])
	var gossip:=_append(data,{"about":a.name,"content":content,"source":"鎮民","spreadCount":0,"tickCreated":data.tickCount,"isTrue":true,"kind":kind,"juicy":true})
	SimSocial.log_message(data,"gossip","🗞️ "+content,a.name,b.name)
	return gossip
static func create(source: Dictionary,about: Dictionary,data: Dictionary,rng: SimRandom) -> Dictionary:
	var rel:=SimSocial.relationship(source,about)
	var templates: Array=[]
	if rel.romanticInterest>40: templates.append("你不覺得"+about.name+"挺有魅力的嗎？")
	if rel.affinity< -10: templates.append("說真的，"+about.name+"最近行為很奇怪。")
	if about.mood< -20: templates.append("你有注意到"+about.name+"最近看起來很低落嗎？")
	if about.mood>50: templates.append(about.name+"最近心情超好的！")
	var manager:=SimRelationships.new()
	manager.relationships=about.get("relationships",{})
	var interests:=manager.romantic_interests()
	if not interests.is_empty(): templates.append("聽說"+about.name+"好像對"+str(rng.pick(interests).targetName)+"有意思！")
	var partner:=manager.partner()
	if not partner.is_empty():
		if partner.status=="dating": templates.append(about.name+"和"+partner.targetName+"在交往呢，你知道嗎？")
		if partner.status=="married": templates.append(about.name+"和"+partner.targetName+"的婚姻生活不知道怎麼樣？")
		if partner.get("isCheating",false): templates.append("我好像看到"+about.name+"背著"+partner.targetName+"跟別人在一起⋯⋯")
	if manager.relationships.values().any(func(r): return r.get("isCheating",false)):
		templates.append("你聽說了嗎？"+about.name+"好像在劈腿⋯⋯")
	if templates.is_empty(): templates.append("你聽說"+about.name+"昨天在做什麼嗎？")
	var content: String=rng.pick(templates)
	return _append(data,{"about":about.name,"content":content,"source":source.name,"spreadCount":0,"tickCreated":data.tickCount,"isTrue":rng.next_float()>.2})
static func seed_player(data: Dictionary,player: Dictionary,listener: Dictionary,about: Dictionary,tone: String,rng: SimRandom,ship_with := "") -> Dictionary:
	var templates:={"praise":[about.name+"最近超罩的,大家都該學學!","我覺得"+about.name+"是鎮上最可靠的人。"],"diss":[about.name+"最近很懶散,大家小心點...","說真的,"+about.name+"私底下跟表面不太一樣喔..."],"ship":[about.name+"和"+ship_with+"是不是有什麼?我看他們常常眉來眼去..."]}
	var content: String=rng.pick(templates.get(tone,templates.praise))
	var gossip:=_append(data,{"about":about.name,"content":content,"source":player.name,"spreadCount":1,"tickCreated":data.tickCount,"isTrue":tone=="praise","tone":tone,"shipWith":null if ship_with.is_empty() else ship_with})
	_remember(listener,data,player.name+"偷偷跟我說:「"+content+"」",5,[player.name,about.name])
	SimSocial.log_message(data,"gossip","🗣️ "+_title(data)+"偷偷向"+listener.name+"爆料了"+about.name+"的事...",player.name,listener.name)
	return gossip
static func spread(speaker: Dictionary,listener: Dictionary,data: Dictionary,rng: SimRandom) -> Dictionary:
	var eligible: Array=data.get("gossip",[]).filter(func(g): return g.about!=listener.name)
	if eligible.is_empty(): return {}
	if "gossip" not in speaker.personality.traits and rng.next_float()>.3: return {}
	var gossip: Dictionary=rng.pick(eligible)
	gossip.spreadCount+=1
	if not gossip.get("_mutated",false) and gossip.spreadCount>=2 and rng.next_float()<.4:
		gossip._mutated=true
		match rng.next_int(0,2):
			0: gossip.content="我跟你說,"+gossip.content+"而且好像不只這樣..."
			1: gossip.content="千真萬確!"+gossip.content
			2: gossip.content+="聽說整條街都知道了!"
	_remember(listener,data,speaker.name+"告訴我：「"+gossip.content+"」",4,[speaker.name,gossip.about])
	if gossip.get("juicy",false) and gossip.spreadCount<=3:
		SimSocial.log_message(data,"gossip","🗣️ "+speaker.name+"偷偷說：「"+gossip.content+"」",speaker.name,listener.name)
	if gossip.spreadCount>=4 and not gossip.get("_confronted",false):
		gossip._confronted=true
		confront(gossip,data,rng)
	return gossip
static func confront(gossip: Dictionary,data: Dictionary,rng: SimRandom) -> void:
	var subject:=_find(data,gossip.about)
	if subject.is_empty() or subject.get("isPlayer",false): return
	var source:=_find(data,gossip.source)
	var negative: bool=gossip.get("tone")=="diss" or not gossip.get("isTrue",false) or ["奇怪","劈腿","背著","懶散"].any(func(word): return word in gossip.content)
	var positive: bool=gossip.get("tone")=="praise"
	if not source.is_empty() and source.get("isPlayer",false):
		var rel:=SimSocial.relationship(subject,source)
		if positive or negative:
			SimRelationships.modify(rel,"affinity",6 if positive else -12)
			if not positive: SimRelationships.modify(rel,"trust",-10)
			_thought(subject,"praised" if positive else "slandered",data,source)
			_remember(subject,data,"聽說"+source.name+"到處誇我,真開心!" if positive else "居然是"+source.name+"在背後說我壞話...太過分了。",6 if positive else 8,[source.name])
			if source.get("chatHistory") is Array:
				source.chatHistory.append({"speaker":subject.name,"target":source.name,"text":"欸,我聽說你到處跟人誇我?哈哈,謝啦,請你喝一杯!" if positive else "我都聽說了。你在背後那樣說我?虧我還這麼信任你。","time":SimSocial.time_string(data.clock)})
			SimSocial.log_message(data,"gossip","💐 "+subject.name+"聽到了"+_title(data)+"的美言,好感大增!" if positive else "💢 "+subject.name+"發現"+source.name+"在背後說他壞話,關係惡化!",subject.name,"")
	elif not source.is_empty() and negative and source.id!=subject.id:
		SimRelationships.modify(SimSocial.relationship(subject,source),"affinity",-12)
		SimRelationships.modify(SimSocial.relationship(source,subject),"affinity",-8)
		SimSocial.log_message(data,"gossip","💢 "+subject.name+"聽到了"+source.name+"散布的謠言,當面對質!兩人關係惡化",subject.name,source.name)
		_post(data,subject,rng.pick(["最近聽到一些關於我的傳言。清者自清,懶得解釋。","有些人嘴巴可以積點德嗎?","謠言止於智者。就這樣。"] ))
	if gossip.get("tone")=="ship" and gossip.get("shipWith"):
		var other:=_find(data,str(gossip.shipWith))
		if not other.is_empty() and not other.get("isPlayer",false) and _partner(subject).is_empty() and _partner(other).is_empty():
			SimRelationships.modify(SimSocial.relationship(subject,other),"romanticInterest",rng.next_int(3,6))
			SimRelationships.modify(SimSocial.relationship(other,subject),"romanticInterest",rng.next_int(3,6))
			SimSocial.log_message(data,"gossip","💘 被大家起鬨之後,"+subject.name+"和"+gossip.shipWith+"好像真的開始注意彼此了...",subject.name,"")

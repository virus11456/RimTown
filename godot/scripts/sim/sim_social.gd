class_name SimSocial
extends RefCounted
## Scoped NPC socializing + original offline dialogue. Gossip/news effects deferred.
var dialogue := SimDialogue.new()
static func time_string(clock: Dictionary) -> String:
	return "第%d年 %s 第%d天 %02d:%02d" % [clock.year,clock.season,clock.day,clock.hour,clock.minute]
static func relationship(a: Dictionary,b: Dictionary) -> Dictionary:
	if not a.has("relationships"): a.relationships={}
	var manager:=SimRelationships.new()
	manager.relationships=a.relationships
	return manager.get_or_create(str(b.id),str(b.name))
static func remember(a: Dictionary,data: Dictionary,category: String,text: String,importance: int,other: String) -> void:
	var memory:=SimMemory.new()
	memory.entries=a.get("memory",[])
	memory.add(int(data.tickCount),time_string(data.clock),category,text,importance,[other])
	a.memory=memory.entries
static func log_message(data: Dictionary,kind: String,text: String,a: String,b: String) -> void:
	var logs: Array=data.get("messageLog",[])
	logs.append({"time":time_string(data.clock),"tick":data.tickCount,"type":kind,"content":text,"agent":a,"target":b})
	data.messageLog=logs.slice(maxi(0,logs.size()-10000))
func try_interaction(a: Dictionary,data: Dictionary,rng: SimRandom,jobs: Dictionary) -> void:
	if int(data.tickCount)-int(a.get("_lastInteractionTick",0))<6 or a.activity=="sleeping": return
	var others: Array=[]
	var weights: Array=[]
	for b in data.agents.values():
		if b.id==a.id or b.activity=="sleeping" or b.currentLocation!=a.currentLocation: continue
		var rel:=relationship(a,b)
		var weight:=5+maxi(0,floori(float(rel.affinity)/10))+floori(float(rel.romanticInterest)/10)
		if rel.affinity< -30: weight=maxi(1,weight-5)
		others.append(b); weights.append(maxi(1,weight))
	if others.is_empty(): return
	var b: Dictionary=rng.weighted(others,weights)
	a._lastInteractionTick=data.tickCount
	# Keep the original gossip probability draw; spreading is a later 4b increment.
	rng.next_float()
	var rel:=relationship(a,b)
	if rel.affinity>=30 and rng.next_float()<.12 and not a.get("_pendingHangout") and not b.get("_pendingHangout"):
		var spot: String=rng.pick(["tavern","park","town_square","chapel","forest","library"])
		var activity:="recreation" if rel.romanticInterest>40 else "socializing"
		var delay:=rng.next_int(2,5)
		a._pendingHangout={"location":spot,"activity":activity,"tick":delay,"withAgent":b.name}
		b._pendingHangout={"location":spot,"activity":activity,"tick":delay,"withAgent":a.name}
		var description: String=a.name+"約了"+b.name+"一起去"+spot.replace("_"," ")
		log_message(data,"social",description,a.name,b.name)
		remember(a,data,"social",description,5,b.name)
		remember(b,data,"social",description,5,a.name)
	converse(a,b,data,rng,jobs)
func converse(a: Dictionary,b: Dictionary,data: Dictionary,rng: SimRandom,jobs: Dictionary) -> Dictionary:
	dialogue.rng=rng
	var ra:=relationship(a,b)
	var rb:=relationship(b,a)
	# Transient dialogue inputs expose source job.title without mutating save schema.
	var va:=a.duplicate(); va.job=jobs.get(str(a.get("jobKey","")))
	var vb:=b.duplicate(); vb.job=jobs.get(str(b.get("jobKey","")))
	var result: Dictionary=dialogue._generatePersonalityDialogue(va,vb,data,ra,rb)
	var compat:=SimDialogue.compatibility(a.personality.traits,b.personality.traits)
	var aff_a:=int(result._affA)
	var aff_b:=int(result._affB)
	if aff_a>0: aff_a=floori(aff_a*compat+.5)
	if aff_b>0: aff_b=floori(aff_b*compat+.5)
	var summary: String=result._summary
	SimRelationships.modify(ra,"affinity",aff_a)
	SimRelationships.modify(rb,"affinity",aff_b)
	SimRelationships.modify(ra,"romanticInterest",result._romA)
	SimRelationships.modify(rb,"romanticInterest",result._romB)
	SimRelationships.record_interaction(ra,int(data.tickCount),summary)
	SimRelationships.record_interaction(rb,int(data.tickCount),summary)
	remember(a,data,"conversation","與"+b.name+"交談："+summary,mini(6,3+absi(aff_a)),b.name)
	remember(b,data,"conversation","與"+a.name+"交談："+summary,mini(6,3+absi(aff_b)),a.name)
	log_message(data,"conversation",summary,a.name,b.name)
	var logs: Array=data.get("npcConversationLog",[])
	logs.append({"time":time_string(data.clock),"dayTag":"%d-%s-%d"%[data.clock.year,data.clock.season,data.clock.day],"location":a.currentLocation,"dialogue":result.lines,"summary":summary,"agentA":a.name,"agentB":b.name,"agentAId":a.id,"agentBId":b.id})
	data.npcConversationLog=logs.slice(maxi(0,logs.size()-10000))
	return result

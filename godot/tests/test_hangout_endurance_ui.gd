extends "res://tests/test_player_chat_ui.gd"
var proposals: Dictionary={}
var visits: Dictionary={}
var invalid: Array=[]
var max_records:=0
var conversations:=0
var eligible_conversations:=0
var day_eight: Dictionary={}
var traces: Dictionary={}
func audit(w: SimWorld,m: SimMotion) -> void:
	for id in w.data.agents:
		var p: Variant=w.data.agents[id].get("_pendingHangout")
		if p is Dictionary and p.has("withId"):
			var token:=SimHangoutVisits.key(id,p)
			if not proposals.has(token): proposals[token]={"people":[id,p.withId],"issued_tick":p.issued_tick,"state":"pending"}
	max_records=maxi(max_records,SimHangoutVisits.records(w).size())
	for token in SimHangoutVisits.records(w):
		var r: Dictionary=SimHangoutVisits.records(w)[token]
		if not proposals.has(token): proposals[token]={"people":r.people,"issued_tick":r.issued_tick,"state":"pending"}
		var old: Dictionary=visits.get(token,{})
		if r.state=="met" and old.get("state","")!="met":
			if not SimCareerPresence.together(m,r.people[0],r.people[1],r.place): invalid.append("meeting outside venue: "+token)
			var a: Dictionary=m.positions[r.people[0]];var b: Dictionary=m.positions[r.people[1]]
			if Vector2(a.x,a.y).distance_to(Vector2(b.x,b.y))>48: invalid.append("distant meeting: "+token)
			if int(r.resolved_tick)>=int(r.until): invalid.append("late meeting: "+token)
		if old.get("state","") in ["met","missed","cancelled"] and old.state!=r.state: invalid.append("terminal changed: "+token)
		visits[token]=r.duplicate(true)
		proposals[token].state="departed"
	for token in proposals:
		if visits.has(token): continue
		var p: Dictionary=proposals[token]
		var live:=false
		for id in p.people:
			var pending: Variant=w.data.agents.get(id,{}).get("_pendingHangout")
			if pending is Dictionary and SimHangoutVisits.key(id,pending)==token: live=true
		if not live and p.state=="pending":
			p.state="ended_before_departure"
			p.reason=w.quest_balance.get("hangout_status",{}).get(p.people[0],{}).get("reason","未留下原因")
func trace_tick(w: SimWorld) -> void:
	for token in proposals:
		var p: Dictionary=proposals[token]
		var r: Dictionary=SimHangoutVisits.records(w).get(token,{})
		if p.state=="ended_before_departure" or r.get("state","") in ["met","missed","cancelled"]: continue
		var rows: Array=traces.get(token,[]);var people: Dictionary={}
		for id in p.people:
			var a: Dictionary=w.data.agents.get(id,{})
			var pending: Variant=a.get("_pendingHangout")
			people[id]={"activity":a.get("activity"),"location":a.get("currentLocation"),"pending_delay":pending.get("tick",-1) if pending is Dictionary else -1,"stay":a.get("_locationStayRemaining",0),"available":SimHangoutSafety.available_person(w,a) if not a.is_empty() else false,"hunger":a.get("needs",{}).get("hunger"),"rest":a.get("needs",{}).get("rest"),"leisure_directing":SimLeisurePlan.directing(w,id),"appointment_directing":SimAppointments.directing(w,id)}
		rows.append({"tick":int(w.data.tickCount),"hour":w.data.clock.hour,"minute":w.data.clock.minute,"people":people,"visit":r.duplicate(true)})
		traces[token]=rows
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	for t in 3072:
		var affinities: Dictionary={}
		for id in w.data.agents:
			for other in w.data.agents[id].get("relationships",{}): affinities[id+"|"+other]=w.data.agents[id].relationships[other].get("affinity",0)
		var previous: Array=w.data.get("npcConversationLog",[]).duplicate(true)
		trace_tick(w)
		app._tick_simulation()
		for row in w.data.get("npcConversationLog",[]):
			if not previous.has(row):
				conversations+=1
				if not w.data.agents[row.agentAId].get("isPlayer",false) and not w.data.agents[row.agentBId].get("isPlayer",false) and float(affinities.get(row.agentAId+"|"+row.agentBId,0))>=30: eligible_conversations+=1
		audit(w,app.motion)
		for frame in 120:
			app.motion.update(w.data.agents)
			SimAppointments.observe(w,app.motion);SimLeisurePlan.observe(w,app.motion);SimHangoutVisits.observe(w,app.motion)
			audit(w,app.motion)
		if t==1535:
			var saved: Dictionary=app.progress_snapshot()
			var before: Dictionary=SimHangoutVisits.records(w).duplicate(true)
			app._load_document(JSON.stringify(saved),"32 day hangout resume")
			check(equal(before,SimHangoutVisits.records(w)),"mid-run app reload preserves visits")
		if t==767: day_eight={"conversations":conversations,"affinity_eligible_conversations":eligible_conversations,"proposals":proposals.size()}
		if t%96==95: print("day ",t/96+1," proposals=",proposals.size()," visits=",visits.size()," conversations=",conversations)
	var outcomes: Dictionary={};var reasons: Dictionary={};var pauses:=0
	for r in visits.values():
		outcomes[r.state]=int(outcomes.get(r.state,0))+1
		if r.get("pause_used",false): pauses+=1
		if r.state!="met": reasons[r.reason]=int(reasons.get(r.reason,0))+1
	for p in proposals.values():
		if p.state=="ended_before_departure": reasons[p.reason]=int(reasons.get(p.reason,0))+1
	check(invalid.is_empty(),"every observed meeting is timely and physically close, terminal outcomes stable")
	check(conversations>0,"original residents have natural conversations")
	check(max_records<=20,"observed visit history remains bounded")
	check(not proposals.is_empty(),"natural simulation generates at least one paired proposal")
	var report:={"checks":checks,"failures":failures,"ticks":3072,"day_eight":day_eight,"affinity_eligible_conversations":eligible_conversations,"motion_frames_per_tick":120,"conversations":conversations,"proposals":proposals.size(),"departed_visits":visits.size(),"outcomes":outcomes,"reasons":reasons,"paused_visits":pauses,"maximum_records":max_records,"invalid":invalid,"traces":traces,"proposal_details":proposals,"visit_details":visits,"scope":"32 days of original app residents and settings, 120 physical motion frames per tick, app reload halfway, no altered jobs/needs/positions/affinity/resources or production AI; headless, not full game playthrough"}
	FileAccess.open("res://docs/HANGOUT_ENDURANCE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify({"checks":checks,"failures":failures,"outcomes":outcomes,"proposals":proposals.size(),"visits":visits.size(),"reasons":reasons}));quit(0 if failures.is_empty() else 1)

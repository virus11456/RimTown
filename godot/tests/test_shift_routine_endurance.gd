extends "res://tests/test_player_chat_ui.gd"
var shifts: Array=[]
var false_sleep: Array=[]
var guard_sleep: Dictionary={}
var proposals: Dictionary={}
var visits: Dictionary={}
var invalid: Array=[]
var max_records:=0
var conversations:=0
var eligible_conversations:=0
var day_eight: Dictionary={}
var traces: Dictionary={}
var home_returns: Dictionary={}
var availability: Array=[]
var sampled_tick:=-1
var max_return_step:=0.0
func audit_returns(w: SimWorld,m: SimMotion) -> void:
	if sampled_tick!=int(w.data.tickCount):
		sampled_tick=int(w.data.tickCount)
		for id in w.data.agents:
			var task: Dictionary=w.data.agents[id].get("_hangoutHome",{})
			if task.is_empty(): continue
			var key:=str(id)+"|"+str(task.signature)
			if not home_returns.has(key): home_returns[key]={"id":id,"home":task.home,"until":task.until,"signature":task.signature,"started":sampled_tick,"state":"returning"}
	for r in home_returns.values():
		if r.state!="returning" or not w.data.agents.has(r.id) or not m.positions.has(r.id): continue
		var a: Dictionary=w.data.agents[r.id];var p: Dictionary=m.positions[r.id]
		if r.has("last_x"): max_return_step=maxf(max_return_step,Vector2(p.x,p.y).distance_to(Vector2(r.last_x,r.last_y)))
		var current_task: Dictionary=a.get("_hangoutHome",{})
		if not current_task.is_empty() and current_task.get("signature")==r.signature:
			r.until=current_task.until;r.meal_allowance_ticks=current_task.get("meal_allowance_ticks",0)
		r.last_x=p.x;r.last_y=p.y
		if SimHomeRest.arrived(w,a): r.state="arrived";r.resolved=int(w.data.tickCount)
		elif int(w.data.tickCount)>=int(r.until): r.state="expired";r.resolved=int(w.data.tickCount)
		elif a.homeLocation!=r.home: r.state="home_changed";r.resolved=int(w.data.tickCount)
func sample_availability(w: SimWorld) -> void:
	var rows: Array=[]
	for id in w.data.agents:
		var a: Dictionary=w.data.agents[id]
		if a.get("isPlayer",false) or a.get("isDead",false): continue
		var hours: Array=[]
		for hour in range(8,20):
			if SimAppointments.free_hour(w,id,hour): hours.append(hour)
		rows.append({"id":id,"job":a.get("jobKey",""),"hours":hours})
	availability.append({"tick":w.data.tickCount,"residents":rows})
func audit(w: SimWorld,m: SimMotion) -> void:
	audit_returns(w,m)
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
func trace_tick(w: SimWorld,m: SimMotion) -> void:
	for token in proposals:
		var p: Dictionary=proposals[token]
		var r: Dictionary=SimHangoutVisits.records(w).get(token,{})
		if p.state=="ended_before_departure" or r.get("state","") in ["met","missed","cancelled"]: continue
		var rows: Array=traces.get(token,[]);var people: Dictionary={}
		for id in p.people:
			var a: Dictionary=w.data.agents.get(id,{})
			var pending: Variant=a.get("_pendingHangout")
			people[id]={"activity":a.get("activity"),"location":a.get("currentLocation"),"pending_delay":pending.get("tick",-1) if pending is Dictionary else -1,"stay":a.get("_locationStayRemaining",0),"available":SimHangoutSafety.available_person(w,a) if not a.is_empty() else false,"hunger":a.get("needs",{}).get("hunger"),"rest":a.get("needs",{}).get("rest"),"leisure_directing":SimLeisurePlan.directing(w,id),"appointment_directing":SimAppointments.directing(w,id)}
			var position: Dictionary=m.positions.get(id,{})
			people[id].motion=position.duplicate(true)
			people[id].actual_place=SimCareerPresence.place(m,id)
		rows.append({"tick":int(w.data.tickCount),"hour":w.data.clock.hour,"minute":w.data.clock.minute,"people":people,"visit":r.duplicate(true)})
		traces[token]=rows
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation
	var ticks:=768
	for t in ticks:
		var affinities: Dictionary={}
		for id in w.data.agents:
			for other in w.data.agents[id].get("relationships",{}): affinities[id+"|"+other]=w.data.agents[id].relationships[other].get("affinity",0)
		var previous: Array=w.data.get("npcConversationLog",[]).duplicate(true)
		trace_tick(w,app.motion)
		app._tick_simulation()
		for id in w.data.agents:
			var resident: Dictionary=w.data.agents[id]
			if resident.get("isPlayer",false) or resident.get("isDead",false): continue
			if resident.activity=="sleeping":
				if not SimHomeRest.arrived(w,resident): false_sleep.append({"id":id,"tick":w.data.tickCount})
				if resident.get("_guardShift","")=="night": guard_sleep[str(int(w.data.clock.hour))]=int(guard_sleep.get(str(int(w.data.clock.hour)),0))+1
			var job:=SimWorkSchedule.job(resident,w.rules.jobs)
			if not job.is_empty() and int(w.data.clock.minute)==0 and int(w.data.clock.hour)==int(job.work_hours[0]):
				shifts.append({"id":id,"tick":w.data.tickCount,"workplace":job.workplace,"available":w.data.townMap.locations.has(job.workplace),"on_time":SimCareerPresence.place(app.motion,id)==job.workplace,"actual":SimCareerPresence.place(app.motion,id),"activity":resident.activity})
		for row in w.data.get("npcConversationLog",[]):
			if not previous.has(row):
				conversations+=1
				if not w.data.agents[row.agentAId].get("isPlayer",false) and not w.data.agents[row.agentBId].get("isPlayer",false) and float(affinities.get(row.agentAId+"|"+row.agentBId,0))>=30: eligible_conversations+=1
		audit(w,app.motion)
		for frame in app.motion.frames_per_tick():
			app.motion.update(w.data.agents)
			SimAppointments.observe(w,app.motion);SimLeisurePlan.observe(w,app.motion);SimHangoutVisits.observe(w,app.motion)
			audit(w,app.motion)
		if t==383:
			var saved: Dictionary=app.progress_snapshot()
			var before: Dictionary=SimHangoutVisits.records(w).duplicate(true)
			app._load_document(JSON.stringify(saved),"8 day clock travel resume")
			check(equal(before,SimHangoutVisits.records(w)),"mid-run app reload preserves visits")
			check(w.data.agents.yang_feng._guardShift=="day" and w.data.agents.gao_lang._guardShift=="night","mid-run reload preserves both guard shifts")
			check(int(SimShiftSleep.window(w.data.agents.gao_lang,w.rules.jobs).start)==8,"mid-run reload preserves night guard daytime sleep window")
		if t==767: day_eight={"conversations":conversations,"affinity_eligible_conversations":eligible_conversations,"proposals":proposals.size()}
		if t%96==95: sample_availability(w)
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
	check(int(outcomes.get("met",0))>0,"natural paired encounter completes at actual venue")
	check(max_return_step<2,"observed post-meeting return never teleports")
	check(not home_returns.is_empty() and home_returns.values().all(func(row): return row.state=="arrived"),"all observed post-meeting returns reach their own home within bounded deadline")
	check(false_sleep.is_empty(),"sleeping residents are physically stopped in their own room")
	check(not guard_sleep.is_empty(),"night guard actually sleeps during natural run")
	var eligible:=shifts.filter(func(row): return row.available)
	var guard_starts:=eligible.filter(func(row): return row.id in ["yang_feng","gao_lang"])
	check(shifts.size()==160 and guard_starts.size()==16,"eight days observe all resident and guard shift starts")
	var attendance:={"eligible":eligible.size(),"on_time":eligible.filter(func(row): return row.on_time).size(),"unavailable":shifts.size()-eligible.size(),"guard_total":guard_starts.size(),"guard_on_time":guard_starts.filter(func(row): return row.on_time).size()}
	var report:={"attendance":attendance,"shifts":shifts,"false_sleep":false_sleep,"night_guard_sleep_hours":guard_sleep,"availability":availability,"home_returns":home_returns,"max_return_step":max_return_step,"checks":checks,"failures":failures,"ticks":ticks,"day_eight":day_eight,"affinity_eligible_conversations":eligible_conversations,"motion_frames_per_tick":app.motion.frames_per_tick(),"conversations":conversations,"proposals":proposals.size(),"departed_visits":visits.size(),"outcomes":outcomes,"reasons":reasons,"paused_visits":pauses,"maximum_records":max_records,"invalid":invalid,"traces":traces,"proposal_details":proposals,"visit_details":visits,"scope":"8 original app days, reload halfway"+", 480 physical motion frames per tick, no altered jobs/needs/positions/affinity/resources or production AI; headless, not full game playthrough"}
	FileAccess.open("res://docs/SHIFT_ROUTINE_ENDURANCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify({"checks":checks,"failures":failures,"outcomes":outcomes,"proposals":proposals.size(),"visits":visits.size(),"reasons":reasons}));quit(0 if failures.is_empty() else 1)

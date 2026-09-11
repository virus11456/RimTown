extends "res://tests/test_dual_town_frontier.gd"
var counters: Dictionary={"free":0,"event":0,"heart":0,"accepted":0,"stale":0,"retries":0,"reloads":0}
var pending: Dictionary={}
var samples: Array=[]
func dispatch(app: Node,id: String,channel: String) -> void:
	var w: SimWorld=app.simulation
	var target:=id
	if channel!="free": target=str(w.event_comments[0].npc)
	pending={"id":target,"channel":channel,"tick":int(w.data.tickCount),"context":SimConversationSchedule.capture(w,target)}
	if channel=="free":
		app.show_tab("居民",true);app.show_player_chat(target);app.send_player_chat(target,"最近的生活還好嗎？")
	else:
		pending.fallback=w.event_comments[0].fallback
		app.process_event_comment()
	counters[channel]+=1
func resolve(app: Node) -> void:
	var w: SimWorld=app.simulation;var id: String=pending.id;var channel: String=pending.channel
	var changed: bool=pending.context!=SimConversationSchedule.capture(w,id)
	var before:=w.snapshot();var request_count:=requests
	release_reply.emit();await settle()
	if changed:
		counters.stale+=1
		if channel=="free":
			check(equal(before,w.snapshot()),"natural change rejects whole stale free response at %d"%int(w.data.tickCount))
			check(app.chat_drafts.get(id)=="最近的生活還好嗎？","natural stale draft survives")
			# Inspect the live schedule and return before an explicit user retry.
			var unchanged:=w.snapshot();press(app.drawer_body,"查看目前行程");await settle()
			check(app.resident_page=="agenda" and equal(unchanged,w.snapshot()),"schedule inspection has no gameplay effects")
			press(app.drawer_body,"回到自由交談");await settle()
			check(app.chat_drafts.get(id)=="最近的生活還好嗎？","return from schedule retains draft")
			press(app.drawer_body,"傳送");counters.retries+=1
			release_reply.emit();await settle()
			check(not app.chat_drafts.has(id) and not app.chat_busy,"explicit retry uses current facts")
		else: check(w.data.agents.player.chatHistory.back().text==pending.fallback,"natural stale spontaneous reply uses original fallback")
	else:
		counters.accepted+=1
		check("自然時間測試回覆" in JSON.stringify(w.data.agents.player.get("chatHistory",[])),"stable natural reply is delivered")
	check(requests==request_count+(1 if changed and channel=="free" else 0),"only explicit retries issue a request")
	if samples.size()<50: samples.append({"tick":w.data.tickCount,"channel":channel,"stale":changed,"changes":SimConversationSchedule.changes(pending.context,SimConversationSchedule.capture(w,id))})
	pending={}
func run() -> void:
	var town:="harbor" if "--harbor" in OS.get_cmdline_user_args() else "frontier"
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.load_demo(town)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	var id:="hb_achao" if town=="harbor" else "chen_wei"
	var jobs: Dictionary={};var slept: Dictionary={};var bad_sleep: Array=[];var negative: Array=[]
	for key in w.data.agents: jobs[key]=w.data.agents[key].jobKey
	app.chat_transport=mock;app.event_comment_transport=mock;w.event_comments_online=true;w.heart_events_online=true
	reply={"ok":true,"data":{"reply":"自然時間測試回覆，改天有空要不要見面？\nEFFECTS: {\"affinity_change\":1,\"romantic_change\":0,\"summary\":\"聊日常\",\"invitation\":true}"}}
	var site:=Vector2i(-1,-1)
	for candidate in BuildingSites.candidates(w.data):
		if BuildingSites.vacant(w,candidate): site=candidate;break
	var stock: Dictionary=w.data.stockpile.duplicate(true)
	SimBuildings.start(w,"farm_irrigation",false,site)
	check(equal(stock,w.data.stockpile) and not SimGovernance.direct(w),"original traveler only proposes construction")
	var paid: Dictionary={};var executed:=-1;var complete:=-1;var physical_met:=0;var accepted_cards:=0
	var path: Array=[];var index:=0;var card_key:="";var accepted_keys: Array=[]
	m.manual_player=true;audit(m)
	for tick in 768:
		app._tick_simulation();audit(m)
		var proposal: Dictionary=SimGovernance.book(w).proposals[0]
		if proposal.status=="approved":
			var before: Dictionary=w.data.stockpile.resources.duplicate(true)
			app.show_governance();press(app.drawer_body,"執行核准案 #%d"%int(proposal.id))
			if proposal.status=="executed":
				executed=int(w.data.tickCount)
				for resource in ["wood","stone","tools"]: paid[resource]=float(before.get(resource,0))-SimEconomy.amount(w,resource)
		if complete<0 and w.data.buildings.completed.any(func(p): return p.get("buildingKey")=="farm_irrigation"): complete=int(w.data.tickCount)
		if not pending.is_empty() and int(w.data.tickCount)-int(pending.tick)>=1:
			# Other UI operations can change the current drawer while a reply awaits.
			if pending.channel=="free": app.show_tab("居民",true);app.show_player_chat(pending.id)
			await resolve(app)
		var a:=SimAppointments.current(w)
		if a.get("state")=="offered":
			app.show_tab("居民",true);app.show_appointment(a.npc);press(app.drawer_body,"接受邀約")
			if a.state=="accepted": accepted_cards+=1;accepted_keys.append(SimAppointments.card_key(a))
		elif a.get("state")=="change_offered":
			app.show_tab("居民",true);app.show_appointment(a.npc);press(app.drawer_body,"同意新時間")
		if tick%6==0 and pending.is_empty():
			var channel:="free"
			if tick%12==0 and not w.event_comments.is_empty(): channel="heart" if w.event_comments[0].get("kind")=="heart" else "event"
			dispatch(app,id,channel)
		for frame in m.frames_per_tick():
			m.update(w.data.agents);audit(m)
			a=SimAppointments.current(w)
			if a.get("state")=="waiting":
				var token:=SimAppointments.card_key(a)
				if token!=card_key:
					card_key=token;var player: Dictionary=m.positions.player
					path=m.pathfinder.find_path(Vector2(player.x,player.y),m.layout._nearest(m.layout._center(a.place)));index=0
				if index<path.size():
					var player: Dictionary=m.positions.player;var delta:=Vector2(path[index].x,path[index].y)-Vector2(player.x,player.y)
					if delta.length()<2: index+=1;m.move_player(Vector2.ZERO,1.0/60)
					else: m.move_player(delta.normalized(),minf(1.0/60,delta.length()/72.0))
				else: m.move_player(Vector2.ZERO,1.0/60)
			else: m.move_player(Vector2.ZERO,1.0/60)
			audit(m);var was_waiting: bool=a.get("state")=="waiting"
			SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
			if was_waiting and a.state=="met": physical_met+=1
		for key in jobs:
			if key=="player": continue
			if w.data.agents[key].activity=="sleeping":
				if SimHomeRest.arrived(w,w.data.agents[key]): slept[key]=true
				elif bad_sleep.size()<10: bad_sleep.append({"id":key,"tick":w.data.tickCount})
		for resource in w.data.stockpile.resources:
			if float(w.data.stockpile.resources[resource])<0 and negative.size()<10: negative.append(resource)
		if tick in [190,382,574]:
			if not pending.is_empty():
				var save: Dictionary=app.progress_snapshot();var points: Dictionary=m.positions.duplicate(true)
				app._load_document(JSON.stringify(save),"natural conversation reload")
				var before:=w.snapshot();release_reply.emit();await settle()
				check(equal(before,w.snapshot()) and equal(points,m.positions),"reload invalidates awaited reply without moving residents")
				pending={};counters.reloads+=1
			else:
				var points: Dictionary=m.positions.duplicate(true);app._load_document(JSON.stringify(app.progress_snapshot()),"natural conversation reload")
				check(equal(points,m.positions),"native mid-run positions survive")
				counters.reloads+=1
		if tick%96==95: print(JSON.stringify({"town":town,"tick":w.data.tickCount,"counters":counters,"met":physical_met,"complete":complete}))
	if not pending.is_empty(): await resolve(app)
	check(counters.accepted>0 and counters.stale>0 and counters.retries>0,"natural simulation covers accepted stale and explicit retry")
	check(counters.event>0 and counters.heart>0 and counters.free>0,"all three channels exercised from genuine game events and chat progression")
	check(physical_met>0 and accepted_cards>0,"generated invitations explicitly accepted and physically met")
	check(executed>0 and complete>executed and equal(paid,{"wood":10.0,"stone":15.0,"tools":2.0}),"original-priced proposal completes with normal daily work")
	check(jobs.keys().all(func(key): return key=="player" or slept.has(key)) and bad_sleep.is_empty(),"all original residents actually sleep at home")
	check(maximum_npc<1.001 and maximum_player<=1.201 and invalid_steps.is_empty(),"eight days of motion have no teleport or blocked cells")
	check(negative.is_empty() and w.supply_enabled,"normal supply rules and nonnegative stock retained")
	check(jobs.keys().all(func(key): return w.data.agents[key].jobKey==jobs[key]),"original jobs unchanged")
	var report:={"checks":checks,"failures":failures,"town":town,"ticks":768,"motion_frames":768*m.frames_per_tick(),"requests":requests,"counters":counters,"physical_meetings":physical_met,"accepted_cards":accepted_cards,"paid":paid,"executed":executed,"complete":complete,"sleepers":slept.keys(),"max_npc_step":maximum_npc,"max_player_step":maximum_player,"invalid_steps":invalid_steps,"bad_sleep":bad_sleep,"negative_stock":negative,"samples":samples,"scope":"eight natural days with original population/jobs/resources, normal governance construction, genuine queued event/heart comments, mock AI with one-tick delay, explicit retries via live UI, accepted invitations with collision walking, native reload; no production AI or forced NPC positions"}
	FileAccess.open("res://docs/CONVERSATION_ENDURANCE_"+town.to_upper()+".json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));
	if failures.is_empty(): FileAccess.open(ProjectSettings.globalize_path("res://../../../outputs/聊天八日_"+town+".rimtown"),FileAccess.WRITE).store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())))
	quit(0 if failures.is_empty() else 1)

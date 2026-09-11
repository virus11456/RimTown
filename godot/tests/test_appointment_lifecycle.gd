extends "res://tests/test_player_chat_ui.gd"
var last_points: Dictionary={}
var maximum_npc:=0.0
var maximum_player:=0.0
var invalid_steps: Array=[]
func audit(m: SimMotion) -> void:
	for id in m.positions:
		var p: Dictionary=m.positions[id];var point:=Vector2(p.x,p.y)
		if last_points.has(id):
			var step: float=point.distance_to(last_points[id])
			if id=="player": maximum_player=maxf(maximum_player,step)
			else: maximum_npc=maxf(maximum_npc,step)
		if not m.layout._walkable(point) and invalid_steps.size()<10: invalid_steps.append({"id":id,"x":point.x,"y":point.y})
		last_points[id]=point
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	var initial_stock: Dictionary=w.data.stockpile.duplicate(true);var initial_jobs: Dictionary={}
	for id in w.data.agents: initial_jobs[id]=w.data.agents[id].jobKey
	check(SimGovernance.mayor(w)=="chen_wei" and not SimGovernance.direct(w),"original traveler has no mayor spending authority")
	var site:=Vector2i(-1,-1)
	for candidate in BuildingSites.candidates(w.data):
		if BuildingSites.vacant(w,candidate): site=candidate;break
	check(site!=Vector2i(-1,-1),"original town has a currently vacant construction site")
	var project:=SimBuildings.start(w,"farm_irrigation",false,site)
	check(project.is_empty() and equal(initial_stock,w.data.stockpile),"traveler submits proposal without spending or free construction")
	var proposal: Dictionary=SimGovernance.book(w).proposals.back()
	check(proposal.status=="pending","normal mayor review is pending")
	app.chat_transport=mock;reply={"ok":true,"data":{"reply":"明天找時間在廣場見面吧。\nEFFECTS: {\"affinity_change\":0,\"romantic_change\":0,\"summary\":\"邀請旅人見面\",\"invitation\":true}"}}
	app.show_tab("居民",true);app.show_player_chat("chen_wei");app.send_player_chat("chen_wei","你明天有空嗎？");release_reply.emit();await settle()
	var appointment:=SimAppointments.current(w)
	check(appointment.get("state")=="offered","mock chat creates a real offer with original mayor schedule")
	press(app.drawer_body,"見面約定");await settle();press(app.drawer_body,"接受邀約");await settle()
	check(appointment.state=="accepted","actual card acceptance schedules the meeting")
	m.manual_player=true
	var first_until:=int(appointment.until);var initial_until:=first_until;var executed_tick:=-1;var complete_tick:=-1;var met_tick:=-1;var returned_tick:=-1
	var slept: Dictionary={};var worked: Dictionary={};var bad_sleep: Array=[];var negative_stock: Array=[];var stages: Array=[]
	var first_wait:=-1;var missed_tick:=-1;var missed_home:=-1;var second_offer:=-1;var first_record: Dictionary={};var terminal_reload:=false
	var player_path: Array=[];var player_index:=0;var paid: Dictionary={};var reload_ok:=false
	audit(m)
	for tick in range(480):
		app._tick_simulation();audit(m)
		proposal=SimGovernance.book(w).proposals[0];appointment=SimAppointments.current(w)
		if proposal.status=="approved":
			var before: Dictionary=w.data.stockpile.resources.duplicate(true)
			app.show_governance();press(app.drawer_body,"執行核准案 #%d"%int(proposal.id));audit(m)
			if proposal.status=="executed":
				executed_tick=int(w.data.tickCount)
				for key in ["wood","stone","tools"]: paid[key]=float(before.get(key,0))-SimEconomy.amount(w,key)
		if complete_tick<0 and w.data.buildings.completed.any(func(p): return p.get("buildingKey")=="farm_irrigation"): complete_tick=int(w.data.tickCount)
		if tick==119:
			var save: Dictionary=app.progress_snapshot();var before_positions: Dictionary=m.positions.duplicate(true)
			app._load_document(JSON.stringify(save),"original town integrated reload")
			reload_ok=equal(before_positions,m.positions) and SimAppointments.current(w).state=="accepted"
			audit(m);appointment=SimAppointments.current(w)
		if missed_home>=0 and second_offer<0:
			app.show_tab("居民",true);app.show_appointment("chen_wei");press(app.drawer_body,"詢問明天能否見面")
			appointment=SimAppointments.current(w)
			if appointment.state=="offered":
				second_offer=int(w.data.tickCount);initial_until=int(appointment.until)
				check(not appointment.has("npc_arrived") and not appointment.has("reschedule_count"),"new offer does not inherit old arrival or reschedule state")
				press(app.drawer_body,"接受邀約")
				check(appointment.state=="accepted","second invitation is explicitly accepted through current card")
		for id in w.data.agents:
			var resident: Dictionary=w.data.agents[id]
			if id=="player": continue
			if resident.activity=="sleeping":
				if SimHomeRest.arrived(w,resident): slept[id]=true
				elif bad_sleep.size()<10: bad_sleep.append({"id":id,"tick":w.data.tickCount})
		for resource in w.data.stockpile.resources:
			if float(w.data.stockpile.resources[resource])<0 and negative_stock.size()<10: negative_stock.append({"key":resource,"tick":w.data.tickCount})
		for frame in m.frames_per_tick():
			m.update(w.data.agents);audit(m)
			if second_offer>=0 and appointment.state=="waiting" and player_path.is_empty():
				var npc: Dictionary=m.positions.chen_wei;var player: Dictionary=m.positions.player
				player_path=m.pathfinder.find_path(Vector2(player.x,player.y),Vector2(npc.x,npc.y));player_index=0
			if second_offer>=0 and appointment.state=="waiting" and player_index<player_path.size():
				var player: Dictionary=m.positions.player;var goal:=Vector2(player_path[player_index].x,player_path[player_index].y)
				var delta:=goal-Vector2(player.x,player.y)
				if delta.length()<2: player_index+=1;m.move_player(Vector2.ZERO,1.0/60)
				else: m.move_player(delta.normalized(),minf(1.0/60,delta.length()/72.0))
				audit(m)
			else: m.move_player(Vector2.ZERO,1.0/60)
			SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
			if second_offer<0 and appointment.state=="waiting" and first_wait<0: first_wait=int(w.data.tickCount)
			if appointment.state=="missed" and missed_tick<0:
				missed_tick=int(w.data.tickCount);first_record=appointment.duplicate(true)
				var terminal: Dictionary=app.progress_snapshot();var positions: Dictionary=m.positions.duplicate(true)
				app._load_document(JSON.stringify(terminal),"missed meeting terminal reload");appointment=SimAppointments.current(w)
				var after:=w.snapshot();SimAppointments.tick(w);SimAppointments.observe(w,m)
				terminal_reload=equal(after,w.snapshot()) and equal(positions,m.positions) and appointment.state=="missed"
				app.show_tab("居民",true);app.show_appointment("chen_wei")
				check(has_text(app.drawer_body,"這次沒有完成見面") and has_text(app.drawer_body,"重新接受"),"missed card explains no completion and fresh consent for future invitation")
			if missed_tick>=0 and missed_home<0 and SimHomeRest.arrived(w,w.data.agents.chen_wei): missed_home=int(w.data.tickCount)
			if appointment.state=="met" and met_tick<0: met_tick=int(w.data.tickCount)
			if met_tick>=0 and returned_tick<0 and SimHomeRest.arrived(w,w.data.agents.chen_wei): returned_tick=int(w.data.tickCount)
			if complete_tick>=0 and w.data.agents.liu_jun.activity=="working" and not m.positions.liu_jun.walking and m.positions.liu_jun.doorPhase==null and SimCareerPresence.place(m,"liu_jun")=="farm": worked.liu_jun=true
		if tick%48==47:
			var stage:={"tick":w.data.tickCount,"proposal":proposal.status,"completion":complete_tick,"appointment":appointment.state,"returned":returned_tick,"missed":missed_tick,"missed_home":missed_home,"second_offer":second_offer}
			stages.append(stage);print(JSON.stringify(stage))
	check(executed_tick>=0 and proposal.status=="executed","normal daily mayor approval is actually executed")
	check(equal(paid,{"wood":10.0,"stone":15.0,"tools":2.0}),"only original irrigation costs are charged at execution")
	check(complete_tick>executed_tick and w.data.buildings.completed.filter(func(p): return p.get("buildingKey")=="farm_irrigation").size()==1,"normal daily work completes one irrigation project")
	check(m.layout.work_sites.has("farm") and worked.has("liu_jun"),"farmer actually walks to completed farm workplace and works")
	check(reload_ok,"mid-run native reload preserves positions and accepted appointment")
	check(met_tick>=0 and met_tick<initial_until and int(appointment.until)==initial_until,"moving player and original mayor physically meet within unchanged deadline")
	check(returned_tick>met_tick,"mayor actually returns to assigned home after meeting")
	check(first_wait>=0 and missed_tick==first_until and first_record.get("npc_arrived",false),"stationary absent player causes truthful expiry after NPC actually waits")
	check(missed_home>missed_tick and second_offer>missed_home,"resident physically returns home before separate subsequent invitation")
	check(terminal_reload,"missed state and positions survive native reload with no repeated memory or settlement")
	check(w.quest_balance.appointments.history.size()==2 and equal(w.quest_balance.appointments.history[0],first_record) and w.quest_balance.appointments.history[1].state=="met","old missed record stays immutable beside exactly one new successful meeting")
	check(initial_jobs.keys().all(func(id): return id=="player" or slept.has(id)) and bad_sleep.is_empty(),"all original residents sleep at their real homes, never remotely")
	check(maximum_npc<1.001 and maximum_player<=1.201 and invalid_steps.is_empty(),"all movement frames and scene refreshes stay walkable without teleport")
	check(negative_stock.is_empty() and w.supply_enabled,"public stock remains nonnegative with existing supply controls enabled")
	var jobs_same:=true
	for id in initial_jobs:
		if w.data.agents[id].jobKey!=initial_jobs[id]: jobs_same=false
	check(jobs_same and w.data.agents.yang_feng._guardShift=="day" and w.data.agents.gao_lang._guardShift=="night","original jobs and day/night guards remain intact")
	var report:={"checks":checks,"failures":failures,"ticks":480,"missed_tick":missed_tick,"first_wait_tick":first_wait,"missed_home_tick":missed_home,"second_offer_tick":second_offer,"first_appointment":first_record,"motion_frames_per_tick":m.frames_per_tick(),"initial_stock":initial_stock,"paid":paid,"executed_tick":executed_tick,"complete_tick":complete_tick,"met_tick":met_tick,"returned_tick":returned_tick,"sleepers":slept.keys(),"worked":worked.keys(),"maximum_npc_step":maximum_npc,"maximum_player_step":maximum_player,"invalid_steps":invalid_steps,"bad_sleep":bad_sleep,"negative_stock":negative_stock,"stages":stages,"final_appointment":appointment,"scope":"original frontier resources/jobs/needs/positions, traveler proposal and daily mayor review, real execution UI and normal daily construction, mock AI offer and acceptance, 480 clock ticks with 480 motion frames each, player collision walking during clock progression, native reload, first player absence, actual home return, fresh local offer and second physical meeting, terminal reload, farm work/home sleep; no granted resources, elected fixture, compressed midnight or production AI"}
	if failures.is_empty():
		var destination:=ProjectSettings.globalize_path("res://../../../outputs/五日施工與邀約驗收.rimtown")
		FileAccess.open(destination,FileAccess.WRITE).store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())))
	FileAccess.open("res://docs/APPOINTMENT_LIFECYCLE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

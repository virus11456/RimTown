extends "res://tests/test_dual_town_frontier.gd"
var route: Array=[]
var route_index:=0
var route_goal:=""
func walk(app: Node,location: String) -> void:
	var m: SimMotion=app.motion;var p: Dictionary=m.positions.player
	var job:=str(app.simulation.data.agents.player.get("jobKey",""))
	if job in SimWorkstation.JOBS and location==SimWorkstation.LOCATIONS[job]:
		if app.station_approach.job.is_empty() and not SimWorkstation.error(m,job).is_empty():
			var tasks:=SimCareers.available(app.simulation)
			if not tasks.is_empty(): app.station_approach.begin(app.simulation,m,str(tasks[0].id),job)
		app.station_approach.step(app.simulation,m,Vector2.ZERO,1.0/60)
		var actual:=SimCareerPresence.place(m,"player")
		if not actual.is_empty(): app.simulation.data.agents.player.currentLocation=actual
		app._validate_career_presence();return
	app.station_approach.clear()
	if location!=route_goal:
		route_goal=location;route_index=0;route=m.pathfinder.find_path(Vector2(p.x,p.y),m.layout._nearest(m.layout._center(location)))
	if route_index<route.size():
		var delta:=Vector2(route[route_index].x,route[route_index].y)-Vector2(p.x,p.y)
		if delta.length()<2: route_index+=1;m.move_player(Vector2.ZERO,1.0/60)
		else: m.move_player(delta.normalized(),minf(1.0/60,delta.length()/72.0))
	else: m.move_player(Vector2.ZERO,1.0/60)
	var actual:=SimCareerPresence.place(m,"player")
	if not actual.is_empty(): app.simulation.data.agents.player.currentLocation=actual
	app._validate_career_presence()
func run() -> void:
	var town:="harbor" if "--harbor" in OS.get_cmdline_user_args() else "frontier"
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.load_demo(town)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion;m.manual_player=true
	var id:="hb_achao" if town=="harbor" else "chen_wei"
	var original: Array=w.data.agents.keys();var slept: Dictionary={};var bad_sleep: Array=[];var negative: Array=[]
	var site:=Vector2i(-1,-1)
	for candidate in BuildingSites.candidates(w.data):
		if BuildingSites.vacant(w,candidate): site=candidate;break
	var stock: Dictionary=w.data.stockpile.duplicate(true);SimBuildings.start(w,"farm_irrigation",false,site)
	check(equal(stock,w.data.stockpile) and not SimGovernance.direct(w),"career traveler cannot bypass public construction approval")
	app.show_tab("居民",true);app.show_appointment(id);press(app.drawer_body,"詢問明天能否見面");press(app.drawer_body,"接受邀約")
	check(SimAppointments.current(w).get("state")=="accepted","original resident appointment explicitly accepted")
	var cancelled:=false;var attempting_cancel:=false;var completed: Dictionary={};var paid: Dictionary={};var reloaded:=false;var work_reloaded:=false;var capped:=false;var days: Dictionary={}
	var cap_days: Array=[]
	var finished_project:=-1;var desired:="town_square";var meeting_tick:=-1
	for tick in 384:
		app._tick_simulation();audit(m)
		var b:=SimCareers.book(w);var proposal: Dictionary=SimGovernance.book(w).proposals[0]
		if attempting_cancel and b.active.is_empty():
			cancelled=true;attempting_cancel=false
			check(b.used==0 and b.completed==0,"walking away cancels first patrol without XP or daily credit")
		if proposal.status=="approved":
			var before: Dictionary=w.data.stockpile.resources.duplicate(true);app.show_governance();press(app.drawer_body,"執行核准案 #%d"%int(proposal.id))
			if proposal.status=="executed":
				for key in ["wood","stone","tools"]: paid[key]=float(before.get(key,0))-SimEconomy.amount(w,key)
		if w.data.buildings.completed.any(func(p): return p.get("buildingKey")=="farm_irrigation"): finished_project=int(w.data.tickCount) if finished_project<0 else finished_project
		var appointment:=SimAppointments.current(w)
		if appointment.get("state")=="met" and meeting_tick<0: meeting_tick=int(w.data.tickCount)
		var due_soon: bool=appointment.get("state") in ["accepted","waiting"] and int(w.data.tickCount)>=int(appointment.due)-8
		if due_soon: desired=str(appointment.place)
		elif not b.active.is_empty(): desired="quarry" if attempting_cancel else str(b.active.location)
		else:
			var job:="carpenter" if w.data.townMap.locations.has("workshop") and not w.data.buildings.projects.is_empty() and int(SimCareerProgress.progress(w,"carpenter").completed)<1 else "guard"
			if w.data.agents.player.jobKey!=job:
				app.show_careers();press(app.drawer_body,"登記："+str(SimCareers.JOBS[job].name))
			var tasks:=SimCareers.available(w)
			if not cancelled: tasks=tasks.filter(func(t): return t.location=="town_square")
			elif job=="guard" and not b.visits.has("quarry"): tasks=tasks.filter(func(t): return t.location=="quarry")
			if not tasks.is_empty() and int(b.used)<3:
				var task: Dictionary=tasks[0];desired=str(task.location)
				if SimCareerPresence.task_error(m,task).is_empty():
					app.show_careers();press(app.drawer_body,"開始："+str(task.label))
					if not b.active.is_empty() and not cancelled: attempting_cancel=true;desired="quarry"
					if not b.active.is_empty() and cancelled and not work_reloaded:
						var snapshot: Dictionary=app.progress_snapshot();var positions:=m.positions.duplicate(true);var active: Dictionary=b.active.duplicate(true)
						app._load_document(JSON.stringify(snapshot),"active career work reload");b=SimCareers.book(w)
						work_reloaded=equal(active,b.active) and equal(positions,m.positions)
			if int(b.used)>=3:
				var total:=int(b.completed);var after:=w.snapshot()
				if not tasks.is_empty() and b.day not in cap_days:
					check(not SimCareers.start(w,tasks[0].id).ok and equal(after,w.snapshot()),"three-per-day cap refuses further work");cap_days.append(b.day)
				capped=total>=3
		for frame in m.frames_per_tick():
			m.update(w.data.agents);walk(app,desired);audit(m)
			SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
		for key in original:
			if key=="player": continue
			if w.data.agents[key].activity=="sleeping":
				if SimHomeRest.arrived(w,w.data.agents[key]): slept[key]=true
				elif bad_sleep.size()<10: bad_sleep.append({"id":key,"tick":w.data.tickCount})
		for resource in w.data.stockpile.resources:
			if float(w.data.stockpile.resources[resource])<0 and negative.size()<10: negative.append(resource)
		var day:=SimClock.total_days(w.data.clock);days[str(day)]=int(SimCareers.book(w).used)
		if tick==191:
			var save: Dictionary=app.progress_snapshot();var positions:=m.positions.duplicate(true);app._load_document(JSON.stringify(save),"career schedule day reload")
			reloaded=equal(positions,m.positions)
		if tick%96==95: print(JSON.stringify({"town":town,"tick":w.data.tickCount,"completed":SimCareers.book(w).completed,"met":meeting_tick,"project":finished_project}))
	for job in ["guard","carpenter"]: completed[job]=SimCareerProgress.progress(w,job).completed
	check(cancelled and work_reloaded and reloaded,"physical cancellation and both active-work/day reloads exercised")
	check(completed.guard>0 and completed.carpenter==(1 if w.data.townMap.locations.has("workshop") else 0),"real walking produces distinct patrol and construction assistance progress")
	check(capped and days.values().all(func(n): return int(n)<=3),"daily cap remains shared across career changes")
	check(meeting_tick>0 and SimAppointments.current(w).state=="met","career work coexists with real resident appointment")
	check(equal(paid,{"wood":10.0,"stone":15.0,"tools":2.0}) and finished_project>72,"original-priced construction completes through daily work and actual carpenter help")
	check(original.all(func(key): return key=="player" or slept.has(key)) and bad_sleep.is_empty(),"all original residents sleep at actual homes")
	check(maximum_npc<1.001 and maximum_player<=1.201 and invalid_steps.is_empty() and negative.is_empty(),"no teleport blocked cells or negative resources")
	var report:={"checks":checks,"failures":failures,"town":town,"ticks":384,"motion_frames":384*m.frames_per_tick(),"career_completed":completed,"daily_used":days,"paid":paid,"project_complete_tick":finished_project,"meeting_tick":meeting_tick,"cancelled":cancelled,"active_reload":work_reloaded,"day_reload":reloaded,"sleepers":slept.keys(),"bad_sleep":bad_sleep,"invalid_steps":invalid_steps,"negative_stock":negative,"max_npc_step":maximum_npc,"max_player_step":maximum_player,"scope":"original town resources/resident routines, player registers carpenter/guard, requested station approach for carpenter, collision walks between job sites, leaves first patrol, native active work and day reload, shared cap, normal mayor approval and original costs, explicitly accepted resident appointment; no forced NPC needs/positions or AI requests"}
	FileAccess.open("res://docs/STATION_APPROACH_NATURAL_"+town.to_upper()+".json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report))
	if failures.is_empty(): FileAccess.open(ProjectSettings.globalize_path("res://../../../outputs/操作台四日_"+town+".rimtown"),FileAccess.WRITE).store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())))
	quit(0 if failures.is_empty() else 1)

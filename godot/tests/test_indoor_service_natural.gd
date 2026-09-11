extends "res://tests/test_dual_town_frontier.gd"
var indoor_attempts:=0
var indoor_finished:=0
var entered: Dictionary={}
var path: Array=[]
var index:=0
var goal:=Vector2.INF
var tracked: Dictionary={}
var outcomes: Array=[]
var work_count:=0
var attempts: Dictionary={"doctor":0,"priest":0}
var finished: Dictionary={"doctor":0,"priest":0}
var observed_needs: Dictionary={"doctor":{},"priest":{}}
func end_task(w: SimWorld) -> void:
	if tracked.is_empty() or not SimCareers.book(w).active.is_empty(): return
	var b:=SimCareers.book(w);var completed:=int(b.completed)>work_count
	if completed:
		finished[tracked.job]+=1
		if tracked.get("indoor",false): indoor_finished+=1
	outcomes.append({"tick":w.data.tickCount,"job":tracked.job,"target":tracked.target,"completed":completed,"reason":b.get("notice",""),"indoor":tracked.get("indoor",false)})
	tracked={};work_count=int(b.completed)
func follow(app: Node,id: String,frame: int) -> void:
	var m: SimMotion=app.motion;var p: Dictionary=m.positions.player
	if not m.positions.has(id): m.move_player(Vector2.ZERO,1.0/60);return
	var target: Dictionary=m.positions[id];var here:=Vector2(p.x,p.y);var there:=Vector2(target.x,target.y)
	if here.distance_to(there)<24 and SimCareerPresence.room(m,"player")==SimCareerPresence.room(m,id) and not SimCareerPresence.at_threshold(m,"player"): m.move_player(Vector2.ZERO,1.0/60);return
	if frame%60==0 and (goal==Vector2.INF or goal.distance_to(there)>16 or index>=path.size()):
		goal=there;path=m.pathfinder.find_path(here,m.layout._nearest(there));index=0
	if index<path.size():
		var delta:=Vector2(path[index].x,path[index].y)-here
		if delta.length()<2: index+=1;m.move_player(Vector2.ZERO,1.0/60)
		else: m.move_player(delta.normalized(),minf(1.0/60,delta.length()/72.0))
	else: m.move_player(Vector2.ZERO,1.0/60)
	var location:=SimCareerPresence.place(m,"player")
	if not location.is_empty(): app.simulation.data.agents.player.currentLocation=location
func run() -> void:
	var stress:= "--stress" in OS.get_cmdline_user_args()
	var total_ticks:=192 if stress else 384
	var town:="harbor" if "--harbor" in OS.get_cmdline_user_args() else "frontier"
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.load_demo(town)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion;m.manual_player=true
	if stress: SimFeuds._mood(w.data.agents["hb_achao" if town=="harbor" else "lin_mei"],w,-120)
	var original: Array=w.data.agents.keys();var slept: Dictionary={};var bad_sleep: Array=[];var negative: Array=[]
	var selected: Dictionary={};var reloaded:=false;var active_reloaded:=false;var daily: Dictionary={};var jobs: Dictionary={}
	for id in original: jobs[id]=w.data.agents[id].jobKey
	for tick in total_ticks:
		app._tick_simulation();audit(m);end_task(w)
		var b:=SimCareers.book(w)
		for id in w.data.agents:
			var a: Dictionary=w.data.agents[id]
			if id=="player" or a.get("isDead",false): continue
			if float(a.needs.rest)<=40: observed_needs.doctor[id]=true
			if float(a.mood)<0: observed_needs.priest[id]=true
		if not b.active.is_empty(): selected=b.active.duplicate(true)
		else:
			var job:="doctor"
			for id in w.data.agents:
				var a: Dictionary=w.data.agents[id]
				if id!="player" and not a.get("isDead",false) and a.activity!="sleeping" and float(a.mood)<0 and id not in b.get("counseled",[]): job="priest";break
			if w.data.agents.player.jobKey!=job: app.show_careers();press(app.drawer_body,"登記："+str(SimCareers.JOBS[job].name))
			var choices:=SimCareers.available(w).filter(func(t): return SimCareerPresence.place(m,str(t.target))==str(t.location))
			choices.sort_custom(func(a,b): return m.layout.houses.has(SimCareerPresence.room(m,str(a.target))) and not m.layout.houses.has(SimCareerPresence.room(m,str(b.target))))
			if int(b.used)>=3: choices=[]
			if not selected.is_empty() and choices.any(func(t): return t.id==selected.id): pass
			else:
				selected={} if choices.is_empty() else choices[0].duplicate(true);goal=Vector2.INF
			if not selected.is_empty() and app._career_presence_error(selected).is_empty():
				app.show_careers();press(app.drawer_body,"開始："+str(selected.label))
				if not b.active.is_empty():
					attempts[selected.job]+=1;tracked=selected.duplicate(true);work_count=int(b.completed)
					tracked.indoor=m.layout.houses.has(SimCareerPresence.room(m,str(selected.target)))
					if tracked.indoor: indoor_attempts+=1
		if not b.active.is_empty() and not active_reloaded:
			var progress: Dictionary=app.progress_snapshot();var points:=m.positions.duplicate(true);var active: Dictionary=b.active.duplicate(true)
			app._load_document(JSON.stringify(progress),"natural active service reload")
			active_reloaded=equal(points,m.positions) and equal(active,SimCareers.book(w).active)
		for frame in m.frames_per_tick():
			m.update(w.data.agents)
			if not selected.is_empty(): follow(app,str(selected.target),frame)
			else: m.move_player(Vector2.ZERO,1.0/60)
			app._validate_career_presence();audit(m)
			if not selected.is_empty():
				var room:=SimCareerPresence.room(m,"player")
				if m.layout.houses.has(room) and room==SimCareerPresence.room(m,str(selected.target)): entered[room]=true
			SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
		end_task(w)
		for id in original:
			if id=="player": continue
			if w.data.agents[id].activity=="sleeping":
				if SimHomeRest.arrived(w,w.data.agents[id]): slept[id]=true
				elif bad_sleep.size()<10: bad_sleep.append({"id":id,"tick":w.data.tickCount})
		for resource in w.data.stockpile.resources:
			if float(w.data.stockpile.resources[resource])<0 and negative.size()<10: negative.append(resource)
		daily[str(SimClock.total_days(w.data.clock))]=int(SimCareers.book(w).used)
		if tick==191:
			var points:=m.positions.duplicate(true);app._load_document(JSON.stringify(app.progress_snapshot()),"natural service day reload");reloaded=equal(points,m.positions)
		if tick%96==95: print(JSON.stringify({"town":town,"tick":w.data.tickCount,"attempts":attempts,"finished":finished,"needs":{"doctor":observed_needs.doctor.size(),"priest":observed_needs.priest.size()}}))
	check(not entered.is_empty() and indoor_attempts>0,"natural needs lead to walking into occupied homes and starting service")
	if stress: check(attempts.priest>0 and finished.priest>0,"one controlled mood setback leads to actual walking companionship completion")
	else: check(observed_needs.doctor.size()>0 and attempts.doctor>0 and finished.doctor>0,"original residents develop real fatigue and actual walking service can complete")
	check(reloaded and active_reloaded,"natural active service and mid-run reload preserve state")
	check(daily.values().all(func(n): return int(n)<=3),"shared daily service cap respected")
	check(original.all(func(id): return id=="player" or jobs[id]==w.data.agents[id].jobKey),"original NPC jobs preserved")
	check(original.all(func(id): return id=="player" or slept.has(id)) and bad_sleep.is_empty(),"original residents sleep at their own homes")
	check(maximum_npc<1.001 and maximum_player<=1.201 and invalid_steps.is_empty() and negative.is_empty(),"natural walking has no teleport obstruction or negative stock")
	var report:={"checks":checks,"failures":failures,"indoor_attempts":indoor_attempts,"indoor_finished":indoor_finished,"entered_houses":entered.keys(),"town":town,"ticks":total_ticks,"controlled_mood_setback":stress,"motion_frames":total_ticks*m.frames_per_tick(),"attempts":attempts,"finished":finished,"observed_need_ids":{"doctor":observed_needs.doctor.keys(),"priest":observed_needs.priest.keys()},"outcomes":outcomes,"daily_used":daily,"active_reload":active_reloaded,"day_reload":reloaded,"sleepers":slept.keys(),"bad_sleep":bad_sleep,"invalid_steps":invalid_steps,"negative_stock":negative,"max_npc_step":maximum_npc,"max_player_step":maximum_player,"scope":("one resident initial mood modifier -120; subsequent needs, schedules and movement unchanged, no forced positions; " if stress else "")+"original town needs/jobs, normal simulation, player chooses available service and collision walks to current target including occupied homes, no later forced NPC needs/positions or freeze, native reload; no natural priest completion claim if no suitable demand arises"}
	FileAccess.open("res://docs/INDOOR_SERVICE_"+("STRESS_" if stress else "NATURAL_")+town.to_upper()+".json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report))
	if failures.is_empty() and not stress: FileAccess.open(ProjectSettings.globalize_path("res://../../../outputs/室內服務四日_"+town+".rimtown"),FileAccess.WRITE).store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())))
	quit(0 if failures.is_empty() else 1)

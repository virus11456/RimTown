extends "res://tests/test_dual_town_frontier.gd"
const ROLES := ["cook","tailor","blacksmith","researcher"]
func run() -> void:
	var town:="harbor" if "--harbor" in OS.get_cmdline_user_args() else "frontier"
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.load_demo(town)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion;m.manual_player=true
	var original: Array=w.data.agents.keys();var slept: Dictionary={};var bad_sleep: Array=[];var negative: Array=[]
	var completed: Dictionary={};var attempts: Dictionary={};var unavailable: Dictionary={};var days: Dictionary={};var starts: Array=[];var reloads:=0
	var pending: Dictionary={}
	for role in ROLES: completed[role]=0;attempts[role]=0;unavailable[role]=0
	for tick in 384:
		app._tick_simulation();audit(m)
		var b:=SimCareers.book(w)
		for role in ROLES: completed[role]=SimCareerProgress.progress(w,role).completed
		if b.active.is_empty() and int(b.used)<3:
			if pending.is_empty() or str(w.data.agents.player.jobKey)!=str(pending.job) or not SimCareers.available(w).any(func(t):return t.id==pending.id):
				pending={};app.station_approach.clear()
				var choices: Array=ROLES.duplicate();choices.sort_custom(func(a,c):return float(completed[a])<float(completed[c]))
				for role in choices:
					SimCareers.enroll(w,role)
					var tasks:=SimCareers.available(w)
					if tasks.is_empty(): unavailable[role]+=1;continue
					if SimCareers.PRODUCTION.has(role):
						SimCareers.request_materials(w,role)
						if not SimCareers.material_permit(w,role) or not SimBuildings.affordable(w,SimCareers.recipe(role).inputs): unavailable[role]+=1;continue
					pending=tasks[0];break
			if not pending.is_empty():
				if SimCareerPresence.task_error(m,pending).is_empty():
					attempts[pending.job]+=1
					var started:=SimCareers.start(w,pending.id)
					if started.ok:
						starts.append({"job":pending.job,"tick":w.data.tickCount,"used":b.used})
						check(not SimCareers.PRODUCTION.has(pending.job) or SimCareers.material_permit(w,pending.job),"production starts only with real material approval")
						if reloads==0:
							m.move_player(Vector2.ZERO,0);SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
							var save: Dictionary=app.progress_snapshot();var active: Dictionary=b.active.duplicate(true)
							app._load_document(JSON.stringify(save),"active production reload")
							check(equal(active,SimCareers.book(w).active),"active task survives reload");reloads+=1
						pending={}
				elif app.station_approach.job.is_empty(): app.station_approach.begin(w,m,pending.id,pending.job)
		for frame in m.frames_per_tick():
			m.update(w.data.agents)
			app.station_approach.step(w,m,Vector2.ZERO,1.0/60)
			var actual:=SimCareerPresence.place(m,"player")
			if not actual.is_empty(): w.data.agents.player.currentLocation=actual
			app._validate_career_presence();audit(m)
			SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
		check(int(SimCareers.book(w).used)<=3,"shared daily quota remains capped")
		days[str(SimClock.total_days(w.data.clock))]=SimCareers.book(w).used
		for id in original:
			if id!="player" and w.data.agents[id].activity=="sleeping":
				if SimHomeRest.arrived(w,w.data.agents[id]): slept[id]=true
				elif bad_sleep.size()<10: bad_sleep.append({"id":id,"tick":w.data.tickCount})
		for r in w.data.stockpile.resources:
			if float(w.data.stockpile.resources[r])<0 and negative.size()<10: negative.append(r)
		if tick==191:
			m.move_player(Vector2.ZERO,0);SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
			var save: Dictionary=app.progress_snapshot();var feet: Dictionary=m.positions.duplicate(true)
			app._load_document(JSON.stringify(save),"production day reload");check(equal(feet,m.positions),"mid-run reload keeps physical locations");reloads+=1
		if tick%96==95: print(JSON.stringify({"town":town,"tick":w.data.tickCount,"completed":completed,"starts":starts.size()}))
	for role in ROLES: completed[role]=SimCareerProgress.progress(w,role).completed
	check(reloads==2,"active and mid-run reload covered")
	check(maximum_player<=1.201 and maximum_npc<1.001 and invalid_steps.is_empty() and negative.is_empty(),"movement and stock remain valid")
	check(bad_sleep.is_empty() and original.all(func(id):return id=="player" or slept.has(id)),"all original residents sleep at home")
	check(completed.cook>0 and completed.researcher>0,"both towns naturally complete cooking and research")
	if town=="frontier": check(completed.tailor>0 and completed.blacksmith>0,"existing workshop enables both crafts")
	else: check(completed.tailor==0 and completed.blacksmith==0,"missing workshop stays missing")
	var report:={"town":town,"checks":checks,"failures":failures,"ticks":384,"motion_frames":184320,"completed":completed,"attempts":attempts,"unavailable_samples":unavailable,"starts":starts,"daily_used":days,"reloads":reloads,"sleepers":slept.keys(),"bad_sleep":bad_sleep,"negative_stock":negative,"invalid_steps":invalid_steps,"maximum_player_step":maximum_player,"maximum_npc_step":maximum_npc,"scope":"original town resources, natural demand and NPC routines, player rotates least-completed eligible cooking/craft/research roles, normal permit requests and daily approval, actual station approach, active/day reload; no forced stock/needs/projects/facilities"}
	FileAccess.open("res://docs/FOOT_SUPPORT_NATURAL_"+town.to_upper()+".json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report))
	if failures.is_empty(): FileAccess.open(ProjectSettings.globalize_path("res://../../../outputs/步行四日_"+town+".rimtown"),FileAccess.WRITE).store_buffer(SaveArchive.encode(JSON.stringify(app.progress_snapshot())))
	quit(0 if failures.is_empty() else 1)

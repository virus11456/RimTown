extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
 var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
 var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
 for town in ["frontier","harbor"]:
  for pace in ["original","relaxed"]:
   app.load_demo(town);app.set_clock_pace(pace)
   var w: SimWorld=app.simulation;var m: SimMotion=app.motion
   var before: Dictionary=w.snapshot().duplicate(true);var guards: Dictionary={}
   for id in w.data.agents:
    var a: Dictionary=w.data.agents[id]
    if a.jobKey=="guard":guards[id]=SimWorkSchedule.job(a,w.rules.jobs).duplicate(true)
   SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
   check(equal(before,w.snapshot()),"schedule refresh is idempotent "+town+pace)
   for id in w.data.agents:
    var a: Dictionary=w.data.agents[id]
    if a.jobKey!="doctor" or a.get("isPlayer",false):continue
    var job:=SimWorkSchedule.job(a,w.rules.jobs);var sleep:=SimShiftSleep.window(a,w.rules.jobs)
    check(equal(job.work_hours,[12,22]) and equal(w.rules.jobs.doctor.work_hours,[8,18]),"NPC afternoon shift leaves source rules unchanged")
    check(posmod(int(job.work_hours[1])-int(job.work_hours[0]),24)==10,"doctor retains ten-hour duration")
    check(sleep.duration==SimShiftSleep.preferred(a).duration,"doctor retains full preferred sleep duration")
    check(not SimWorkSchedule.working(job,11) and SimWorkSchedule.working(job,12) and SimWorkSchedule.working(job,21) and not SimWorkSchedule.working(job,22),"noon opening and 22 closing boundaries")
    var provider: Dictionary=a.duplicate(true);provider.needs.hunger=80;provider.needs.rest=80;provider.personality.traits=["night_owl"]
    provider._shiftSleep=SimShiftSleep.choose(provider,job,1)
    provider._shiftSleep.merge({"job":"doctor","hours":job.work_hours,"workplace":job.workplace,"traits":provider.personality.traits})
    w._activity(provider,21);check(provider.activity==("working" if w.data.townMap.locations.has(job.workplace) else "waiting_workplace"),"late clinic shift honors duty or missing workplace instead of optional night wandering")
    provider.needs.rest=9;w._activity(provider,21);check(provider.activity=="sleeping","urgent rest overrides late clinic shift")
    var custom: Dictionary=w.rules.jobs.duplicate(true);custom.doctor.work_hours=[9,15]
    check(equal(SimWorkSchedule.job(a,custom).work_hours,[9,15]),"custom doctor hours remain respected")
    provider.isPlayer=true;check(equal(SimWorkSchedule.job(provider,w.rules.jobs).work_hours,[8,18]),"player doctor hours not silently changed")
    provider.isPlayer=false;provider.jobKey="farmer";w.data.agents[id]=provider
    SimWorkSchedule.refresh(w,m);check(not provider.has("_careShift"),"job change clears old doctor shift")
    w.data.agents[id]=a;SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
   for id in guards:check(equal(guards[id],SimWorkSchedule.job(w.data.agents[id],w.rules.jobs)),"existing day/night guard shift retained "+id)
   var saved: Dictionary=app.progress_snapshot();var jobs: Dictionary={}
   for id in w.data.agents:jobs[id]=SimWorkSchedule.job(w.data.agents[id],w.rules.jobs).duplicate(true)
   app._load_document(JSON.stringify(saved),"afternoon shift reload")
   check(jobs.keys().all(func(id):return equal(jobs[id],SimWorkSchedule.job(w.data.agents[id],w.rules.jobs))),"effective schedule stable after reload")
   check(app.clock_pace()==pace,"schedule change does not enable relaxed clock automatically")
 var report:={"checks":checks,"failures":failures,"scope":"two towns at both clock paces; ten-hour afternoon NPC doctor shift, full sleep, late duty with urgent-rest priority, custom hours and player untouched, job cleanup, guard rosters and reload"}
 FileAccess.open("res://docs/CARE_SHIFT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

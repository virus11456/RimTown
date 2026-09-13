extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
 var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
 var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false);app.load_demo("harbor");app.motion.manual_player=true
 var w: SimWorld=app.simulation;var m: SimMotion=app.motion;var counts: Dictionary={};var hourly: Dictionary={};var examples: Dictionary={};var results: Dictionary={};var jobs: Dictionary={}
 for id in w.data.agents:jobs[id]=w.data.agents[id].jobKey
 for tick in 384:
  app._tick_simulation()
  var before: Dictionary=w.snapshot().duplicate(true) if tick in [0,191,383] else {}
  for provider in w.data.agents:
   var b: Dictionary=w.data.agents[provider]
   if b.get("isDead",false) or b.jobKey not in ["doctor","priest"]:continue
   for id in w.data.agents:
    var a: Dictionary=w.data.agents[id]
    if id==provider or a.get("isPlayer",false) or a.get("isDead",false):continue
    var stage:="沒有這類需求"
    if SimResidentCare.needed(a,b.jobKey):
     stage="需求存在，居民有優先安排" if not SimResidentCare.eligible(w,id) else "需求存在，服務者尚未可接待"
     if SimResidentCare.eligible(w,id) and SimResidentCare.provider_ready(w,m,provider):
      var goal:=SimResidentCare.meeting_goal(m,b)
      stage=SimResidentCare.feasibility(w,a,b,goal) if goal.is_finite() else "沒有接待位置"
      if stage.is_empty():stage="直接行程可行"
      if stage==SimResidentCare.RECOVERY_REASON:
       var access:=SimResidentCare.recovery_access(w,a,b,goal)
       stage=str(access.reason)
       if stage.is_empty():stage=str(SimResidentCare.recovery_plan(w,a,int(access.duration)).reason)
       if stage.is_empty():stage="可進一步準備"
    var key:=str(b.jobKey)+"："+stage
    counts[key]=int(counts.get(key,0))+1
    var hour_key:=str(w.data.clock.hour)+"："+key;hourly[hour_key]=int(hourly.get(hour_key,0))+1
    if not examples.has(key):examples[key]={"tick":w.data.tickCount,"hour":w.data.clock.hour,"minute":w.data.clock.minute,"recipient":id,"provider":provider,"hunger":a.needs.hunger,"rest":a.needs.rest,"activity":a.activity}
  if not before.is_empty():check(equal(before,w.snapshot()),"audit does not change world state")
  for id in w.data.agents:
   for r in w.data.agents[id].get("_careResults",[]):results[str(id)+":"+str(r.tick)]=r
  for frame in 480:
   m.update(w.data.agents);SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
  if tick%96==95:print(JSON.stringify({"day":(tick+1)/96,"results":results.size()}))
 check(jobs.keys().all(func(id):return w.data.agents[id].jobKey==jobs[id]),"natural audit preserves jobs and shifts")
 var report:={"checks":checks,"failures":failures,"counts":counts,"hourly":hourly,"first_examples":examples,"care_results":results,"ticks":384,"scope":"four original harbor days with 480 physical frames per tick; unchanged shifts/resources/needs; counts are recipient-provider-tick observations, not unique people or completed services"}
 FileAccess.open("res://docs/CARE_TIMING_AUDIT.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

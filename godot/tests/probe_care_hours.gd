extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
 var app: Node=load("res://scenes/main.tscn").instantiate();root.add_child(app);await process_frame;app.set_process(false);app.load_demo("harbor");app.motion.manual_player=true
 var w: SimWorld=app.simulation;var m: SimMotion=app.motion
 if "--late" in OS.get_cmdline_user_args(): w.rules.jobs.doctor.work_hours=[10,20]
 var results: Dictionary={};var deferred: Dictionary={};var requests: Dictionary={};var recoveries: Dictionary={}
 for tick in 384:
  app._tick_simulation()
  for id in w.data.agents:
   var a: Dictionary=w.data.agents[id]
   if a.has("_careVisit"):requests[str(id)+":"+str(a._careVisitDay)]=a._careVisit.duplicate(true)
   if a.has("_careDeferred"):deferred[str(id)+":"+str(a._careDeferred.day)]=a._careDeferred.duplicate(true)
   for r in a.get("_careResults",[]):results[str(id)+":"+str(r.tick)]=r
   if a.has("_careRecovery"):recoveries[str(id)+":"+str(a._careRecovery.day)]=true
  for frame in 480:
   m.update(w.data.agents);SimAppointments.observe(w,m);SimLeisurePlan.observe(w,m);SimHangoutVisits.observe(w,m)
 print(JSON.stringify({"results":results,"deferred":deferred,"requests":requests,"recoveries":recoveries}));quit()

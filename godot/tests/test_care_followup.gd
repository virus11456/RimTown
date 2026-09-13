extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func walk(m: SimMotion,a: Dictionary,agents: Dictionary) -> void:
 for frame in 20000:
  m.update(agents)
  if not m.positions[str(a.id)].walking and m.positions[str(a.id)].get("doorPhase")==null:break
func run() -> void:
 var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
 var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
 for town in ["frontier","harbor"]:
  for role in ["doctor","priest"]:
   var pair: Dictionary=Fixture.prepare(app,town,role);var w: SimWorld=app.simulation;var m: SimMotion=app.motion
   w.social_enabled=true;w.social.observe_positions(m);SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
   var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
   # Controlled off-duty worker with a real care need, not a fabricated receipt.
   a.jobKey="trader";w.rules.jobs.trader.work_hours=[6,10];b.needs.hunger=100;b.needs.rest=100
   SimResidentCare.tick(w);check(a.has("_careVisit"),"accept care for off-duty worker "+town+role)
   if not a.has("_careVisit"):continue
   SimResidentCare.apply(w,a,w.runtime[pair.recipient]);walk(m,a,w.data.agents)
   for tick in 3:w.data.tickCount+=1;SimResidentCare.tick(w)
   check(a.get("_careResults",[]).size()==1 and a._careResults.back().state=="completed","real arrival and dwell produce receipt")
   if a.get("_careResults",[]).is_empty() or not a._careResults.back().has("followup"):
    print(JSON.stringify({"case":town+role,"results":a.get("_careResults",[]),"notice":a.get("_careVisitNotice","")}));continue
   var event: Dictionary=a._careResults.back();var f: Dictionary=event.followup
   check(f.until==event.tick+96 and f.expects_work,"completion starts bounded followup")
   SimResidentCare.observe_care_followup(w,a);check(not f.has("next"),"completion tick is not the next tick")
   var needs: Dictionary=a.needs.duplicate(true);var quota: Dictionary=b._careProvided.duplicate(true)
   a.activity="working";a.currentLocation=w.rules.jobs.trader.workplace;w.data.tickCount+=1
   var positions: Dictionary=m.positions.duplicate(true);SimResidentCare.observe_care_followup(w,a)
   check(f.has("next") and not f.has("home") and not f.has("work"),"work intention while still at clinic is not arrival")
   check(equal(positions,m.positions) and equal(needs,a.needs) and equal(quota,b._careProvided),"observer does not move residents or grant effects")
   var observed: Dictionary=f.duplicate(true);SimResidentCare.observe_care_followup(w,a);check(equal(observed,f),"same-tick observation is idempotent")
   var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"care followup reload");w=app.simulation;m=app.motion;a=w.data.agents[pair.recipient];b=w.data.agents[pair.provider];f=a._careResults.back().followup
   check(equal(observed,f),"reload retains evidence and fixed deadline")
   w.rules.jobs.trader.work_hours=[8,18]
   a.activity="working";a.currentLocation=w.rules.jobs.trader.workplace;walk(m,a,w.data.agents);w.data.clock.hour=13;w.data.tickCount+=1
   SimResidentCare.observe_care_followup(w,a)
   check(f.has("work") and f.work.job=="trader" and not f.has("home"),"ordinary walk to actual work point records work only")
   a.activity="heading_home";a.currentLocation=a.homeLocation;w.data.tickCount+=1;SimResidentCare.observe_care_followup(w,a)
   check(not f.has("home"),"home intention is not arrival")
   walk(m,a,w.data.agents);w.data.tickCount+=1;SimResidentCare.observe_care_followup(w,a)
   check(f.has("home") and f.state=="finished","actual home arrival finishes worker followup")
   check(equal(needs,a.needs) and equal(quota,b._careProvided),"followup never pays twice")
   check(SimAgenda.routine(w,str(a.id)).any(func(row):return "到場工作" in row) and SimAgenda.routine(w,str(a.id)).any(func(row):return "實際到家" in row),"agenda separates actual milestones")
   var done: Dictionary=f.duplicate(true);w.data.tickCount+=100;SimResidentCare.observe_care_followup(w,a);check(equal(done,f),"finished evidence is immutable")
   saved=app.progress_snapshot();app._load_document(JSON.stringify(saved),"finished followup reload");w=app.simulation;m=app.motion;a=w.data.agents[pair.recipient]
   check(equal(done,a._careResults.back().followup),"finished reload does not restart tracking")
 # Historical / missing-position cases explicitly do not invent evidence.
 var w: SimWorld=app.simulation;var m: SimMotion=app.motion;var a: Dictionary=w.data.agents.values().filter(func(v):return not v.get("isPlayer",false))[0]
 var now: int=w.data.tickCount
 a._careResults=[{"state":"completed","tick":now-20,"provider":"old","job":"doctor","amount":15,"reason":"old"},{"state":"cancelled","tick":now-1,"followup":{"state":"observing","until":now+96}}]
 var old: Array=a._careResults.duplicate(true);SimResidentCare.observe_care_followup(w,a);check(equal(old,a._careResults),"old and cancelled receipts are not backfilled")
 a._careResults=[{"state":"completed","tick":now-3,"followup":{"state":"observing","until":now+2,"expects_work":true}}]
 var f: Dictionary=a._careResults.back().followup;var point: Dictionary=m.positions[str(a.id)].duplicate(true);m.positions.erase(str(a.id))
 SimResidentCare.observe_care_followup(w,a);check(not f.has("next") and not f.has("home") and not f.has("work"),"missing position invents no evidence")
 w.data.tickCount=now+3;SimResidentCare.observe_care_followup(w,a);check(f.state=="expired" and not f.has("home") and not f.has("work"),"deadline expires even without position")
 m.positions[str(a.id)]=point
 a._careResults=[{"state":"completed","tick":now,"followup":{"state":"observing","until":now+96}}];a.isDead=true;SimResidentCare.observe_care_followup(w,a)
 check(a._careResults.back().followup.state=="unavailable","unavailable resident stops tracking")
 var report:={"checks":checks,"failures":failures,"scope":"two towns and both care roles; real controlled care completion and physical walks to work/home, intent versus arrival, same-tick idempotence, fixed deadline, active/finished reload, no extra effects, old/cancelled receipts and unavailable observations"}
 FileAccess.open("res://docs/CARE_FOLLOWUP_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
 var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
 var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
 for town in ["frontier","harbor"]:
  for job in ["doctor","priest"]:
   var pair: Dictionary=Fixture.prepare(app,town,job);var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
   var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider];b.needs.hunger=100;b.needs.rest=100
   var house: Dictionary=m.layout.houses[m.layout._house_id(str(a.id),str(a.homeLocation))]
   var point:=m.layout._nearest(Vector2(house.interiorX,house.interiorY))
   m.positions[str(a.id)]={"x":point.x,"y":point.y,"targetX":point.x,"targetY":point.y,"walking":false,"doorPhase":null,"activity":"idle","walkStep":0}
   a.currentLocation=a.homeLocation;a.activity="idle";a.needs.hunger=25;a.needs.rest=30
   var day:=SimClock.total_days(w.data.clock);a._careRecoveryDay=day
   var before: Dictionary=w.snapshot().duplicate(true);var position: Dictionary=m.positions.duplicate(true)
   var plan:=SimResidentCare.recovery_plan(w,a,16)
   var displayed:=SimCareAvailability.reason(w,m,a,b,SimCareAvailability.status(w,m,b))
   check(str(plan.reason).contains("今天已用過") and displayed==plan.reason,"display and planner agree on exhausted daily preparation "+town+job)
   check(equal(before,w.snapshot()) and equal(position,m.positions),"checking refusal remains read-only")
   SimResidentCare.begin_recovery(w,a,16)
   check(not a.has("_careRecovery") and a._careVisitNotice.contains(str(plan.reason)),"actual refusal uses same explanation")
   check(not a.has("_careVisitDay"),"failed preparation does not spend treatment attempt")
   a._careRecoveryDay=day-1
   var available:=SimResidentCare.recovery_plan(w,a,16)
   check(str(available.reason).is_empty(),"previous day does not block preparation")
   SimResidentCare.begin_recovery(w,a,16)
   check(equal(available.task,a.get("_careRecovery",{})),"preview and accepted plan use identical deadlines and targets")
   var task: Dictionary=a._careRecovery.duplicate(true);var saved: Dictionary=app.progress_snapshot()
   app._load_document(JSON.stringify(saved),"preparation consistency reload");w=app.simulation;m=app.motion;a=w.data.agents[pair.recipient]
   check(equal(task,a._careRecovery),"accepted plan survives actual reload")
   app._tick_simulation();check(a.activity=="eating" and SimHomeRest.arrived(w,a),"accepted plan uses real home meal after reload")
   a.erase("_careRecovery");a.erase("_careRecoveryDay");a.needs.hunger=25;a.needs.rest=30
   for fault in ["hunger","rest","work","appointment","route","observation"]:
    var original: Dictionary=a.duplicate(true);var appointments: Dictionary=w.quest_balance.get("appointments",{}).duplicate(true)
    match fault:
     "hunger":a.needs.hunger=15
     "rest":a.needs.rest=10
     "work":a.jobKey=job
     "appointment":w.quest_balance.appointments={"current":{"npc":str(a.id),"state":"accepted","due":int(w.data.tickCount)+2,"until":int(w.data.tickCount)+8}}
     "route":a.homeLocation="missing-home"
     "observation":w.social.observed_motion=null
    plan=SimResidentCare.recovery_plan(w,a,16)
    check(not str(plan.reason).is_empty(),"specific refusal "+fault)
    var needs: Dictionary=a.needs.duplicate(true)
    SimResidentCare.begin_recovery(w,a,16)
    check(not a.has("_careRecovery") and not a.has("_careRecoveryDay") and equal(needs,a.needs),"refusal gives no recovery or used day "+fault)
    check(a._careVisitNotice.contains(str(plan.reason)),"actual refusal matches preview "+fault)
    a.clear();a.merge(original);w.quest_balance.appointments=appointments;w.social.observe_positions(m)
 var report:={"checks":checks,"failures":failures,"scope":"two towns and care roles; read-only preparation preview matches daily-cap refusal and admitted plan, specific home safety/schedule/path failures, no grants or consumed opportunity, actual reload and at-home meal"}
 FileAccess.open("res://docs/CARE_PREPARATION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

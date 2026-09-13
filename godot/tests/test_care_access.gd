extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
 var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
 var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
 for town in ["frontier","harbor"]:
  for job in ["doctor","priest"]:
   var pair: Dictionary=Fixture.prepare(app,town,job)
   var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
   var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
   for id in w.data.agents:
    if id!=pair.recipient:w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
   b.needs.hunger=100;b.needs.rest=100
   var goal:=Vector2(m.positions[pair.recipient].x,m.positions[pair.recipient].y)
   var close: int=w.rules.jobs[job].work_hours[1]
   w.data.clock.hour=close-1;w.data.clock.minute=45;a.needs.hunger=25;a.needs.rest=30
   check(SimResidentCare.feasibility(w,a,b,goal).contains("下班"),"closing takes precedence over remediable hunger")
   var before: Dictionary=m.positions.duplicate(true);var stock: Dictionary=w.data.stockpile.duplicate(true)
   SimResidentCare.tick(w)
   check(not a.has("_careRecovery") and not a.has("_careRecoveryDay") and not a.has("_careVisitDay"),"closed opportunity consumes no recovery or care attempt")
   check(equal(before,m.positions) and equal(stock,w.data.stockpile),"rejection moves nobody and grants no resources")
   w.data.clock.hour=12;w.data.clock.minute=0
   var access:=SimResidentCare.recovery_access(w,a,b,goal)
   check(access.reason.is_empty(),"midday full preparation fits "+town+job)
   var house: Dictionary=m.layout.houses[m.layout._house_id(str(a.id),str(a.homeLocation))]
   var offset:=str(a.id).unicode_at(0)%4
   var home:=m.layout._nearest(Vector2(house.interiorX+(offset%2-.5)*16,house.interiorY+(floori(offset/2.0)-.5)*16))
   var expected:=ceili(SimResidentCare.route_from(m,str(a.id),b.currentLocation,goal,home)/m.travel_budget())+1+SimResidentCare.SERVICE_TICKS
   check(access.get("duration",0)==expected,"preparation uses onward route from actual home")
   w.data.clock.hour=close-2
   check(SimResidentCare.feasibility(w,a,b,goal)==SimResidentCare.RECOVERY_REASON,"direct nearby trip fits before close")
   check(not SimResidentCare.recovery_access(w,a,b,goal).reason.is_empty(),"home detour and recovery cannot fit same window")
   SimResidentCare.tick(w)
   check(not a.has("_careRecovery") and str(a.get("_careVisitNotice","")).contains("返家準備後"),"automatic deferral explains preparation delay")
   w.data.clock.hour=12
   var appointments: Dictionary=w.quest_balance.get("appointments",{}).duplicate(true)
   w.quest_balance.appointments={"current":{"npc":pair.recipient,"state":"accepted","due":int(w.data.tickCount)+6,"until":int(w.data.tickCount)+12}}
   check(not SimResidentCare.recovery_access(w,a,b,goal).reason.is_empty(),"preparation respects confirmed appointment")
   w.quest_balance.appointments=appointments
   b.needs.hunger=22
   check(str(SimResidentCare.recovery_access(w,a,b,goal).reason).contains("服務者"),"provider must remain able to receive after preparation")
   b.needs.hunger=100
   var budget: float=m.tick_seconds;m.tick_seconds=.05
   check(not SimResidentCare.recovery_access(w,a,b,goal).reason.is_empty(),"home onward trip keeps original four-hour cap")
   m.tick_seconds=budget
   check(equal(before,m.positions),"all estimates are read-only")
   m.positions[str(a.id)]={"x":home.x,"y":home.y,"targetX":home.x,"targetY":home.y,"walking":false,"doorPhase":null,"activity":"idle","walkStep":0}
   a.activity="idle";a.currentLocation=a.homeLocation;a.needs.hunger=25;a.needs.rest=30
   SimResidentCare.tick(w)
   check(a.has("_careRecovery") and not a.has("_careVisitDay"),"later safe window can prepare after rejected opportunity")
   if a.has("_careRecovery"):
    var saved: Dictionary=app.progress_snapshot();var task: Dictionary=a._careRecovery.duplicate(true)
    app._load_document(JSON.stringify(saved),"care access preparation reload");w=app.simulation;m=app.motion;a=w.data.agents[pair.recipient]
    check(equal(task,a._careRecovery) and SimHomeRest.arrived(w,a),"new preparation keeps targets deadline and physical home on reload")
    app._tick_simulation()
    check(a.activity=="eating" and SimHomeRest.arrived(w,a),"accepted preparation uses actual home meal")
    check(not a.has("_careVisitDay") and not a.has("_careProvided"),"preparation still does not count as treatment")
 var report:={"checks":checks,"failures":failures,"scope":"two towns and both care roles; closure before nutrition, full home preparation and onward route, provider needs, appointment, travel cap, read-only estimates and no wasted attempts"}
 FileAccess.open("res://docs/CARE_ACCESS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

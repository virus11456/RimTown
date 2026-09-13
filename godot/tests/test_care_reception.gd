extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
 var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
 var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
 for town in ["frontier","harbor"]:
  for role in ["doctor","priest"]:
   var pair: Dictionary=Fixture.prepare(app,town,role);var w: SimWorld=app.simulation;var m: SimMotion=app.motion
   w.social_enabled=true;w.social.observe_positions(m);SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
   var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
   b.needs.hunger=29;b.needs.rest=90;w.runtime[pair.recipient].moodModifier=-100
   for id in w.data.agents:
    if id!=pair.recipient:w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
   SimResidentCare.tick(w)
   check(a.has("_careVisit"),"controlled feasible request accepted "+town+role)
   if not a.has("_careVisit"):continue
   check(SimResidentCare.reception(w,pair.provider)==pair.recipient,"live request reserves real provider")
   var origin:=Vector2(m.positions[pair.provider].x,m.positions[pair.provider].y)
   var until: int=a._careVisit.until
   check("等待" in SimAgenda.current(w,m,pair.provider).text,"provider agenda tells whom they wait for")
   var saved: Dictionary=app.progress_snapshot()
   check(not saved.agents[pair.provider].has("_careReceptionHolding"),"no duplicate saved holding flag")
   app._load_document(JSON.stringify(saved),"reception travel reload");w=app.simulation;m=app.motion;a=w.data.agents[pair.recipient];b=w.data.agents[pair.provider]
   check(m.care_receptions.get(pair.provider)==pair.recipient and int(a._careVisit.until)==until,"load rebuilds reservation without extending deadline")
   w._update(pair.provider)
   check(b.activity=="working" and b.needs.hunger<29,"reserved provider stays at work without a free meal")
   for frame in m.frames_per_tick():m.update(w.data.agents)
   check(Vector2(m.positions[pair.provider].x,m.positions[pair.provider].y)==origin,"provider does not leave reception during physical frames")
   var arrived_reload:=false
   for tick in 8:
    app._tick_simulation()
    for frame in m.frames_per_tick():m.update(w.data.agents)
    if a.has("_careVisit") and a._careVisit.state=="visiting" and not arrived_reload:
     check("照護" in SimAgenda.current(w,m,pair.provider).text,"arrival changes provider agenda to actual care")
     var finish: int=a._careVisit.finish
     saved=app.progress_snapshot();app._load_document(JSON.stringify(saved),"reception service reload");w=app.simulation;m=app.motion;a=w.data.agents[pair.recipient];b=w.data.agents[pair.provider]
     check(m.care_receptions.get(pair.provider)==pair.recipient and a._careVisit.finish==finish,"in-progress care restores original finish")
     arrived_reload=true
    if not a.has("_careVisit"):break
   check(arrived_reload,"actual arrival observed through full simulation")
   check(a.get("_careResults",[]).any(func(row):return row.state=="completed"),"full simulation completes accepted care "+town+role)
   check(not m.care_receptions.has(pair.provider),"completion releases provider")
   check(int(b.get("_careProvided",{}).get("used",0))==1,"exactly one daily service recorded")
   var receipt: Array=a.get("_careResults",[]).duplicate(true)
   SimResidentCare.tick(w);check(equal(receipt,a.get("_careResults",[])),"no duplicate completion")
 for reason in ["closing","hunger","sleep","raid","player","expired","missing","disabled","changed_job","quota"]:
  var pair: Dictionary=Fixture.prepare(app,"harbor","doctor");var w: SimWorld=app.simulation;var m: SimMotion=app.motion
  w.social_enabled=true;w.social.observe_positions(m);SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
  var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
  b.needs.hunger=100;b.needs.rest=90
  SimResidentCare.tick(w);check(a.has("_careVisit"),"interruption fixture accepted "+reason)
  if not a.has("_careVisit"):continue
  match reason:
   "closing":w.data.clock.hour=int(SimWorkSchedule.job(b,w.rules.jobs).work_hours[1])
   "hunger":b.needs.hunger=19
   "sleep":b.needs.rest=9
   "raid":b._raidShelterUntil=w.data.tickCount+4
   "player":SimResidentCare.interrupt_for_player(w,pair.provider)
   "expired":w.data.tickCount=a._careVisit.until
   "missing":w.data.agents.erase(pair.recipient)
   "disabled":w.social_enabled=false
   "changed_job":b.jobKey="guard"
   "quota":b._careProvided={"day":SimClock.total_days(w.data.clock),"used":3}
  SimResidentCare.sync_receptions(w)
  check(not m.care_receptions.has(pair.provider),"necessary interruption releases reservation "+reason)
  var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"interrupted reception reload");w=app.simulation;m=app.motion
  check(not m.care_receptions.has(pair.provider),"load does not resurrect invalid reservation "+reason)
 var report:={"checks":checks,"failures":failures,"scope":"controlled two-town doctor/priest full simulation, physical provider station, travel and care reload, original deadlines, no free meals, once-only outcomes, ten interruption and stale-load cases"}
 FileAccess.open("res://docs/CARE_RECEPTION_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

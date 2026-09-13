extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
 var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
 var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
 for town in ["frontier","harbor"]:
  for job in ["doctor","priest"]:
   var pair: Dictionary=Fixture.prepare(app,town,job);var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social_enabled=true;w.social.observe_positions(m)
   var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
   b.needs.hunger=100;b.needs.rest=100
   var before: Dictionary=w.snapshot().duplicate(true);var positions: Dictionary=m.positions.duplicate(true)
   var rows:=SimCareAvailability.rows(w,m,pair.recipient);var row: Dictionary=rows.filter(func(r):return r.id==pair.provider)[0]
   check(row.status=="在現場，可重新評估接待" and row.reason.contains("初步可行"),"real nearby available care "+town+job)
   check(equal(before,w.snapshot()) and equal(positions,m.positions),"opening availability does not mutate simulation or positions")
   m.positions[pair.provider].walking=true
   check(SimCareAvailability.status(w,m,b)!="在現場，可重新評估接待","walking provider is not promised ready")
   m.positions[pair.provider].walking=false
   var close: int=w.rules.jobs[job].work_hours[1];w.data.clock.hour=close
   check(SimCareAvailability.status(w,m,b).contains("未到接待工時"),"closed provider not ready")
   check(SimCareAvailability.next_shift(w,SimWorkSchedule.job(b,w.rules.jobs)).contains("明天"),"next opening belongs to next day")
   w.data.clock.hour=12
   var day:=SimClock.total_days(w.data.clock)
   b._careProvided={"day":day,"used":3}
   check(SimCareAvailability.remaining(w,b)==0 and SimCareAvailability.status(w,m,b).contains("已滿"),"same-day completed cap shown")
   b._careProvided.day=day-1
   before=w.snapshot().duplicate(true)
   check(SimCareAvailability.remaining(w,b)==3,"yesterday quota is not today's cap")
   SimCareAvailability.rows(w,m,pair.recipient)
   check(equal(before,w.snapshot()),"read-only view does not perform daily quota reset")
   b.erase("_careProvided")
   a._careVisit={"provider":pair.provider,"state":"travel"}
   check(SimCareAvailability.status(w,m,b).contains("已有居民"),"travel reservation makes provider busy")
   a.erase("_careVisit")
   a._careVisitDay=day
   check(SimCareAvailability.reason(w,m,a,b,SimCareAvailability.status(w,m,b)).contains("求助機會"),"recipient daily attempt shown")
   a.erase("_careVisitDay")
   w.quest_balance.careers={"day":day,"treated":[str(a.id)],"counseled":[str(a.id)],"active":{},"used":0,"completed":0}
   check(SimCareAvailability.reason(w,m,a,b,SimCareAvailability.status(w,m,b)).contains("同類照護"),"shared player and resident completion quota shown")
   w.quest_balance.careers.day=day-1
   before=w.snapshot().duplicate(true);SimCareAvailability.rows(w,m,pair.recipient)
   check(equal(before,w.snapshot()),"stale career ledger stays untouched")
   check(SimCareAvailability.status(w,null,b).contains("步行位置"),"missing observation not invented")
   var place: String=b.currentLocation;var building: Dictionary=w.data.townMap.locations[place]
   w.data.townMap.locations.erase(place)
   check(SimCareAvailability.status(w,m,b).contains("未建成"),"missing facility is explicit")
   w.data.townMap.locations[place]=building
   check(SimCareAvailability.reason(w,m,w.data.agents.player,b,SimCareAvailability.status(w,m,b)).contains("你操作"),"player keeps manual control")
   before=w.snapshot().duplicate(true);app.active_tab="居民";app.show_care_availability(pair.recipient);await settle()
   check(app.resident_page=="care_availability" and app.drawer_body.get_children().any(func(n):return n is Button and n.text=="返回作息與行程"),"mobile availability page and return action")
   check(equal(before,w.snapshot()),"UI renders without creating or reserving work")
   press(app.drawer_body,"返回作息與行程");check(app.resident_page=="agenda","return button opens original agenda")
   press(app.drawer_body,"查看照護接待");check(app.resident_page=="care_availability","agenda button opens availability")
   app._tick_simulation();check(app.resident_page=="care_availability" and has_text(app.drawer_body,"照護接待"),"clock tick refreshes the same availability page")
   var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"care availability read-only reload");w=app.simulation;m=app.motion
   check(not SimCareAvailability.rows(w,m,pair.recipient).is_empty(),"availability rebuilds from loaded observations")
 var report:={"checks":checks,"failures":failures,"scope":"both towns and care roles; read-only availability, real presence, opening hours, quota day boundaries, busy provider, shared treatment limits, missing facilities/observations, manual player and mobile page with actual reload"}
 FileAccess.open("res://docs/CARE_AVAILABILITY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

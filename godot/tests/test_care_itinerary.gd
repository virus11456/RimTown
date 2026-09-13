extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
 var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
 var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
 for town in ["frontier","harbor"]:
  for job in ["doctor","priest"]:
   var pair: Dictionary=Fixture.prepare(app,town,job);var w: SimWorld=app.simulation;var m: SimMotion=app.motion;w.social.observe_positions(m);w.social_enabled=true
   var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider];b.needs.hunger=100;b.needs.rest=100
   var goal:=SimResidentCare.meeting_goal(m,b)
   var house: Dictionary=m.layout.houses[m.layout._house_id(str(a.id),str(a.homeLocation))]
   var door: Variant=m.door(b.currentLocation,str(a.id));var exit_point:=Vector2(door.x,door.y) if door!=null else goal;var entry:=Vector2(house.doorPixelX,house.doorPixelY)
   var offset:=str(a.id).unicode_at(0)%4;var home:=m.layout._nearest(Vector2(house.interiorX+(offset%2-.5)*16,house.interiorY+(floori(offset/2.0)-.5)*16))
   var expected:=SimHangoutRoute.segment(m,goal,exit_point)+SimHangoutRoute.segment(m,exit_point,entry)+SimHangoutRoute.segment(m,entry,home)
   var before: Dictionary=w.snapshot().duplicate(true);var position: Dictionary=m.positions.duplicate(true)
   var estimate:=SimCareAvailability.timing(w,m,a,b)
   check(not estimate.is_empty(),"ready provider offers real route estimate "+town+job)
   check(absf(float(estimate.return_distance)-expected)<.001,"return starts at actual care point through exit and own home")
   check(estimate.travel_ticks==SimResidentCare.travel_ticks(m,str(a.id),b.currentLocation,goal) and estimate.service_ticks==2,"display uses same outward budget and service length")
   check(estimate.return_ticks==ceili(expected/m.travel_budget())+1,"return budget includes observation buffer")
   check(equal(before,w.snapshot()) and equal(position,m.positions),"itinerary preview does not move or reserve")
   check(SimHangoutRoute.return_fits(m,a,w.data.clock,w.rules.jobs,b.currentLocation,estimate.travel_ticks+2,goal),"nearby midday care retains return room")
   check(SimCareAvailability.timing(w,m,b,b).is_empty(),"provider does not get a self-treatment itinerary")
   a._careVisit={"provider":str(b.id)};check(SimCareAvailability.timing(w,m,a,b).is_empty(),"ongoing visit is not relabeled as a new hypothetical departure");a.erase("_careVisit")
   var old: float=SimHangoutRoute.home_distance(m,a,b.currentLocation)
   var center:=m.layout._nearest(m.layout._center(b.currentLocation))
   check(old==SimHangoutRoute.home_distance(m,a,b.currentLocation,center),"other callers retain their original default origin")
   var returning_motion:=SimMotion.new();returning_motion.configure(m.layout);returning_motion.stable_routes=true;returning_motion.tick_seconds=m.tick_seconds
   var traveler: Dictionary=a.duplicate(true);traveler.activity="heading_home";traveler.currentLocation=traveler.homeLocation
   returning_motion.positions[str(a.id)]={"x":goal.x,"y":goal.y,"targetX":goal.x,"targetY":goal.y,"walking":false,"doorPhase":null,"activity":"heading_home","walkStep":0}
   for frame in int(estimate.return_ticks)*m.frames_per_tick():returning_motion.update({str(a.id):traveler})
   check(SimCareerPresence.room(returning_motion,str(a.id))==m.layout._house_id(str(a.id),str(a.homeLocation)) and not returning_motion.positions[str(a.id)].get("walking",true),"actual ordinary walk arrives home inside return estimate")
   m.positions[pair.provider].walking=true;check(SimCareAvailability.timing(w,m,a,b).is_empty(),"moving provider does not invent fixed reception route");m.positions[pair.provider].walking=false
   check(SimCareAvailability.timing(w,null,a,b).is_empty(),"missing observation has no fabricated estimate")
   app.active_tab="居民";app.show_care_availability(pair.recipient);await settle()
   check(has_text(app.drawer_body,"步行估算") and has_text(app.drawer_body,"若現在出發"),"mobile page identifies times as conditional estimates")
   var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"care itinerary reload");w=app.simulation;m=app.motion
   check(equal(estimate,SimCareAvailability.timing(w,m,w.data.agents[pair.recipient],w.data.agents[pair.provider])),"reload reproduces same itinerary from saved physical location")
   w.data.clock.hour=23;w.data.clock.minute=45
   check(SimCareAvailability.time_label(w,2)=="明天 00:15","estimated times cross midnight explicitly")
 var report:={"checks":checks,"failures":failures,"scope":"two towns and both care roles; exact reception-to-home route, shared travel/service budget, default route compatibility, read-only estimates, mobile wording and actual reload"}
 FileAccess.open("res://docs/CARE_ITINERARY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

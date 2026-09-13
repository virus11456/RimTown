extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
 var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
 var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
 for town in ["frontier","harbor"]:
  app.load_demo(town);var w: SimWorld=app.simulation;var m: SimMotion=app.motion
  check(app.clock_pace()=="original" and m.tick_seconds==8,"new original demo preserves current cadence")
  app.tick_accumulator=4;var positions: Dictionary=m.positions.duplicate(true);var stock: Dictionary=w.data.stockpile.duplicate(true);var clock: Dictionary=w.data.clock.duplicate(true);var jobs: Dictionary={};var needs: Dictionary={}
  for id in w.data.agents:jobs[id]=w.data.agents[id].jobKey;needs[id]=w.data.agents[id].needs.duplicate(true)
  w.quest_balance.appointments={"current":{"npc":"chen_wei" if town=="frontier" else "hb_haibo","state":"accepted","place":"town_square","due":100,"until":108}}
  var appointment: Dictionary=w.quest_balance.appointments.duplicate(true)
  app.set_clock_pace("relaxed")
  check(m.tick_seconds==16 and m.frames_per_tick()==960 and app.tick_accumulator==8,"switch preserves fractional game tick")
  check(equal(positions,m.positions) and equal(stock,w.data.stockpile) and equal(clock,w.data.clock),"pace change moves nobody and advances no clock or resources")
  check(equal(appointment,w.quest_balance.appointments),"confirmed game-time appointment unchanged")
  check(jobs.keys().all(func(id):return jobs[id]==w.data.agents[id].jobKey and equal(needs[id],w.data.agents[id].needs)),"jobs guards and needs preserved")
  check(jobs.keys().all(func(id):return id=="player" or not w.data.agents[id].has("_shiftSleep") or int(w.data.agents[id]._shiftSleep.duration)==int(SimShiftSleep.preferred(w.data.agents[id]).duration)),"commute recalculation retains full sleep duration")
  var saved: Dictionary=app.progress_snapshot();check(saved._godot4a.clock_pace=="relaxed","progress records explicit pace")
  app._load_document(JSON.stringify(saved),"relaxed pace reload");w=app.simulation;m=app.motion
  check(app.clock_pace()=="relaxed" and app.tick_accumulator==8 and equal(positions,m.positions),"actual reload keeps selected pace partial tick and position")
  var slow:=SimMotion.new();slow.configure(m.layout);slow.stable_routes=true;slow.tick_seconds=16;slow.positions=m.positions.duplicate(true)
  var original:=SimMotion.new();original.configure(m.layout);original.stable_routes=true;original.tick_seconds=8;original.positions=m.positions.duplicate(true)
  for frame in 120:slow.update(w.data.agents);original.update(w.data.agents)
  check(equal(slow.positions,original.positions),"identical movement over same physical frames in both clock modes")
  var old_speed: float=app.speed
  app.set_clock_pace("original");check(app.tick_accumulator==4 and app.speed==old_speed,"return switch preserves tick fraction and playback speed")
  var before: Dictionary=app.progress_snapshot();app.set_clock_pace("invalid");check(equal(before,app.progress_snapshot()),"unknown pace is ignored")
  saved._godot4a.erase("clock_pace");saved._godot4a.tick_seconds=16;saved._godot4a.tick_accumulator=8
  app._load_document(JSON.stringify(saved),"legacy pace import");check(app.clock_pace()=="original" and app.tick_accumulator==4,"legacy metadata retains original cadence with phase conversion")
  saved._godot4a.clock_pace={"invalid":true};app._load_document(JSON.stringify(saved),"unknown pace import");check(app.clock_pace()=="original","invalid saved mode falls back safely")
  app.show_tab("設定",true);press(app.drawer_body,"生活節奏：原有");check(app.clock_pace()=="relaxed" and has_text(app.drawer_body,"遊戲時鐘放慢一半"),"mobile settings button enables explained pace")
  press(app.drawer_body,"生活節奏：從容");check(app.clock_pace()=="original","settings button restores original mode")
  app.simulation.quest_balance.erase("appointments") # Separate frame-clock fixture; appointment persistence checked above.
  app.set_clock_pace("relaxed");app.running=true;app.frame_accumulator=0;app.tick_accumulator=8
  var game_tick: int=app.simulation.data.tickCount;app._process(.2)
  check(int(app.simulation.data.tickCount)==game_tick,"relaxed process does not tick at old eight-second boundary")
  app.frame_accumulator=0;app.tick_accumulator=15.99;app._process(.02)
  check(int(app.simulation.data.tickCount)==game_tick+1,"relaxed process ticks at sixteen seconds")
  app.set_clock_pace("original");app.frame_accumulator=0;app.tick_accumulator=7.99;app._process(.02)
  check(int(app.simulation.data.tickCount)==game_tick+2,"original process still ticks at eight seconds")
  app.running=false
 var report:={"checks":checks,"failures":failures,"scope":"both towns; mode switching with unchanged physical movement, clock phase, needs/resources/jobs/appointments; sleep duration, explicit progress restore, legacy and malformed modes, mobile settings"}
 FileAccess.open("res://docs/CLOCK_PACE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

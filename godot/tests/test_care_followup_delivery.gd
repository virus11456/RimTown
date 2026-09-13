extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
 var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
 var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
 var raw:=FileAccess.get_file_as_string("res://docs/CARE_FOLLOWUP_HARBOR_PROGRESS.rimtown")
 var source: Dictionary=JSON.parse_string(raw)
 var bytes:=SaveArchive.encode(raw);check(not bytes.is_empty(),"natural progress encodes within existing archive limit")
 var path:=ProjectSettings.globalize_path("res://docs/CARE_FOLLOWUP_HARBOR.rimtown")
 var file:=FileAccess.open(path,FileAccess.WRITE);file.store_buffer(bytes);file.close()
 var decoded:=SaveArchive.decode(FileAccess.get_file_as_bytes(path));check(decoded.ok and decoded.text==raw,"compressed archive checksum and lossless round trip")
 app.dialog.file_selected.emit(path);await settle()
 check(int(app.simulation.data.tickCount)==288 and app.clock_pace()=="relaxed","three natural days and selected pace imported")
 check(equal(source._godot4a.motion,app.progress_snapshot()._godot4a.motion),"natural positions preserved")
 var found: Array=[]
 for id in app.simulation.data.agents:
  var a: Dictionary=app.simulation.data.agents[id]
  for event in a.get("_careResults",[]):
   if event.get("followup",{}).get("state","")=="finished" and event.followup.has("home") and event.followup.has("work"):
    found.append(str(id));check(equal(event,source.agents[id]._careResults.filter(func(row):return row.tick==event.tick)[0]),"finished natural evidence survives import")
    var before: Dictionary=app.simulation.snapshot().duplicate(true)
    SimResidentCare.observe_care_followup(app.simulation,a)
    check(equal(before,app.simulation.snapshot()),"finished observation does not repay or rewrite evidence")
    app.active_tab="居民";app.drawer.show();app.show_agenda(str(id));await settle()
    check(has_text(app.drawer_body,"實際到家") and has_text(app.drawer_body,"到場工作"),"mobile agenda presents actual natural milestones")
 check(not found.is_empty(),"delivery contains natural care followed by actual home and work")
 var report:={"checks":checks,"failures":failures,"residents":found,"archive_bytes":bytes.size(),"scope":"three-day unforced harbor progress, archive checksum, real file-selection import, saved physical positions, finished care/home/work evidence, no replay and mobile agenda text"}
 FileAccess.open("res://docs/CARE_FOLLOWUP_DELIVERY.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

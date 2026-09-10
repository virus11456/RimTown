extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w;var m: SimMotion=f.m;var book: Dictionary={}
	SimAppointments.offer(w,"chen_wei")
	check(SimAppointments.reminder(w,m,book).is_empty(),"offer is not a confirmed reminder")
	SimAppointments.respond(w,true);var a:=SimAppointments.current(w)
	w.data.tickCount=a.due-9;check(SimAppointments.reminder(w,m,book).is_empty(),"no premature reminder")
	w.data.tickCount+=1;check("120" in SimAppointments.reminder(w,m,book),"two-hour preparation notice")
	var saved:=w.snapshot();check(SimAppointments.reminder(w,m,book).is_empty() and equal(saved,w.snapshot()),"repeat frame no-op")
	var restored:=SimWorld.new();restored.load_snapshot(saved)
	check(SimAppointments.reminder(restored,m,JSON.parse_string(JSON.stringify(book))).is_empty(),"reload does not repeat reminder")
	m.positions.chen_wei.x=0;m.positions.chen_wei.y=0;w.data.tickCount=a.due
	check("已到與" in SimAppointments.reminder(w,m,book),"start time reminder distinct from arrival")
	w.data.agents.chen_wei.currentLocation=a.place
	check(SimAppointments.reminder(w,m,book).is_empty(),"logical arrival insufficient")
	var point:=m.layout._nearest(m.layout._center(a.place));m.positions.chen_wei.x=point.x;m.positions.chen_wei.y=point.y
	check("已在" in SimAppointments.reminder(w,m,book),"physical venue arrival reminder")
	m.positions.chen_wei.x=0;m.positions.chen_wei.y=0
	check(SimAppointments.reminder(w,m,book).is_empty(),"no lower-stage reminder after departure")
	w.data.tickCount=a.until;check(SimAppointments.reminder(w,m,book).is_empty(),"expired window no reminder")
	a.state="cancelled";check(SimAppointments.reminder(w,m,book).is_empty(),"cancelled appointment quiet")
	var report:={"checks":checks,"failures":failures,"scope":"confirmed time thresholds, actual venue vs logical destination, once-per-stage persisted bounded state, no repeat on departure/expiry/cancellation; configured position fixture"}
	FileAccess.open("res://docs/APPOINTMENT_REMINDER_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

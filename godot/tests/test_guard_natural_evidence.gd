extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var source:=FileAccess.get_file_as_string("res://docs/ROUTINE_AUDIT_CURRENT_TESTS.json");var report: Dictionary=JSON.parse_string(source)
	var nights: Array=report.traces.filter(func(r): return r.id=="gao_lang" and int(r.minute)==0 and int(r.hour) in [23,0])
	check(nights.size()==4 and nights.all(func(r): return r.activity=="working" and r.actual=="town_square"),"both observed nights have actual square duty before and after midnight")
	var sleeps: Array=report.traces.filter(func(r): return r.id=="gao_lang" and int(r.minute)==0 and int(r.hour)==10)
	check(sleeps.size()==2 and sleeps.all(func(r): return r.activity=="sleeping" and r.actual.begins_with("residential_")),"both days include actual daytime home sleep")
	var guards: Array=report.shifts.filter(func(r): return r.id in ["yang_feng","gao_lang"])
	check(guards.size()==4 and guards.all(func(r): return r.facility_available and r.workplace=="town_square"),"two actual guards have day/night starts at a real temporary post")
	check(int(report.eligible_shifts)==36 and int(report.unavailable_shifts)==4,"missing doctor and farm facilities are separated from real commute opportunities")
	check(report.false_sleep.is_empty() and float(report.maximum_step)<2,"source trace records no false home sleep or teleport")
	var result:={"checks":checks,"failures":failures,"trace_sha256":source.sha256_text(),"night_samples":nights,"day_sleep_samples":sleeps,"guard_starts":guards,"scope":"read-only assertions over the freshly generated unmodified two-day app trace; hash binds evidence to that report, not a separate simulation"}
	FileAccess.open("res://docs/GUARD_NATURAL_EVIDENCE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "));print(JSON.stringify({"checks":checks,"failures":failures}));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_hangout_visits.gd"
func _initialize() -> void:
	for fault in ["work","sleep","shelter","dead","place","removed"]:
		var w:=fixture();var token:=depart_pair(w);var r: Dictionary=SimHangoutVisits.records(w)[token];var expected:=""
		match fault:
			"work": w.data.agents.chen_wei.jobKey="priest";expected="通勤或工作時段"
			"sleep": w.data.clock.hour=3;expected="睡眠時段"
			"shelter": w.data.agents.chen_wei._raidShelterUntil=999;expected="需要避難"
			"dead": w.data.agents.chen_wei.isDead=true;expected="已離世"
			"place": w.data.townMap.locations.erase("park");expected="目的地已不存在"
			"removed": w.data.agents.erase("chen_wei");expected="已離開小鎮"
		SimHangoutVisits.tick(w)
		check(r.state=="cancelled" and expected in r.reason,"specific supported cancellation: "+fault)
		check(w.quest_balance.hangout_status.lin_mei.reason==r.reason,"surviving participant gets same reason: "+fault)
	var report:={"checks":checks,"failures":failures,"scope":"controlled work/sleep/shelter/death/missing venue/removed participant, existing cancellation priority unchanged, shared factual reason"}
	FileAccess.open("res://docs/HANGOUT_REASON_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

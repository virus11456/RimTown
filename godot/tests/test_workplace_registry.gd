extends "res://tests/test_daily_talk.gd"
func _initialize() -> void:
	var f:=setup();var w: SimWorld=f.w
	w.data.townMap.locations.erase("clinic");w.data.townMap.locations.erase("guardpost")
	w.data.buildings.completed=[{"id":"ward","buildingKey":"clinic_upgrade","status":"complete","siteX":32,"siteY":34},{"id":"tower","buildingKey":"watchtower","status":"complete","siteX":34,"siteY":40}]
	SimWorkplaces.sync(w)
	check(w.data.townMap.locations.has("clinic") and w.data.townMap.locations.has("guardpost"),"clinic and tower can both register in the same refresh")
	check(w.data.townMap.locations.clinic._workSite.project=="ward" and w.data.townMap.locations.guardpost._workSite.project=="tower","each workplace retains its own project identity")
	w.data.townMap.locations.guardpost={"id":"guardpost","name":"原有守衛站"};var before:=w.snapshot();SimWorkplaces.sync(w)
	check(equal(before,w.snapshot()),"existing guardpost and clinic remain unchanged")
	for fault in ["unfinished","unplaced","invalid_site"]:
		w.data.townMap.locations.erase("guardpost")
		var p: Dictionary=w.data.buildings.completed[1];p.status="complete";p.siteX=34;p.siteY=40
		match fault:
			"unfinished": p.status="building"
			"unplaced": p.erase("siteX")
			"invalid_site": p.siteX=-1
		SimWorkplaces.sync(w)
		check(not w.data.townMap.locations.has("guardpost"),"invalid tower cannot become workplace: "+fault)
	var report:={"checks":checks,"failures":failures,"scope":"controlled completed-project metadata fixtures: coexistence, identity, original guardpost preservation, unfinished/unplaced/invalid-site rejection; physical construction covered separately"}
	FileAccess.open("res://docs/WORKPLACE_REGISTRY_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

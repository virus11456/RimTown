extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	# Legacy-save fixture: construction and level already earned, but no 3D coordinates.
	var p: Dictionary={"id":"legacy_tower","buildingKey":"watchtower","name":"舊瞭望塔","description":"舊存檔已完工工程","status":"complete","level":2,"workDone":20,"workRequired":20,"costs":{"wood":40,"stone":30},"effects":{"defense_bonus":3}}
	w.data.buildings.completed=[p];w.data.buildings.projects=[];w.data.buildings.activeEffects={"defense_bonus":3}
	w.data.stockpile.resources.food=1000
	app._refresh_building_world()
	var original:=w.snapshot();var site: Vector2i=BuildingSites.candidates(w.data)[0]
	check(not SimBuildings.unplaced(w,p.id).is_empty(),"unplaced completed legacy tower is eligible")
	check(not SimBuildings.place_completed(w,p.id,Vector2i(-1,-1)) and equal(original,w.snapshot()),"invalid site rejects without proposal or mutation")
	app.show_buildings();press(app.drawer_body,"補選址：舊瞭望塔")
	check(is_instance_valid(app.placement_preview) and has_text(app.drawer_body,"不重複扣材料"),"phone exposes cost-free legacy placement preview")
	press(app.drawer_body,"下一塊空地");press(app.drawer_body,"取消選址")
	check(equal(original,w.snapshot()) and not is_instance_valid(app.placement_preview),"preview and cancel change no world data")
	app.show_building_site("watchtower",0,false,p.id);press(app.drawer_body,"確認補選址")
	check(not p.has("siteX") and SimGovernance.book(w).proposals.size()==1,"traveler proposes instead of choosing town land unilaterally")
	var proposal: Dictionary=SimGovernance.book(w).proposals[0]
	check("舊瞭望塔" in SimGovernance.describe(w,proposal),"proposal shows human-readable building name")
	check(proposal.action=="building_site" and proposal.costs.is_empty(),"proposal records location decision with no new spending")
	SimGovernance.daily(w)
	check(proposal.status=="approved","current NPC mayor reviews and approves through ordinary governance")
	var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"approved placement reload")
	p=w.data.buildings.completed[0];proposal=SimGovernance.book(w).proposals[0]
	var player_pos: Dictionary=m.positions.player.duplicate(true)
	m.positions.player.x=(site.x+1)*16;m.positions.player.y=(site.y+1)*16
	var occupied_world:=w.snapshot();var occupied_motion: Dictionary=m.positions.duplicate(true)
	check(not SimGovernance.execute(w,int(proposal.id)) and equal(occupied_world,w.snapshot()) and equal(occupied_motion,m.positions),"person occupying selected ground blocks approved placement without moving anyone")
	m.positions.player=player_pos
	var stock: Dictionary=w.data.stockpile.duplicate(true);var effects: Dictionary=w.data.buildings.activeEffects.duplicate(true);var messages: Array=w.data.messageLog.duplicate(true)
	app.show_governance();press(app.drawer_body,"執行核准案 #"+str(int(proposal.id)))
	check(p.has("siteX") and int(p.siteX)==site.x and int(p.siteY)==site.y,"approved saved proposal places exact selected site")
	check(proposal.status=="executed" and "未重複扣料" in str(proposal.reason),"approved proposal records cost-free completion")
	check(equal(stock,w.data.stockpile) and equal(effects,w.data.buildings.activeEffects),"placement charges nothing and does not repeat defense effects")
	check(p.level==2 and p.workDone==20 and w.data.buildings.projects.is_empty() and w.data.buildings.completed.size()==1,"level completion and project count preserved without rebuilding")
	check(equal(messages,w.data.messageLog),"placement does not emit a second construction completion")
	check(m.layout.work_sites.has("guardpost") and w.data.agents.gao_lang._guardWorkplace=="guardpost","governance execution immediately connects actual guard workplace")
	check(app.world_view.content.get_children().any(func(n): return n.get_meta("construction_key","")=="watchtower" and int(n.get_meta("level",0))==2),"old tower keeps level-two visual at chosen site")
	var before:=w.snapshot()
	check(not SimBuildings.place_completed(w,p.id,BuildingSites.candidates(w.data)[0]) and equal(before,w.snapshot()),"already placed tower cannot be moved or duplicated through migration")
	check(not SimGovernance.execute(w,int(proposal.id)) and equal(before,w.snapshot()),"repeated proposal execution is a no-op")
	var pos: Dictionary=m.positions.gao_lang.duplicate(true);app._load_document(JSON.stringify(app.progress_snapshot()),"placed legacy reload")
	check(m.layout.work_sites.has("guardpost") and int(w.data.buildings.completed[0].siteX)==site.x,"placed site survives native reload")
	check(is_equal_approx(float(pos.x),float(m.positions.gao_lang.x)) and is_equal_approx(float(pos.y),float(m.positions.gao_lang.y)),"reload preserves actual guard position")
	# Elected player direct decision; concurrent upgrade and occupied-site checks remain mandatory.
	for a in w.data.agents.values():
		if a.jobKey=="mayor": a.jobKey=""
	w.data.agents.player.jobKey="mayor"
	var ward: Dictionary={"id":"legacy_ward","buildingKey":"clinic_upgrade","name":"舊病房","status":"complete","level":1};w.data.buildings.completed.append(ward)
	w.data.buildings.projects=[{"upgradeKey":"clinic_upgrade"}]
	check(SimBuildings.unplaced(w,ward.id).is_empty(),"active upgrade blocks migration until it finishes")
	w.data.buildings.projects=[]
	before=w.snapshot();check(not SimBuildings.place_completed(w,ward.id,site) and equal(before,w.snapshot()),"occupied location is revalidated before direct placement")
	stock=w.data.stockpile.duplicate(true)
	check(SimBuildings.place_completed(w,ward.id,BuildingSites.candidates(w.data)[0]) and equal(stock,w.data.stockpile),"elected player can place unlocated ward directly without payment")
	app._refresh_building_world();check(m.layout.work_sites.has("clinic") and m.layout.work_sites.has("guardpost"),"migrated tower and ward coexist")
	var report:={"checks":checks,"failures":failures,"scope":"controlled legacy completed-project fixtures; phone preview/cancel, ordinary NPC mayor approval and approved save reload, actual governance UI execution, elected-player direct action, atomic site/upgrade checks, preserved costs/effects/level/count and native site/motion reload; no full economy or new walking endurance claim"}
	FileAccess.open("res://docs/LEGACY_BUILDING_SITE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

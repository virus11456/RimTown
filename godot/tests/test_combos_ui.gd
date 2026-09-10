extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;w.data.decorations=[];w.data.combosFound=[]
	for r in w.data.stockpile.resources: w.data.stockpile.resources[r]=10000
	app.show_tab("小鎮",true);press(app.drawer_body,"裝飾與組合")
	check(w.combos_enabled and has_text(app.drawer_body,"心情 +6"),"entry and true effect disclosed")
	var before:=w.snapshot();press(app.drawer_body,"擺放：花圃");check(equal(before,w.snapshot()),"preview without payment")
	press(app.drawer_body,"確認擺放");check(w.data.decorations.size()==1 and SimEconomy.amount(w,"silver")==9985,"flowerbed UI payment")
	var anchor: Dictionary=w.data.decorations[0]
	for key in ["bench","lamp"]:
		var sites:=BuildingSites.candidates(w.data,1);var index: int=-1
		for i in sites.size():
			if maxi(absi(sites[i].x-int(anchor.x)),absi(sites[i].y-int(anchor.y)))<=4: index=i;break
		check(index>=0,"nearby decor site exists")
		if index<0: continue
		app.show_building_site(key,index,true);press(app.drawer_body,"確認擺放")
	check("romantic_corner" in w.data.combosFound and SimCombos.active(w.data).any(func(c): return c.id=="romantic_corner"),"real romantic corner discovered")
	var item: Dictionary=w.data.decorations[1];var silver:=SimEconomy.amount(w,"silver");var wood:=SimEconomy.amount(w,"wood")
	press(app.drawer_body,"移除：長椅 (%d,%d)"%[item.x,item.y])
	check(SimEconomy.amount(w,"silver")==silver+7 and SimEconomy.amount(w,"wood")==wood+5,"half refund floors each material")
	before=w.snapshot();check(not SimCombos.remove(w,item) and equal(before,w.snapshot()),"stale remove cannot refund twice")
	check(not SimCombos.active(w.data).any(func(c): return c.id=="romantic_corner") and "romantic_corner" in w.data.combosFound,"inactive retains discovery")
	var mood: Dictionary=w.runtime.duplicate(true);check(SimCombos.place(w,"bench",Vector2i(item.x,item.y)) and equal(mood,w.runtime),"rebuilding cannot farm mood reward")
	before=w.snapshot();check(not SimCombos.place(w,"lamp",Vector2i(item.x,item.y)) and not SimCombos.place(w,"unknown",Vector2i(0,0)) and equal(before,w.snapshot()),"overlap and invalid type atomic")
	var restored:=SimWorld.new();restored.load_snapshot(JSON.parse_string(JSON.stringify(w.snapshot(),"",false,true)))
	check(SimCombos.check_new(restored).is_empty(),"reload cannot repeat discovery")
	for i in 960: w.tick();restored.tick()
	check(equal(w.snapshot(),restored.snapshot()),"ten-day decor/combos resume")
	FileAccess.open("res://tests/combos/compatibility-save.json.tmp",FileAccess.WRITE).store_string(JSON.stringify(app.progress_snapshot(),"",false,true))
	app.show_decorations();await settle()
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"375px combo layout")
	var report:={"checks":checks,"failures":failures,"scope":"real decor selection/payment and combo, remove/refund/rebuild guards, discovery once, ten-day resume and mobile UI"}
	FileAccess.open("res://docs/COMBO_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

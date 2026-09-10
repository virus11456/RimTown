extends "res://tests/test_careers_expansion_ui.gd"
func run() -> void:
	for selling in [false,true]:
		var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
		var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
		var w: SimWorld=app.simulation;w.data.stockpile.resources.wood=SimSupply.reserve(w,"wood") if selling else 0;w.data.stockpile.resources.silver=1000;w.data.stockpile.resources.food=200
		w.data.trade.merchant={"name":"委託商人","offers":[{"resource":"wood","amount":20,"price":2.5,"isBuying":selling}],"daysRemaining":3}
		app.show_careers();press(app.drawer_body,"登記：商人");await settle()
		check(w.data.agents.player.jobKey=="trader","registers merchant profession")
		check(has_text(app.drawer_body,"木材 × 4"),"human readable quote quantity")
		var label: String=SimCareers.available(w)[0].label
		press(app.drawer_body,"申請："+label);await settle();check(has_text(app.drawer_body,"鎮務提案與權限"),"quote review page")
		SimGovernance.daily(w);app.show_careers();await settle();check(has_text(app.drawer_body,"交易用途：已核准"),"approval visible")
		press(app.drawer_body,"開始："+label);await settle();check(SimCareers.book(w).active.is_empty(),"physical trade post required")
		stand(app,"general_store");app.show_careers();await settle();press(app.drawer_body,"開始："+label);await settle()
		check(not SimCareers.book(w).active.is_empty(),"onsite handover starts")
		for i in 4: w.tick()
		check(SimEconomy.amount(w,"silver")==1000+(10 if selling else -10),"UI changes actual public treasury")
		app.show_careers();await settle();check(SimCareers.book(w).used==1,"completion consumes shared duty")
		for child in app.drawer_body.get_children():
			if child is Control: check(child.size.x<=app.drawer.size.x,"375px merchant UI fits")
		viewport.queue_free();await settle()
	var report:={"checks":checks,"failures":failures,"scope":"375px merchant registration, readable quote, proposal/approval, physical attendance gate, real timed buy/sell and public money; fixture locations"}
	FileAccess.open("res://docs/CAREER_TRADER_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

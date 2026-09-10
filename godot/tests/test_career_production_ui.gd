extends "res://tests/test_careers_expansion_ui.gd"
func run() -> void:
	for job in SimCareers.PRODUCTION:
		var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
		var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
		var w: SimWorld=app.simulation;var recipe:=SimCareers.recipe(job)
		for key in recipe.outputs: w.data.stockpile.resources[key]=0
		w.data.stockpile.resources.food=200
		for key in recipe.inputs: w.data.stockpile.resources[key]=maxf(20,SimEconomy.amount(w,key))
		app.show_careers();press(app.drawer_body,"登記："+str(SimCareers.JOBS[job].name));await settle()
		var stock: Dictionary=w.data.stockpile.duplicate(true)
		press(app.drawer_body,"申請本次材料用途");await settle()
		check(has_text(app.drawer_body,"鎮務提案與權限"),job+" opens mayor review")
		check(equal(stock,w.data.stockpile),job+" proposal no spending")
		SimGovernance.daily(w);app.show_careers();await settle();check(has_text(app.drawer_body,"已核准，可到場開始"),job+" approval displayed")
		stand(app,str(SimCareers.PRODUCTION[job].location));app.show_careers();await settle()
		press(app.drawer_body,"開始："+str(SimCareers.PRODUCTION[job].label));await settle()
		check(not SimCareers.book(w).active.is_empty(),job+" onsite production starts")
		for i in 4: w.tick()
		check(SimCareers.book(w).used==1,job+" actual ticks complete batch")
		for key in recipe.outputs: check(SimEconomy.amount(w,key)==float(stock.resources.get(key,0))+float(recipe.outputs[key]),job+" output reaches public stock")
		app.show_careers();await settle();check(has_text(app.drawer_body,"尚未核准"),job+" next batch requires new grant")
		for child in app.drawer_body.get_children():
			if child is Control: check(child.size.x<=app.drawer.size.x,"375px production menu fits")
		viewport.queue_free();await settle()
	var report:={"checks":checks,"failures":failures,"scope":"four job registrations, 375px UI, material proposal, approval display, onsite timed batch, public stock and consumed grant; fixture positions"}
	FileAccess.open("res://docs/CAREER_PRODUCTION_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

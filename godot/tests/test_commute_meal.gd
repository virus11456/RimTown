extends "res://tests/test_player_chat_ui.gd"
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(960,640);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion;var a: Dictionary=w.data.agents.gao_lang
	var point:=m.layout._nearest(m.layout._center("town_square"))
	var p: Dictionary=m.positions[a.id];p.x=point.x;p.y=point.y;p.walking=false;p.doorPhase=null
	a.currentLocation="town_square";a.needs.hunger=16;a.needs.rest=80;w.data.clock.hour=17;w.data.clock.minute=0
	check(SimCommute.meal_place(w,a)=="town_square","hungry night guard can eat at actual post before shift")
	var stock: Dictionary=w.data.stockpile.duplicate(true);var before: Dictionary=p.duplicate(true)
	w._update(a.id)
	check(a.activity=="eating" and a.currentLocation=="town_square","update keeps meal at actual post instead of tavern detour")
	check(is_equal_approx(float(a.needs.hunger),36),"meal uses original twenty-point recovery once")
	check(equal(stock,w.data.stockpile),"meal does not add a new stockpile transaction")
	check(equal(before,p),"meal decision never moves the resident")
	w.data.clock.minute=15;w._update(a.id)
	check(a.activity=="commuting" and a.currentLocation=="town_square","after meal guard resumes waiting at post")
	a.needs.hunger=16
	for fault in ["walking","door","rest","player","dead","shelter","full","off_hours","shift_started","missing","sleep","legacy"]:
		var copy: Dictionary=a.duplicate(true)
		match fault:
			"walking": p.walking=true
			"door": p.doorPhase="entering"
			"rest": copy.needs.rest=0
			"player": copy.isPlayer=true
			"dead": copy.isDead=true
			"shelter": copy._raidShelterUntil=999
			"full": copy.needs.hunger=80
			"off_hours": w.data.clock.hour=23
			"shift_started": w.data.clock.hour=18;w.data.clock.minute=0
			"missing": copy.jobKey=""
			"sleep": w.data.clock.hour=15
			"legacy": m.stable_routes=false
		check(SimCommute.meal_place(w,copy).is_empty(),"meal is bounded: "+fault)
		p.walking=false;p.doorPhase=null;w.data.clock.hour=17;w.data.clock.minute=0;m.stable_routes=true
	point=m.layout._nearest(m.layout._center("park"));p.x=point.x;p.y=point.y
	check(SimCommute.meal_place(w,a).is_empty(),"unrelated leisure venue cannot become a meal location")
	var house: Dictionary=m.layout.houses[m.layout._house_id(str(a.id),str(a.homeLocation))]
	p.x=house.interiorX;p.y=house.interiorY
	check(SimHomeRest.arrived(w,a),"controlled home meal position is the resident's actual room")
	check(SimCommute.meal_place(w,a)==a.homeLocation,"resident can eat at home before leaving for work")
	w._update(a.id)
	check(a.activity=="eating" and a.currentLocation==a.homeLocation,"home meal does not direct the resident to tavern")
	var report:={"checks":checks,"failures":failures,"scope":"controlled actual-post meal, original recovery/resources, no position mutation, resume commute and twelve priority/boundary exclusions; natural walking tested separately"}
	FileAccess.open("res://docs/COMMUTE_MEAL_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for job in ["cook","tailor","blacksmith"]:
			var task:=Fixture.prepare(app,town,job)
			var w: SimWorld=app.simulation
			if task.is_empty():
				app.show_careers();check(has_text(app.drawer_body,"本鎮尚無工房"),"missing facility remains explicit");continue
			var recipe:=SimCareers.recipe(job)
			for resource in recipe.outputs: w.data.stockpile.resources[resource]=SimSupply.reserve(w,resource)
			var before: Dictionary=w.snapshot();app.show_careers();await settle()
			check(has_text(app.drawer_body,"備貨空間不足一整批"),"full stock explains no work "+job)
			check(equal(before,w.snapshot()),"readiness display does not change world")
			for resource in recipe.outputs: w.data.stockpile.resources[resource]=0
			for resource in recipe.inputs: w.data.stockpile.resources[resource]=0
			app.show_careers();await settle()
			check(has_text(app.drawer_body,"公共材料不足") and has_text(app.drawer_body,"開始時仍需符合"),"approval does not imply materials or location ready")
			check(not SimCareers.start(w,task.id).ok,"actual start rejects missing materials")
			for resource in recipe.inputs: w.data.stockpile.resources[resource]=20
			app._tick_simulation();await settle()
			check(not has_text(app.drawer_body,"公共材料不足"),"open idle career page refreshes after tick")
		var task:=Fixture.prepare(app,town,"researcher");var w: SimWorld=app.simulation
		w.data.stockpile.resources.research_points=100;app.show_careers();await settle()
		check(has_text(app.drawer_body,"目前沒有可追加的資料需求"),"covered research demand explained")
		w.data.research.current=null;app.show_careers();await settle()
		check(has_text(app.drawer_body,"目前沒有進行中的研究"),"no active research explained")
	var report:={"checks":checks,"failures":failures,"scope":"375px production/research readiness UI: reserve full, public inputs missing despite approval, no phantom workshop, no read-side world mutation, live tick refresh, no research and covered research demand"}
	FileAccess.open("res://docs/CAREER_READINESS_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

extends SceneTree
var failures: Array=[]
var checks:=0
func check(value: bool,message: String) -> void:
	checks+=1
	if not value: failures.append(message)
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var viewport:=SubViewport.new()
	viewport.size=Vector2i(375,812)
	viewport.own_world_3d=true
	root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate()
	viewport.add_child(app)
	await process_frame
	await process_frame
	app._responsive()
	for tab in ["小鎮","居民","故事","設定"]:
		app.show_tab(tab,true)
		await process_frame
		await process_frame
		check(app.drawer.position.x+app.drawer.size.x<=376,"375px drawer: "+tab)
		check(app.header.position.x+app.header.size.x<=376,"375px header: "+tab)
		check(app.navigation.position.x+app.navigation.size.x<=376,"375px nav: "+tab)
	for theme in ["frontier","harbor"]:
		for day in [1,7,30]:
			var raw:=FileAccess.get_file_as_string("res://tests/golden/%s-day-%02d.json"%[theme,day])
			check(app._load_document(raw,"測試"),"load viewer "+theme)
			check(app.world_view.actors.size()==app.document.data.agents.size(),"actor count")
			check(app.document.serialize()==raw,"render leaves save byte-exact")
			await process_frame
	for weather in ["rain","storm","snow","blizzard","clear"]:
		var data: Dictionary=app.document.snapshot()
		data.weather.current=weather
		data.clock.season="冬季" if weather=="snow" else "秋季" if weather=="clear" else "春季"
		app.world_view.display_save(data)
		check(app.world_view.actors.size()==data.agents.size(),"weather "+weather)
		await process_frame
	var summertime: Dictionary=app.document.snapshot()
	summertime.clock.season="夏季"
	summertime.clock.hour=23
	summertime.weather.current="clear"
	app.world_view.display_save(summertime)
	check(app.world_view.content.get_node_or_null("fireflies")!=null,"summer fireflies")
	app.show_agent(str(app.document.data.agents.keys()[0]))
	await process_frame
	var report:={"checks":checks,"failures":failures,"width":375,"height":812}
	FileAccess.open("res://docs/VIEW_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

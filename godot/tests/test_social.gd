extends SceneTree
var checks := 0
var failures: Array = []
func check(value: bool,message: String) -> void:
	checks+=1
	if not value: failures.append(message)
func same(a: Variant,b: Variant,message: String) -> void:
	check(JSON.parse_string(JSON.stringify(a,"",true))==JSON.parse_string(JSON.stringify(b,"",true)),message)
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var oracle: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tests/social/oracle.json"))
	for i in oracle.memory.size():
		var case: Dictionary=oracle.memory[i]
		var input: Dictionary=case.input
		var m:=SimMemory.new()
		m.load_entries(input.entries)
		same(m.recent(int(input.n)),case.expected.recent,"recent %d"%i)
		same(m.about_agent(str(input.agents[0]),int(input.n)),case.expected.about,"about %d"%i)
		same(m.important(7,int(input.n)),case.expected.important,"important %d"%i)
		same(m.thoughts(int(input.n)),case.expected.thoughts,"thoughts %d"%i)
		same(m.retrieve(input.query,input.agents,int(input.n),int(input.now)),case.expected.retrieved,"retrieval %d"%i)
		same(m.snapshot(),input.entries,"query preserves memory %d"%i)
	for case in oracle.relationships:
		check(SimRelationships.relationship_type(case.input)==case.expected,"relationship boundary "+str(case.input))
	var manager:=SimRelationships.new()
	var relation:=manager.get_or_create("other","阿明")
	SimRelationships.modify(relation,"affinity",150)
	SimRelationships.modify(relation,"trust",-150)
	SimRelationships.modify(relation,"romanticInterest",-5)
	for i in 160: SimRelationships.record_interaction(relation,i,"記憶"+str(i))
	SimRelationships.add_shared_memory(relation,"額外")
	for key in oracle.mutations:
		same(relation.get(key),oracle.mutations[key],"mutation field "+key)
	manager.load_relationships(oracle.manager.input)
	same(manager.friends(),oracle.manager.friends,"friend threshold")
	same(manager.romantic_interests(),oracle.manager.romantic,"romantic threshold")
	same(manager.best_friend(),oracle.manager.best,"best friend ties choose last")
	same(manager.partner(),oracle.manager.partner,"partner first match")
	same(manager.spouse(),oracle.manager.spouse,"spouse match")
	var memory:=SimMemory.new()
	memory.capacity=2
	for i in 3: memory.add(i,"now","social",str(i))
	check(memory.entries.size()==2 and memory.entries[0].tick==1,"memory capacity evicts oldest")
	memory.entries[0].future={"unknown":[1,2,3]}
	var copy:=memory.snapshot()
	copy[0].future.unknown.clear()
	check(memory.entries[0].future.unknown.size()==3,"snapshot preserves and isolates unknown fields")
	var viewport:=SubViewport.new()
	viewport.size=Vector2i(375,812)
	viewport.own_world_3d=true
	root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate()
	viewport.add_child(app)
	await process_frame
	var raw:=FileAccess.get_file_as_string("res://tests/golden/frontier-day-07.json")
	app._load_document(raw,"social test")
	app.show_tab("居民",true)
	var id: String=str(app.simulation.data.agents.keys()[0])
	app.show_agent(id,false)
	click_button(app.drawer_body,"近期記憶")
	check(app.resident_page=="memory","memory button opens page")
	click_button(app.drawer_body,"返回居民資料")
	click_button(app.drawer_body,"人際關係")
	check(app.resident_page=="relationships","relationship button opens page")
	click_button(app.drawer_body,"檢索相關記憶")
	check(app.resident_page=="memory" and not app.memory_target.is_empty(),"relationship memory link")
	var target: String=app.memory_target
	app._tick_simulation()
	check(app.resident_page=="memory" and app.memory_target==target,"tick retains memory subpage")
	check(app.document.serialize()==raw,"browsing and tick retain original bytes")
	await process_frame
	await process_frame
	check(app.drawer.size.x<=375,"mobile drawer width")
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"memory text wraps within drawer")
	app.show_relationships(id)
	await process_frame
	await process_frame
	for child in app.drawer_body.get_children():
		if child is Control: check(child.size.x<=app.drawer.size.x,"relationship controls fit drawer")
	var before: Dictionary=app.progress_snapshot()
	var loaded:=SimWorld.new()
	loaded.load_snapshot(before)
	same(loaded.data.agents[id].memory,before.agents[id].memory,"memory resume preserves entries")
	same(loaded.data.agents[id].relationships,before.agents[id].relationships,"relationship resume preserves fields")
	var report:={"checks":checks,"failures":failures,"scope":"Memory/Relationship primitives against upstream JS and read-only resident pages; no autonomous social simulation"}
	FileAccess.open("res://docs/SOCIAL_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
func click_button(parent: Node,text: String) -> void:
	for child in parent.get_children():
		if child is Button and child.text==text:
			child.pressed.emit()
			return
	check(false,"missing button "+text)

extends "res://tests/test_player_chat_ui.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func run() -> void:
	var app: Node=load("res://scenes/main.tscn").instantiate();root.add_child(app);await process_frame;app.set_process(false)
	var pair: Dictionary=Fixture.prepare(app,"frontier","doctor")
	var w: SimWorld=app.simulation;var m: SimMotion=app.motion
	var id: String=pair.provider;var recipient: String=pair.recipient
	var third: String=w.data.agents.keys().filter(func(k):return k not in ["player",id,recipient])[0]
	var a: Dictionary=w.data.agents[third];a.jobKey="doctor";a.activity="working";a.currentLocation=w.data.agents[id].currentLocation
	m.positions[third]=m.positions[id].duplicate(true)
	Fixture.converse(app,pair);Fixture.converse(app,{"provider":third,"recipient":recipient})
	check(ResidentCarePerformance.target(w,m,id)==recipient and ResidentCarePerformance.target(w,m,third)==recipient,"two real conversations may identify the same recipient")
	Fixture.render(app)
	check(app.world_view.resident_care.pairs.size()==1,"only one provider animates with a shared recipient")
	w.data.agents[id].needs.hunger=5;Fixture.render(app)
	check(not app.world_view.resident_care.pairs.has(id),"hungry provider prioritizes own needs")
	w.data.agents[id].needs.hunger=80
	Fixture.converse(app,{"provider":id,"recipient":"player"});Fixture.render(app)
	check(not app.world_view.resident_care.pairs.has(id),"latest partner is respected and player receives no unsolicited care")
	w.data.tickCount+=1;Fixture.render(app)
	check(app.world_view.resident_care.pairs.is_empty(),"old conversations do not repeat indefinitely")
	var report:={"checks":checks,"failures":failures,"scope":"controlled simultaneous conversations, single-recipient ownership, provider hunger, changed partner, player exclusion and expiry"}
	FileAccess.open("res://docs/RESIDENT_CARE_MATCHING.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)

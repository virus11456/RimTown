extends "res://tests/test_player_chat_ui.gd"
const Care=preload("res://scripts/view/resident_care_performance.gd")
const Fixture=preload("res://tests/resident_care_fixture.gd")
var cases: Array=[]
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			for age in [9,70]:
				var pair: Dictionary=Fixture.prepare(app,town,job,age)
				var w: SimWorld=app.simulation;var m: SimMotion=app.motion
				var id: String=pair.provider;var other: String=pair.recipient;var a: Dictionary=w.data.agents[id];var b: Dictionary=w.data.agents[other]
				var p: Dictionary=m.positions[other];var view: TownView=app.world_view
				Fixture.render(app);check(view.resident_care.pairs.is_empty(),"needs alone do not invent a conversation")
				Fixture.converse(app,pair);Fixture.render(app)
				if Care.target(w,m,id)!=other: print({"job":job,"town":town,"priority":SimServiceStay.priority(w,other),"provider":m.positions[id],"patient":p})
				check(view.resident_care.pairs.get(id,{}).get("target")==other,"real conversation enables the matching recipient")
				var before: Dictionary=w.snapshot();var motion_before: Dictionary=m.positions.duplicate(true);var angles: Array=[]
				for frame in 120:
					Fixture.render(app);angles.append(view.actors[id].get_node("Body/ServiceRight").rotation.x)
					check(view.resident_care.pairs.get(id,{}).get("target")==other,"pair stays directed to the actual partner")
				check(float(angles.max())-float(angles.min())>.1,"care hand gesture moves")
				check(equal(before,w.snapshot()) and equal(motion_before,m.positions),"animation cannot heal, improve mood, award, write memory or move people")
				check(view.actors[id].get_node("ResidentCareStatus").visible,"label describes current exchange")
				p.walking=true;Fixture.render(app);check(view.resident_care.pairs.is_empty(),"walking recipient stops care");p.walking=false
				p.x+=100;Fixture.render(app);check(view.resident_care.pairs.is_empty(),"distant recipient stops care");p.x-=100
				p.doorPhase="entering";Fixture.render(app);check(view.resident_care.pairs.is_empty(),"doorway transition stops care");p.doorPhase=null
				for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
					a[key]=a.currentLocation;Fixture.render(app);check(view.resident_care.pairs.is_empty(),"provider social priorities win");a.erase(key)
				for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
					b[key]=b.currentLocation;Fixture.render(app);check(view.resident_care.pairs.is_empty(),"recipient plans win");b.erase(key)
				for activity in ["working","heading_home","sleeping","receiving_service"]:
					b.activity=activity;Fixture.render(app);check(view.resident_care.pairs.is_empty(),"recipient's other activity wins")
				b.activity="idle";b.needs.hunger=5;Fixture.render(app);check(view.resident_care.pairs.is_empty(),"urgent meal wins");b.needs.hunger=80
				b.needs.rest=5;Fixture.render(app);check(view.resident_care.pairs.is_empty(),"urgent rest wins");b.needs.rest=30
				b._serviceStay=true;Fixture.render(app);check(view.resident_care.pairs.is_empty(),"existing player care owns recipient");b.erase("_serviceStay")
				b.needs.rest=90 if job=="doctor" else 30;b.mood=30 if job=="priest" else -20
				Fixture.render(app);check(view.resident_care.pairs.is_empty(),"resolved need stops the gesture");b.needs.rest=30;b.mood=-20
				w.data.tickCount+=1;Fixture.render(app);check(view.resident_care.pairs.is_empty(),"old conversation expires next tick");w.data.tickCount-=1
				w.data.clock.hour=23;Fixture.render(app);check(view.resident_care.pairs.is_empty(),"off shift cannot provide care");w.data.clock.hour=12
				Fixture.render(app);var pairs: Dictionary=view.resident_care.pairs.duplicate(true);app.running=false;app._process(.2)
				check(equal(pairs,view.resident_care.pairs),"pause freezes exchange")
				var save: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(save),"resident care reload")
				check(app.world_view.resident_care.pairs.is_empty(),"reload discards presentation phase")
				check(Vector2(app.motion.positions[other].x,app.motion.positions[other].y).distance_to(Vector2(p.x,p.y))<.001,"reload preserves recipient coordinates")
				cases.append({"town":town,"job":job,"recipient_age":age})
	var report:={"checks":checks,"failures":failures,"cases":cases,"scope":"controlled need, clinic registration, recipient position and genuine conversation API; provider collision arrival; display only, no treatment completion or new rewards"}
	FileAccess.open("res://docs/RESIDENT_CARE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)
